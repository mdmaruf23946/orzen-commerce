## Goal

Turn the Products page into a unified multi-type manager (All / Physical / Digital / Service / Subscription) using the same layout language as Categories, Banners, Coupons and Orders — without changing the existing physical product workflow.

## Verified current state

- `products.product_type` already exists as a real column and `upsertProduct` already writes it (`physical | digital | service | subscription`), so no migration is needed for filtering.
- The product form already fully supports Digital (files, license, download rules); Service and Subscription are present but disabled ("Coming Soon").
- The Products page today has no header component, no tabs, no search, no filters — just a title, an Add Product dropdown (Manual / AI) and a flat list. Bulk actions already exist (delete, category, price, stock, status).
- Shared layout pieces already exist: `AdminPageHeader`, `TypeFilterTabs`, `AdminToolbar`.

## Plan

### 1. Page shell (matches Categories/Banners/Coupons/Orders)

- `AdminPageHeader` with title, description and the Add Product action.
- Sticky `TypeFilterTabs`: All | Physical | Digital | Service | Subscription, each with a live count. Default tab: **Physical**.
- `AdminToolbar` search below the tabs, then filters, then the list. Tab switching only re-filters the already-loaded list — no page reload, no refetch.

### 2. Search and filters

- One search box for all types, matching name, SKU, category name and product type.
- Filter row: Status (active / draft / out of stock), Category, Price range, and sort by Newest / Oldest. Filters apply within the active tab.

### 3. Add Product dropdown

Replace the current Manual / AI dropdown with:

- Physical Product, Digital Product, Service, Subscription — each opens the product form pre-set to that type (type locked to the chosen value on create).
- AI Assistant stays as a separate entry at the bottom (physical/digital only).

### 4. Product cards

One shared card shell; only the meta line changes per type. Every card keeps thumbnail, name, a type badge, status, Edit and Delete, plus the bulk-select checkbox.

- Physical — exactly the current line (price, stock, status). Untouched.
- Digital — price, access type, download count. No stock.
- Service — starting price, booking type, estimated delivery time. No stock.
- Subscription — billing cycle, active subscribers. No stock.

### 5. Live metrics

`listMyProducts` returns two extra maps in one round trip:

- Download count per digital product from `digital_downloads`.
- Active subscriber count per subscription product from confirmed subscription orders (`orders.order_type = 'subscription'` joined through `order_items`).

### 6. Service & Subscription minimal fields

Enable both options in the product form and add a small type-specific card in the form, stored in `products.meta` (no migration):

- Service: booking type (instant / scheduled / request), estimated delivery time (free text, e.g. "2-3 days").
- Subscription: billing cycle (monthly / quarterly / yearly / lifetime).
- Both hide the physical-only sections (stock, shipping) the same way Digital already does.

### 7. Bulk actions

Keep the existing bar and add Enable / Disable (status active / draft) alongside Select All, Delete and Change Category. Select All applies to the visible (filtered) list only.

### 8. Empty states

Per-type empty state, e.g. "No Digital Products Found" with a button that opens the form for that type directly.

### 9. Mobile

Horizontally scrollable tabs, sticky search, full-width touch targets (min 40px), stacked card meta.

## Technical notes

- Files touched: `src/routes/_authenticated/admin/products.tsx` (rewritten around the shared shell), `src/components/admin/product-form/ProductDialog.tsx` (enable service/subscription, add the two small field cards, accept an initial type), `src/lib/admin.functions.ts` (metrics in `listMyProducts`), plus a new `src/components/admin/products/ProductRow.tsx` for the per-type card body.
- No database migration: `product_type` exists, service/subscription extras live in `meta`.
- Physical rendering, saving, variants, import/export and AI builder paths stay byte-identical in behaviour.
