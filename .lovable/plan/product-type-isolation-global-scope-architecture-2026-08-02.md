# Product Type Isolation (Global Scope Architecture)

Today each admin page keeps its own local "type tab" state, and the data behind those tabs is not always type-filtered: `listMyCategories` returns every category regardless of type, the product form's category/subcategory dropdowns receive that unfiltered list, coupons and orders are filtered only in the browser, and analytics/statistics are computed across all orders. The fix is one shared scope that every module reads from, plus server-side filtering by that scope.

## 1. A single global Product Type Scope

- New `ProductTypeScopeProvider` mounted in the admin layout (`src/routes/_authenticated/admin/route.tsx`).
- Holds the current type: `all | physical | digital | service | subscription`.
- Persisted in the URL (`?ptype=digital`) and mirrored to localStorage so the scope survives page navigation inside the admin panel — switching from Products to Orders to Coupons keeps the same type.
- `useProductTypeScope()` hook exposes the value plus a setter; the existing `TypeFilterTabs` on every page becomes the control for this one shared value instead of per-page state.

## 2. Server-side scoping (the real isolation)

Every admin fetcher takes an optional `product_type` and filters in SQL, so no other type's rows ever reach the browser:

- `listMyProducts` — filter by `product_type`.
- `listMyCategories` — filter by `product_type` (this is what currently leaks Physical categories into the Digital form).
- `listMyCoupons`, `listMyBanners` — filter by `product_type`.
- `listAdminOrders` — filter by derived `order_type`.
- `businessAnalytics` / dashboard KPIs / badge counts — accept the scope and compute totals, revenue, best/worst sellers, customers, downloads and subscriber counts only from orders and items of that type.
- All React Query keys gain the type (`["admin","categories",type]`) so switching tabs refetches instead of showing stale cross-type data.

When scope is `all`, no filter is applied (that tab remains an intentional overview).

## 3. Per-module behaviour

- **Products page** — list, search, status/category filter dropdown, sort and the KPI strip all operate inside the scope. The category filter dropdown lists only categories of the current type.
- **Product form (`ProductDialog`)** — receives only same-type categories; subcategories are already derived from the selected parent, so they inherit the isolation. Product type stays tab-driven (already done) and is saved as-is.
- **AI Product Builder** — already receives `productType`; it will additionally be passed the scoped category list so generated products can only be assigned same-type categories.
- **Categories / Coupons / Banners pages** — tabs bind to the global scope; create actions inherit the scope's type; search runs within the scoped result set only.
- **Orders page** — the type tab binds to the global scope; status pills, counts, KPIs and search apply to scoped orders only.
- **Analytics / Dashboard** — a type indicator plus scoped statistics; "Total Products", "Active", "Downloads", "Subscribers", "Orders", "Revenue" recomputed per scope.

## 4. Cross-type write guards

- `upsertProduct` rejects a `category_id` whose category has a different `product_type`.
- `upsertCategory` / coupon / banner writes always stamp the scope's type (existing behaviour, made consistent).

## Technical notes

- No schema migration needed: `products`, `categories`, `coupons` and `banners` already carry `product_type`; order type is derived per order from its items.
- Files touched: new `src/lib/product-type-scope.tsx`; `src/lib/admin.functions.ts`, `src/lib/business.functions.ts`, `src/lib/orders-admin.functions.ts`, `src/lib/badge-counts.functions.ts`; admin routes `route.tsx`, `products.tsx`, `categories.tsx`, `coupons.tsx`, `banners.tsx`, `orders.tsx`, `analytics.tsx`, `index.tsx`; components `ProductDialog.tsx`, `AIProductBuilderDialog.tsx`, `TypeFilterTabs.tsx`.
- Storefront and customer-facing pages are untouched; this is a Store Admin architecture change.
