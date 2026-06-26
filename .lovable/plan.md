# Storefront Premium UI + Theme (Performance-Preserving)

All changes are presentation-only. No new API calls, no new routes, no extra round-trips. Filtering, search, and theme color changes happen entirely on the client using existing loader data and CSS variables.

## 1. Theme fields (Store Settings)

Add 4 nullable color columns to `stores`:
- `header_color`
- `product_title_bar_color`
- `footer_color`
- `button_color`

(`primary_color` already exists — reused as fallback.)

Update `src/lib/admin.functions.ts` `updateMyStore` input + `src/routes/_authenticated/admin/settings.tsx` with a new "Theme" section: 4 color pickers (reusing the existing `<input type="color">` pattern, no new deps).

## 2. Apply theme via CSS variables

In `src/routes/store/$slug/route.tsx` (store layout), inject one `<style>` tag scoped to the storefront root setting:
```
--store-header-bg, --store-title-bar-bg,
--store-footer-bg, --store-btn-bg
```
from the loaded `store` row. Changing colors in admin → just rewrites these vars on next render. No global style regeneration.

## 3. Header upgrade (lightweight, sticky)

Edit the existing storefront header in `src/routes/store/$slug/route.tsx`:
- `sticky top-0 z-40` with `bg-[var(--store-header-bg)]` fallback to card.
- Layout: Logo + Store Name (left) · Search input (center, flex-1) · Cart icon w/ count (right).
- Search: plain controlled `<input>` writing to a tiny Zustand-free context (React `useState` lifted in the layout via `useRouteContext` or a small `StoreUIContext` provider in the layout file). Home page reads the query and filters its already-loaded `products` array with `useMemo`. No debounce needed since it's pure local filter; no server calls.
- Mobile: search collapses under the logo row on `< sm` (single extra row, no JS toggle).

## 4. Category pills on home (no navigation)

`src/routes/store/$slug/index.tsx`:
- Loader already fetches products; extend `listStoreProducts` to also include `category_id` (already in schema) and add a tiny `listStoreCategories` call to the same loader's `Promise.all` (one extra cached query, runs in parallel with banners/products — no per-click requests after).
- Render horizontally-scrollable pill row below the banner: `All Products` + each category. Active pill uses `--store-btn-bg`.
- Selection stored in local `useState`; combined with header search query via `useMemo` to filter the product grid in place. No route change, no reload, no separate category page.

## 5. Product card refresh

Extract `src/components/storefront/ProductCard.tsx` from inline JSX in `index.tsx`:
- Image (lazy, existing img proxy, `loading="lazy"` + `decoding="async"`).
- Colored **title bar** using `--store-title-bar-bg` with title inside.
- Price / old price / stock badge.
- Small `Add to Cart` button + full-width `Buy Now` button (uses `--store-btn-bg`). `Add to Cart` calls existing `cart.ts` helper; `Buy Now` adds + `navigate` to `/store/$slug/cart`. No animations beyond `:active` opacity.

## 6. Footer

New `src/components/storefront/StoreFooter.tsx`, rendered in `src/routes/store/$slug/route.tsx` below `<Outlet />`:
- Background `--store-footer-bg`.
- Columns (stack on mobile): Logo + description · Contact (phone/WhatsApp/Facebook/email — already in `stores`) · Quick links (Privacy / Terms / Return Policy — link to anchor-only placeholders for now, no new routes) · Copyright row.
- All data from the already-loaded `store` row — zero extra requests.

## 7. Performance guardrails

- No new libraries.
- One extra loader query (`categories`) parallelized with existing ones; cached by React Query.
- Search + category filter = pure `useMemo` over in-memory products.
- Theme = CSS custom properties only, no re-render of unrelated components.
- Images keep current `loading="lazy"` + proxy; no layout shift (existing `aspect-square`).
- Sticky header is pure CSS.

## Files touched

- DB migration: add 4 color columns to `stores`.
- `src/lib/admin.functions.ts` — extend `updateMyStore` schema.
- `src/lib/storefront.functions.ts` — add `listStoreCategories`; ensure products return `category_id`.
- `src/routes/_authenticated/admin/settings.tsx` — Theme section.
- `src/routes/store/$slug/route.tsx` — themed sticky header w/ search context, footer, CSS-var injection.
- `src/routes/store/$slug/index.tsx` — category pills, client filter, use new ProductCard.
- `src/components/storefront/ProductCard.tsx` (new).
- `src/components/storefront/StoreFooter.tsx` (new).

No new routes, no new pages, no extra runtime deps.