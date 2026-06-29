
# Store Admin Business Management Expansion

Extends the existing admin panel with 10 new modules. No existing feature is duplicated — Products, Orders, Customers, Banners, Settings, AI, Messenger, Marketing, Couriers, Theme, SEO, Delivery, Payments, Notifications, Product Defaults, Categories, Subscription stay as-is. New work plugs into the same sidebar, uses the same server-fn + RLS patterns, and stays mobile-first with no new heavy libraries.

## 1. Database (one migration)

New tables (all RLS-scoped to the owning store via `stores.owner_id = auth.uid()`, with proper GRANTs):

- `stock_movements` — store_id, product_id, delta, type (`order|manual_in|manual_out|return|adjustment`), reason, ref_order_id, created_by, created_at.
- `coupons` — store_id, code (unique per store), type (`percent|fixed|free_shipping`), value, min_order, usage_limit, used_count, starts_at, expires_at, active.
- `coupon_redemptions` — coupon_id, order_id, customer_phone, discount_amount, created_at.
- `expenses` — store_id, category (`fb_ads|courier|packaging|salary|misc`), amount, note, spent_on (date), created_at.
- `returns` — store_id, order_id, type (`return|exchange`), reason, status (`requested|approved|rejected|refunded|completed`), refund_amount, resolution_note, created_at, updated_at.
- `order_timeline` — order_id, store_id, stage (`placed|confirmed|packed|courier_assigned|shipped|delivered|returned|cancelled`), note, created_at.
- `customer_notes` — store_id, customer_phone (key, since there's no customers table), tags text[], note.
- `order_internal_notes` — order_id, store_id, body, created_by, created_at. (RLS: store owner only — never exposed on public storefront fns.)

Column additions:
- `products`: `cost_price numeric`, `low_stock_threshold int default 5`, `sku text`.
- `orders`: `coupon_id`, `discount_amount`, `invoice_no text unique per store` (generated on confirm).

Triggers:
- After `order_items` insert on confirmed order → insert negative `stock_movements` row and decrement `products.stock`.
- After `orders.status` change → insert `order_timeline` row with the matching stage.
- `invoice_no` auto-set when status moves to `confirmed` (format `INV-{store_prefix}-{yyyymm}-{seq}`).

## 2. Server functions (`src/lib/admin.functions.ts` additions + new `src/lib/inventory.functions.ts`, `coupons.functions.ts`, `finance.functions.ts`, `returns.functions.ts`, `analytics.functions.ts`)

All use `requireSupabaseAuth` and scope by `store_id` resolved from `getMyStore`. Public storefront gets one new fn `validateCoupon({ code, subtotal })` in `storefront.functions.ts` (no auth, narrow column projection). Checkout fn updated to accept `coupon_code`, recompute discount server-side, record redemption, apply free-shipping logic.

## 3. New admin routes (under `src/routes/_authenticated/admin/`)

- `inventory.tsx` — table of products with stock, cost, price, profit/unit, low/out badges; manual +/- dialog writes a `stock_movements` row. Tab for "Movements" history (paginated, 50/page).
- `coupons.tsx` — list + create/edit dialog with all coupon types, status toggle, usage counter.
- `finance.tsx` — expense entry form + list filtered by date range + cards (Today sales, Today expenses, Today profit, Monthly profit, Net profit). Profit = sales − COGS (from `cost_price` × qty in order_items) − expenses.
- `returns.tsx` — list of return/exchange requests with status workflow buttons; "New return" picks an existing order.
- `analytics.tsx` — Sales / Products / Customers / Performance sections using small SVG sparklines (no chart library; hand-rolled `<svg>` polyline ~30 LOC). Daily / Weekly / Monthly toggle.
- `import-export.tsx` — CSV upload (parsed client-side with a tiny ~80-line CSV parser, no PapaParse), preview + validation table, then bulk upsert via server fn. Export downloads CSV/XLSX (XLSX via `xlsx` only if user wants — default CSV to avoid the dep).

Sidebar in `route.tsx` gets 6 new links with lucide icons (Boxes, Ticket, Wallet, RotateCcw, BarChart3, FileUp).

## 4. Edits to existing routes

- `products.tsx` — add checkbox column, sticky bulk-action bar (Delete / Change category / Update price / Update stock / Change status) when any row selected. Form: add `cost_price`, `low_stock_threshold`, `sku`.
- `orders.tsx` — order row expands to show:
  - Timeline (vertical list of stages with timestamps).
  - Internal notes thread (add/delete, owner-only).
  - "Generate invoice" / "Print" / "Download PDF" buttons.
- `customers.tsx` — per-customer drawer with tags (chips: Trusted / COD Risk / VIP / Frequent — plus custom) and free-text note, saved to `customer_notes` keyed by phone.

## 5. Invoice

- New route `admin/orders.$orderId.invoice.tsx` — thermal-friendly 80mm CSS print layout (`@media print` with `@page { size: 80mm auto }`), shows store info, customer, items, totals, invoice no.
- "Download PDF" uses the browser's native print-to-PDF (`window.print()`) — zero JS dependency, keeps bundle small. Document this in the UI.

## 6. Checkout integration

`checkout.tsx` gets a coupon input that calls `validateCoupon`, shows discount line, free-shipping note. Order placement passes the code; server recomputes everything (never trusts client totals).

## 7. Performance guardrails

- No new npm packages by default (CSV parser inline, charts inline SVG, PDF via `window.print`). Only if user later asks for `.xlsx` import/export we add `xlsx` (~400KB) lazily on the import page via `await import('xlsx')`.
- All new admin routes lazy-loaded by TanStack file-based routing (already the case).
- Each new server fn returns only the columns the page renders; analytics uses SQL aggregates (`group by date_trunc`) rather than pulling rows.
- Lists paginated at 50; movement/timeline use indexes on `(store_id, created_at desc)` and `(order_id, created_at)`.
- Mobile-first: bulk-action bar collapses to a bottom sheet on small screens; tables become card lists < `sm`.

## Open questions before I start

1. Confirm CSV-only import/export by default (keeps bundle small). XLSX support can be added later if needed — OK?
2. Invoice PDF via browser print-to-PDF (no extra deps) vs. a real PDF lib like `pdf-lib` (~100KB) — print-to-PDF OK?
3. Discount applies to `subtotal` (excluding delivery) for percent/fixed, and zeroes delivery for free_shipping — confirm.
4. Customer identity is by `phone` (since there's no logged-in customer model on storefront) — OK for customer notes and returning-customer analytics?
