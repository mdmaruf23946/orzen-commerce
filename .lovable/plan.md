# Global Unread Count & Activity Badge System

Add a scalable, per-store, real-time badge system to the Store Admin sidebar and dashboard — without changing any existing menus, pages, or features.

## Architecture

A single reusable hook drives every badge. Each menu item that opts in registers a "counter" with:
- A **query key** (React Query)
- A **fetcher** (server fn that returns a number, scoped to `store_id` via `requireSupabaseAuth`)
- A **Realtime subscription** (Supabase channel on the relevant table) that invalidates the query
- A **mark-as-read** action tied to the natural "viewed" moment on that page

Counts are stored as **read cursors per store owner**, not by recomputing over all rows. One tiny table holds the last-seen timestamp per (user, store, feature). Counts = rows created/updated after that cursor, filtered by feature-specific "actionable" predicate.

### New table

`admin_read_cursors`
- `user_id`, `store_id`, `feature` (text), `last_seen_at` (timestamptz)
- PK (user_id, store_id, feature)
- RLS: owner-only, scoped by `is_store_owner(store_id)`
- GRANTs for authenticated + service_role

### Per-feature counting rules

| Sidebar item | Rule | Source |
|---|---|---|
| Orders | orders with `created_at > cursor`, status ≠ cancelled (includes landing-page orders — they already insert into `orders`) | `orders` |
| Returns | `returns` created_at > cursor, status = pending | `returns` |
| Customers | new `store_customers` created_at > cursor | `store_customers` |
| Customer Accounts | same as Customers cursor (shared) | `store_customers` |
| Messenger / Messenger Inbox | **distinct conversations** with `last_customer_message_at > cursor` AND unresolved | `ai_conversations` |
| Handoff Queue | conversations where `handoff_at IS NOT NULL AND handoff_resolved_at IS NULL` (no cursor — pure pending state) | `ai_conversations` |
| Low Stock Alerts | `low_stock_alerts` where `resolved_at IS NULL` (pure state) | `low_stock_alerts` |
| Notifications | `admin_notifications` where `read_at IS NULL` for this user/store | `admin_notifications` |
| Payments | `payments` with status in (failed, requires_action, pending_verification) created_at > cursor | `payments` |
| Payment Gateway | `payment_webhook_events` with error status since cursor | `payment_webhook_events` |
| Delivery / Couriers | orders with `courier_status` in exception set since cursor | `orders` |
| Landing Pages | `landing_page_logs` with status=failed since cursor | `landing_page_logs` |
| Duplicate Protection | `store_duplicate_blocks` created_at > cursor | `store_duplicate_blocks` |
| AI Recommendations | pending recs since cursor | `ai_product_recommendations` |
| Coupons / Marketing / Import-Export / Billing / Subscription | no badge unless a specific actionable event exists (skip for now to avoid noise) | — |

Pure-state counters (Handoff, Low Stock, Notifications) ignore cursors — they naturally clear when the underlying row is resolved/read.

## Backend

New `src/lib/badge-counts.functions.ts`:
- `getAdminBadgeCounts({ store_id })` → returns `{ orders, returns, customers, messenger, handoff, low_stock, notifications, payments, payment_gateway, delivery, landing_pages, duplicate_protection, ai_recommendations }` in one round-trip
- `markFeatureSeen({ store_id, feature })` → upserts cursor to `now()`
- `markConversationRead({ conversation_id })` → sets `last_read_at` on that conversation (new column) for per-thread inbox indicator
- `markNotificationRead({ id })` / `markAllNotificationsRead({ store_id })`

All server fns use `requireSupabaseAuth` + verify `is_store_owner(store_id)`.

Migration also enables `supabase_realtime` publication for: `orders`, `returns`, `store_customers`, `ai_conversations`, `low_stock_alerts`, `admin_notifications`, `payments`, `payment_webhook_events`, `landing_page_logs`, `store_duplicate_blocks`, `ai_product_recommendations` (only those not already added).

Adds `ai_conversations.last_read_at` (nullable timestamptz) for per-conversation read state and Messenger Inbox indicator.

## Frontend

