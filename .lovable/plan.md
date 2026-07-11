# Store Admin Dashboard Redesign

Redesign only `src/routes/_authenticated/admin/index.tsx` (the Dashboard route) into a compact, analytics-first ORZEN homepage. No sidebar changes, no new modules, no new routes.

## Backend (data only, no new pages)

Add one new server function `myDashboardOverview` in `src/lib/admin.functions.ts` (extends existing `myDashboardStats`; the old function stays for compatibility). It returns everything the new page needs in a single round-trip:

- `store`: `{ name, slug, status, expires_at, updated_at, package_name }`
- `owner`: `{ name }` (from user metadata / profile fallback)
- `today`: `{ sales, orders, visitors, pendingOrders }` + yesterday counters so the UI can compute `▲ +12% vs Yesterday`
- `series`: daily buckets for `sales`, `orders`, `revenue` for ranges `today | 7d | 30d | month` (server returns all four so the filter is instant / no refetch)
- `orderStatus`: counts for `pending, confirmed, processing, delivered, cancelled, returned`
- `products`: `{ total, active, lowStock, outOfStock }` (low = `stock <= low_stock_threshold`; out = `stock = 0`)
- `performance`: `{ conversionRate, healthScore, customerRating }`
  - conversion = orders / visitors (fallback 0)
  - healthScore = weighted composite of (has products, has banner, subscription active, recent orders, low-stock ratio) → 0–100
  - customerRating: average from `feedback` table if present, else `null`
- `recentOrders`: latest 5 (`id, order_number, customer_name, subtotal, status, created_at`)
- `notifications`: latest 3 important items merged from new-order events (last 24h), low-stock products, and subscription expiry (<7 days)

Visitors source: if a visitors/analytics table is not present, return `0` with a `visitors: { available: false }` flag so the card shows a neutral "—" instead of fake data. No new tables.

## Frontend

Rewrite `src/routes/_authenticated/admin/index.tsx` end-to-end. Single file, pure Tailwind + Lucide + one small inline SVG line chart component (no new deps).

Design tokens applied inline via existing shadcn semantic classes: pure white surfaces via `bg-background`, borders `border-border` (already `#E5E7EB`-adjacent), radius `rounded-[18px]`, soft shadow `shadow-sm`, headings `font-semibold tracking-tight`, generous spacing (`space-y-6`, `p-5 md:p-6`). Mobile-first grids: 1 col → `sm:` 2 cols → `lg:` 4 cols.

### Section layout

1. **Welcome Header** — card with left block `Welcome back, {name}` + meta row (Status pill, Subscription pill, Store URL link, Last updated relative time); right block `Open Store` button (links to `/store/$slug`, `target=_blank`).
2. **Business Overview** — 4 stat cards (Today's Sales, Today's Orders, Today's Visitors, Pending Orders). Each: icon in tinted square, label, large number, trend chip with arrow + `% vs Yesterday`. Grid `grid-cols-2 lg:grid-cols-4`.
3. **Sales Analytics** — one card, header with title + segmented filter (`Today | 7 Days | 30 Days | This Month`) + legend (Sales / Orders / Revenue). Body: single responsive inline SVG line chart with 3 series, axis labels, hover dots. Filter switches series client-side from pre-fetched `series` payload.
4. **Order Status** — 6 compact tinted cards in `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` with status icon + count + label. Tints via inline classes only (amber/blue/indigo/emerald/red/slate), no palette changes.
5. **Product Summary** — single card, 4-column inline stats row (Total / Active / Low Stock / Out of Stock). No table.
6. **Store Performance** — single card, 3 items with small circular SVG progress rings (Conversion Rate %, Health Score /100, Customer Rating /5).
7. **Recent Orders** — card with compact table (Customer, Order #, Amount, Status pill, Date). Mobile: same rows collapse to stacked list. `View All Orders` button links to `/admin/orders`.
8. **Notifications** — card with up to 3 rows: icon + title + one-line detail + relative time; empty state "You're all caught up".
9. **Quick Actions** — 4 large touch-friendly buttons in `grid-cols-2 lg:grid-cols-4`: Add Product → `/admin/products`, View Orders → `/admin/orders`, Share Store (copies storefront URL to clipboard with toast), Open Store → new tab.

### Data wiring

- Single `useQuery(["admin","overview"], overviewFn)` with `staleTime: 30_000`.
- Sales Analytics filter is local state; the payload already contains all four ranges.
- Share Store uses `navigator.clipboard.writeText` + existing `sonner` toast.
- Loading = skeleton blocks with same layout (no CLS). Errors = inline retry chip on the affected card only.

### Not touched

- `src/routes/_authenticated/admin/route.tsx` (sidebar) — unchanged.
- All other admin pages — unchanged.
- `src/styles.css`, theme tokens — unchanged.
- `myDashboardStats` — kept for other callers.

## Files

- **Edit** `src/lib/admin.functions.ts` — add `myDashboardOverview` server function.
- **Rewrite** `src/routes/_authenticated/admin/index.tsx` — new dashboard UI with the 9 sections above, inline SVG line chart + progress rings, no new dependencies.
