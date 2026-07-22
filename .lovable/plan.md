## Messenger Duplicate Order Protection

Extend the existing website duplicate-protection system to also cover Messenger AI orders. Reuse `checkDuplicate` in `src/lib/duplicate-guard.server.ts` — no second checker.

### 1. Reuse the shared validator (no schema changes required)

Call the existing `checkDuplicate({ storeId, phone, customerId, fingerprint, deviceId, productIds })` from the Messenger order finalizer. The `store_duplicate_protection` row a store already configured (rules for phone / product / customer, period_days, mode block|warn|off, match_logic) will apply automatically. This satisfies "one shared validation service".

Additions for Messenger:
- Pass `phone` = normalized customer phone from the pending slot.
- Pass `productIds` = `[slot.product_id]`.
- Pass `customerId` = matched `store_customers.id` when a row exists for `(store_id, phone)`; otherwise null.
- `fingerprint`/`deviceId` = null (no browser context in Messenger).

The existing `active status` semantics are already correct: `checkDuplicate` filters on `orders.status <> 'cancelled'` via the underlying settings; we keep behavior identical to website. (No status-list override for now — matches the "reuse, don't fork" rule.)

### 2. Wire it into the Messenger finalizer

File: `src/routes/api/public/messenger/webhook.ts`, function `finalizePendingMessengerOrder` (around line 405, right after product/stock validation, before the `orders.insert`).

```text
- resolve normalized phone (already computed for insert)
- lookup store_customers.id by (store_id, phone) — optional
- dup = await checkDuplicate({...})
- if dup.action === "block":
    - fetch matched order (id, invoice_no, status) via supabaseAdmin
    - insert a row in store_duplicate_blocks with source='messenger',
      payload = { psid, conversation_id, product_id, qty, ... }
    - reply with the Bangla template (uses invoice_no + status)
    - do NOT create the order; clear the pending slot; return true
- if dup.action === "warn":
    - log the block row with status='warned', still create the order
      (matches website "warn" mode)
- else: continue with existing insert flow
```

The Bangla reply template lives inline in the webhook (same style as other order messages there). If admin has set a `custom_ai_duplicate_reply`, use that; else the default template.

### 3. Small settings extensions (optional column adds)

Add nullable columns to `store_duplicate_protection` so admins can tune Messenger behavior without a parallel table:

- `rule_psid boolean default false` — check by Messenger PSID (`ai_conversations.psid` → past `orders` linked via `ai_conversations.order_id`, or via `orders.notes` marker; simplest: skip until we persist psid on order — see step 5).
- `messenger_custom_reply text` — optional override for the duplicate message.
- `messenger_enabled boolean default true` — kill switch just for Messenger.

Extend `getDuplicateSettings`/`updateDuplicateSettings` and the admin UI page (`src/routes/_authenticated/admin/duplicate-protection.tsx`) with a "Messenger Duplicate Protection" section exposing these fields. Existing rules (phone, product, customer, period_days, mode) are shared — no duplication.

### 4. Admin override on an order

Add `allow_duplicate boolean default false` to `orders`. When set true by an admin (checkbox in `OrderDetailsDrawer`), a follow-up duplicate check skips that order as a match (add `.eq("allow_duplicate", false)` filter inside `checkDuplicate`'s per-column lookups). This is a minimal addition and both website + Messenger benefit.

### 5. Blocked-attempt log (reuse `store_duplicate_blocks`)

Already exists for website blocks. Add two nullable columns so Messenger attempts show up in the same admin list/analytics:

- `source text default 'web'` — 'web' | 'messenger'
- `psid text` — Messenger PSID when source='messenger'

Update `listDuplicateBlocks` to return `source`/`psid`; the existing admin page renders a new "Source" column and PSID chip.

### 6. Analytics tiles

In the admin dashboard overview (`src/lib/admin.functions.ts` → `myDashboardOverview`) add three counts derived from `store_duplicate_blocks`:

- `duplicates_blocked_today` — count where `created_at >= today` and `status in ('blocked','warned')`.
- `duplicates_blocked_month` — same, month-to-date.
- `duplicate_savings` — SUM over blocked rows of `payload->>'total'::numeric` (approximate; matches website's payload shape and Messenger's payload we insert).

Surface them as a small strip on the dashboard next to existing KPI cards (no layout redesign — one extra row/card).

### Technical notes

- **Single validator**: only `checkDuplicate` in `duplicate-guard.server.ts` performs matching. Messenger path just calls it and formats a reply.
- **Migration**: one migration adds `rule_psid`, `messenger_enabled`, `messenger_custom_reply` to `store_duplicate_protection`; `source`, `psid` to `store_duplicate_blocks`; `allow_duplicate` to `orders`. All nullable / defaulted — no data backfill.
- **RLS/GRANT**: no new tables, no new policies needed.
- **Behavioral safety**: if `store_duplicate_protection.enabled=false` or `messenger_enabled=false`, Messenger flow is unchanged.

### Files touched

- `src/routes/api/public/messenger/webhook.ts` — call `checkDuplicate` in `finalizePendingMessengerOrder`, log block, send Bangla reply.
- `src/lib/duplicate-guard.server.ts` — honor `orders.allow_duplicate=false` filter; accept optional `psid` and consult `rule_psid`; return matched order's `invoice_no` and `status` for the Messenger reply.
- `src/lib/duplicate-protection.functions.ts` — extend validators for new fields.
- `src/routes/_authenticated/admin/duplicate-protection.tsx` — new "Messenger" subsection + Source column.
- `src/components/admin/OrderDetailsDrawer.tsx` — "Allow duplicate purchase" toggle.
- `src/lib/admin.functions.ts` + `src/routes/_authenticated/admin/index.tsx` — 3 analytics counters.
- One Supabase migration for the column additions.
