
# Store Admin Dashboard — Premium UI Redesign

Reference: the attached screenshot (MyStore admin). Scope is strictly visual — no route, server function, RLS, schema, or feature change. All 30+ sidebar links stay, all data sources stay, all handlers stay.

## Files touched (UI only)

1. `src/routes/_authenticated/admin/route.tsx` — sidebar shell + header
2. `src/routes/_authenticated/admin/index.tsx` — dashboard content
3. `src/components/admin/dashboard/*` — new presentational components (no logic)
4. `src/styles.css` — add a few semantic tokens (indigo primary accent, soft surface, success/warn/danger tints) using existing shadcn token pattern

No other files change.

## 1. Sidebar (route.tsx)

Keep the exact `links` array and its order — every current entry stays with identical `to`, `label`, `icon`, `exact`. Only the visual grouping and rendering changes.

Introduce a presentational grouping map (labels only, no route change):

```
Main:        Dashboard
Orders:      Orders, Returns
Products:    Products, Categories, Inventory
Customers:   Customers, Customer Accounts, Duplicate Protection
AI & Automation: AI Sales Agent, AI Recommendations, Handoff Queue,
                 Low Stock Alerts, Messenger, Messenger Inbox
Marketing:   Marketing, Coupons, SEO, Banners
Finance:     Payments, Payment Gateway, Finance, Analytics
Settings:    Delivery, Couriers, Theme, Product Defaults,
             Notifications, Legal & Info Pages, Domains, DNS Checker,
             Import / Export, Subscription, Billing & Plans, Store Settings
```

Any link not covered by the map falls through into a "More" group so nothing can be dropped by mistake.

Sidebar visuals:
- Fixed 260px width desktop, collapsible to 72px icon-rail (toggle button in header). Persist collapsed state in `localStorage` (read in `useEffect`).
- Section headers: uppercase 11px, muted, chevron for collapse/expand (default expanded).
- Active link: soft indigo pill (`bg-primary/10 text-primary` + left 2px indigo bar), inactive: `text-muted-foreground hover:bg-muted`.
- Store brand block at top (logo + "Store Admin" + role) matching screenshot's `MyStore` card.
- Search input at the top of the nav filters links by label client-side.
- Mobile: existing drawer behavior preserved; grouping still applies.
- Logout stays pinned at bottom.

## 2. Top header (route.tsx)

Sticky header (desktop too, not just mobile). Left→right:
- Sidebar collapse toggle
- Global search input (client-side placeholder; no new API)
- Notification bell (uses existing notifications count if already fetched, otherwise a static badge — no new query)
- Messenger icon linking to `/admin/messenger-inbox`
- "View Store" button linking to existing store URL logic already in the dashboard
- Profile menu (existing signOut wired to the current handler)
- Dark mode toggle (uses existing `dark` class approach via `next-themes` if present, else a no-op toggle switching `.dark` on `<html>`)

## 3. Dashboard content (`admin/index.tsx`)

Preserve every existing data hook, query key, and server-function call. Only markup/layout changes. New sub-components are pure presentation and receive the same data the current page already fetches.

Layout order (matches reference):

1. **Welcome card** — greeting, store URL chip, "Last Updated", Active Store pill, View Store button.
2. **AI Business Summary banner** — soft gradient (indigo→violet), robot illustration slot, existing AI summary text bindings.
3. **KPI row (4 cards)** — Today's Sales, New Orders, Messenger Unread (AI/Human split chip), Need Attention (Pending Orders / Low Stock / AI Failed sub-rows). Each card: icon tile, big value, delta vs yesterday, mini sparkline (reuse existing sparkline SVG pattern from `owner/index.tsx` — no new chart lib).
4. **Middle row (3 columns on xl, stack on smaller)**:
   - Today's Tasks list (Confirm Orders, Reply Messenger, Low Stock, Courier Pending, AI Needs Review) — each item links to its existing route.
   - Sales Analytics chart with Today / 7 Days / 30 Days / 12 Months tabs and Sales/Orders/Revenue/Profit sub-tabs. Uses existing chart data; if the current dashboard uses Recharts, keep Recharts (no new lib).
   - AI Performance card (accuracy ring, Orders by AI, Conversion, Human Takeover, Failed Replies) — bound to existing AI metrics only if already present, otherwise render "—" placeholders. No new server call.
5. **Bottom row (4 columns on xl)**:
   - Recent Orders table (Customer / Order ID / Amount / Status / Time / Actions) — same data, restyled rows with status pills.
   - Messenger Overview (Unread, AI Replied, Human Replied, Avg Response Time) + "Open Inbox" link.
   - Notifications feed with icon + title + timestamp.
   - Quick Actions grid: Add Product, Create Coupon, Create Banner, View Orders, Messenger Inbox, Open Store (each = `<Link>` to the already-existing route).

Order Status horizontal strip (Pending / Confirmed / Packaging / Processing / Shipped / Delivered / Cancelled / Returned) sits between KPI row and middle row, each chip links to `/admin/orders?status=<value>` using the query param the orders page already accepts.

## 4. Design tokens (`src/styles.css`)

Add under existing `:root` / `.dark`:
- `--brand-indigo`, `--brand-indigo-foreground`
- `--surface-soft` (card background for KPI tiles)
- `--success`, `--warning`, `--danger` tint variants (light bg + solid fg) used by status pills

Register them in `@theme inline` so utilities like `bg-surface-soft`, `text-brand-indigo` work. No token removal, no shadcn primitive changes.

## 5. Responsiveness

- `< 640px`: single column, KPI cards 2-per-row, order status strip horizontal scroll, tables become card list.
- `640–1024px`: 2 columns for middle/bottom rows.
- `≥ 1280px`: full reference layout.
- Sidebar stays as mobile drawer under `md`.

## 6. Guarantees

- No `links` array entry removed or renamed.
- No route file added/removed.
- No server function, RLS policy, or Supabase call added or changed.
- `SubscriptionStatusBanner`, `StickyMobileAdBar`, `Outlet`, sign-out handler, `amIOwner` gate all preserved.
- All existing `<Link to="...">` targets kept.

## Verification

- Visit `/admin`: layout matches reference sections, all KPIs render with existing data, sidebar shows every current link across the new groups.
- Toggle sidebar collapse, mobile drawer, dark mode.
- Click each Quick Action, Order Status chip, Task item → lands on the same existing route it does today.
- `bun run build` succeeds; no new dependencies added.