### New `src/lib/use-badge-counts.ts`
- `useBadgeCounts()` — resolves current `store_id`, fetches counts (React Query, 30s stale), subscribes to one Realtime channel per relevant table, invalidates the counts query on any change. Returns typed `{feature: count}` map.
- `useMarkSeen(feature)` — mutation that upserts the cursor and invalidates counts.

### Sidebar (`src/routes/_authenticated/admin/route.tsx`)
- Extend `LinkDef` with optional `badgeKey: keyof BadgeCounts`
- Add `badgeKey` to the relevant `links` entries only (Orders, Returns, Customers, Customer Accounts, Messenger, Messenger Inbox, Handoff Queue, Low Stock Alerts, Notifications, Payments, Payment Gateway, Delivery, Couriers, Landing Pages, Duplicate Protection, AI Recommendations)
- Render a compact `<CountBadge>` beside label; when sidebar is collapsed render a small dot on the icon (absolute-positioned)
- Format: hide at 0, show `n` up to 99, show `99+` beyond
- Subtle `animate-pulse` for ~2s when count increases (tracked via previous value ref)
- `aria-label` includes "N unread <feature>"

### CountBadge component
`src/components/admin/CountBadge.tsx` — pill with `bg-primary text-primary-foreground`, `text-[10px]`, `min-w-[18px]`, matches existing accent tokens.

### Mark-as-read wiring (page-level, minimal touch)
Each target page adds a single `useEffect(() => markSeen("<feature>"), [])` on mount:
- `orders.tsx` → "orders" + "delivery" + "landing_pages" (Orders page acknowledges those newer rows the admin now sees)
- `returns.tsx` → "returns"
- `customers.tsx` → "customers"
- `customers-accounts.tsx` → "customers"
- `messenger-inbox.tsx` → "messenger"; opening a specific conversation calls `markConversationRead`
- `low-stock.tsx` → no cursor (state-based)
- `handoff-queue.tsx` → no cursor (state-based)
- `notifications.tsx` → calls `markAllNotificationsRead`
- `payments.tsx` → "payments"
- `payment-gateway.tsx` → "payment_gateway"
- `duplicate-protection.tsx` → "duplicate_protection"
- `ai-recommendations.tsx` → "ai_recommendations"
- `landing-pages.index.tsx` → "landing_pages"
- `couriers.tsx` → "delivery"

### Dashboard sync
`WelcomeCard.tsx` / dashboard already shows some counts — swap those specific numbers to consume the same `useBadgeCounts()` map so sidebar and dashboard never disagree. No visual redesign.

### Messenger Inbox per-conversation indicator
In the conversation list of `messenger-inbox.tsx`, show a small unread pill next to each conversation where `last_customer_message_at > (last_read_at ?? epoch)`; badge count on the row equals message count since `last_read_at` (already available from `ai_messages`, computed client-side from already-loaded conversation rows).

## Store Isolation & Security

- Every fetcher scopes `WHERE store_id = _store_id` AND `is_store_owner(_store_id)` check
- `admin_read_cursors` RLS: `user_id = auth.uid()` AND `is_store_owner(store_id)`
- Realtime channels are opened per resolved `store_id`; RLS on the underlying tables already prevents cross-store leakage
- Zero-state: badge component returns `null` when count is 0

## Performance

- One combined server fn returns all counters via parallel small `SELECT count(*)` with proper indexes (all target tables already indexed on `store_id` + `created_at`)
- One React Query key; Realtime invalidates it instead of refetching per event
- Cursors avoid full-table scans on `admin_notifications` etc.

## Out of scope (explicitly not touched)

- Existing menu structure, icons, groupings, or ordering
- Any page's layout, business logic, or existing counts other than reading from the new hook
- Coupons, Marketing, Import/Export, Billing, Subscription menus — no badge unless a clear actionable event exists

## Technical details

- Realtime channel names: `admin-badges:<store_id>` with multiple `postgres_changes` listeners; unmount tears down
- Migration order per new table: CREATE → GRANT (authenticated, service_role; no anon) → ENABLE RLS → POLICY
- `admin_read_cursors` uses `on conflict (user_id, store_id, feature) do update set last_seen_at = excluded.last_seen_at`
- `ai_conversations.last_read_at` added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- Publication additions guarded with `DO $$ ... IF NOT EXISTS ... $$` blocks
