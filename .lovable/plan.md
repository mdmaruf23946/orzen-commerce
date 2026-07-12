## Storefront Homepage Redesign — ORZEN

Redesign `/store/$slug` into a premium, single-page eCommerce homepage. Everything stays on one route (`src/routes/store/$slug/index.tsx`) + shell (`src/routes/store/$slug/route.tsx`). No new pages. No client-heavy libraries.

### 1. Schema (one small migration)

Add a featured flag to products:

```sql
ALTER TABLE public.products ADD COLUMN is_featured boolean NOT NULL DEFAULT false;
CREATE INDEX products_store_featured_idx ON public.products (store_id) WHERE is_featured;
```

No GRANT / RLS changes (column added to existing table; existing policies apply).

### 2. Server functions (`src/lib/storefront.functions.ts`)

- Extend `listStoreProducts` return to include `is_featured`.
- Add `listBestSellingProducts({ storeId, limit=12 })`: aggregate `order_items.qty` for the store's confirmed/processing/shipped/delivered orders, join to `products`, filter `status != 'draft'`, order by total qty desc, limit 12. Returns the same product shape as `listStoreProducts` (id, name, price, old_price, stock, primary_image_url, category_id).

Admin toggle on Featured: extend existing product save/update in `src/lib/admin.functions.ts` + a "Featured" switch in `src/routes/_authenticated/admin/products.tsx` (single checkbox, minimal UI change).

### 3. Shell tweaks — `src/routes/store/$slug/route.tsx`

- Header: keep sticky, compact. Add mobile hamburger that opens a lightweight drop-panel (pure CSS + `useState`) with Home / Cart / Contact / Policies anchors. Desktop unchanged.
- Footer: expand to include Logo, Name, Phone, Email, and the three policy links (Privacy / Terms / Return) as in-page anchors (`#privacy`, `#terms`, `#returns`) already present. No new routes.
- Floating chat launcher: upgrade `AIChatLauncher` — when `store.facebook` or a `messenger_url` exists, the FAB expands into a two-item mini-menu (AI Chat, Messenger); otherwise stays single-button. All lazy-loaded, no extra deps.

### 4. Homepage layout — `src/routes/store/$slug/index.tsx`

Sections in this exact order, all client-side filterable, single page:

1. **Hero banner slider** — reuse existing `BannerCarousel`; add touch swipe via native `pointerdown/move/up` (~30 lines, no library). Keep 4s auto-advance, respect `prefers-reduced-motion`.
2. **Category strip** — horizontal `overflow-x-auto snap-x` row of pill chips with lucide icon + name; first pill is "All". Selecting sets `activeCat` state and scrolls to `#products`.
3. **Featured Products ⭐** — grid of up to 12 products where `is_featured=true`. Section hidden if empty. Header row shows title + "View All" button that clears filters + scrolls to All Products.
4. **Best Selling 🔥** — grid of up to 12 from `listBestSellingProducts`. Section hidden if empty. Same "View All" behavior.
5. **All Products** — id=`products`. Renders `filtered` (search + category). Client-side "Load More" (initial 12, +12 per click). No in-section search — uses header search via `useStoreUI`.

All three product grids share the redesigned `ProductCard`.

### 5. ProductCard redesign — `src/components/storefront/ProductCard.tsx`

Fixed-height card, white surface (no title-bar background), soft shadow, rounded-2xl:

- Square image, `loading="lazy"`, `decoding="async"`.
- Discount badge (top-left) when `old_price > price`: `-XX%`.
- Out-of-stock badge (top-right) when `stock <= 0`.
- Body: name (2-line clamp), price row (current bold + old strikethrough), stock status text.
- Two buttons always visible at bottom: outline "Add to Cart" + filled "Buy Now". Disabled when out of stock. Uses `--store-btn-bg` for brand color.
- Equal heights via `flex flex-col` + `mt-auto` on button row.

Rating is optional per spec — omitted (no ratings table exists; adding one is out of scope).

### 6. Data loading

Loader in `index.tsx` prefetches: store, banners, categories, products, best-selling — all via `queryClient.ensureQueryData` in parallel. `useSuspenseQuery` in the component. Stale time 5min. No `useEffect` fetches.

### 7. Performance guardrails

- No new npm deps.
- Icons: only lucide icons already imported.
- Images: `loading="lazy"` + `decoding="async"` on all product/banner images except the first banner (`fetchPriority="high"`).
- Slider: CSS transform, `setInterval`, cleared on unmount; touch via native pointer events.
- Category filter: pure `useMemo`, no route change.
- Load More: local `useState` count; no refetch.

### 8. Files touched

- Migration: add `is_featured` column
- `src/lib/storefront.functions.ts` — extend product select, add `listBestSellingProducts`
- `src/lib/admin.functions.ts` — accept `is_featured` in product create/update
- `src/routes/_authenticated/admin/products.tsx` — add Featured toggle
- `src/routes/store/$slug/route.tsx` — mobile menu, footer additions, launcher wiring
- `src/routes/store/$slug/index.tsx` — new homepage layout
- `src/components/storefront/ProductCard.tsx` — redesign
- `src/components/storefront/AIChatLauncher.tsx` — optional Messenger action

No new routes. No new pages. No new dependencies.
