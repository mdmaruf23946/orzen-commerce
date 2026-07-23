## Goal

Every newly registered Store Admin lands on a **fully populated, production-quality demo store** (header, banner, 6 categories, 16 products, footer, legal pages) without touching anything. Winner Admin controls the master template; Store Admin can edit/delete freely after creation. Storefront stays a **single-page**, fast, dynamic experience.

## Current state (verified)

- `store_template` table + `get_store_template_for_seed` RPC exist.
- `src/lib/store-template.ts` already seeds categories, products, banners from the template.
- `createMyStoreWithSlug` in `src/lib/admin.functions.ts` calls the seeder on registration.
- `src/routes/_authenticated/owner/store-template.tsx` lets Winner Admin edit the template.
- Storefront `src/routes/store/$slug/index.tsx` is already single-page with client-side filtering + parallel loaders.
- Gaps: (a) template ships mostly empty out of the box, (b) no built-in "premium demo pack" (6 categories × 16 products with images, legal pages, footer info), (c) no "Reset / Update Existing Stores" bulk action for Winner Admin, (d) storefront has no visible Featured / New Arrival / Best Selling *sections*, only a single grid + best-selling row, (e) no skeleton loaders on the storefront.

## Plan

### 1. Premium Demo Content Pack (Winner-owned defaults)

- Add a seed migration that populates `store_template` with a full professional demo:
  - Store description, brand colors, footer text, contact placeholders.
  - **6 categories**: Fashion, Electronics, Beauty, Home & Living, Islamic, Sports (with hosted image URLs + sort order).
  - **16 products** spread across categories, each with: name, short + full description, price, old_price, discount, SKU, brand, stock, gallery (3 images from Unsplash/CDN), `featured`/`best_seller`/`new_arrival` flags.
  - Default legal pages (Privacy, Terms, Return, Shipping) stored on the template so `seedStoreFromTemplate` copies them into `store_legal_info` for the new store.
- Extend `seedStoreFromTemplate` in `src/lib/store-template.ts` to also seed `store_legal_info` from the template.

### 2. Winner Admin – Demo Store Manager

In `src/routes/_authenticated/owner/store-template.tsx`, add a top "Demo Store Manager" panel:

- **Publish to new stores** (already default) – shows last-updated timestamp.
- **Update existing demo stores** button → server fn `applyTemplateToAllStores({ mode: "reset" | "banner-only" | "missing-only" })`:
  - `banner-only`: replaces banners for stores that still match the previous template banner.
  - `missing-only`: seeds categories/products only for stores that currently have zero.
  - `reset`: wipes + reseeds (with confirm dialog).
- Add banner upload/replace/remove buttons wired to `store-assets` bucket, saved on the template.

### 3. Registration flow polish

- `createMyStoreWithSlug` already calls the seeder; add a fallback: if template fetch fails, still create the store with a minimal built-in seed (so the user never sees an empty store). Log the failure to `admin_notifications`.

### 4. Storefront – Single-Page Performance

`src/routes/store/$slug/index.tsx`:

- Split existing product grid into three horizontally-scrollable rails on the home view (when no category filter is active):
  - **Featured Products** (`is_featured = true`)
  - **New Arrivals** (latest 12 by `created_at`)
  - **Best Selling** (existing `bestSelling` query)
  - Below rails: "All Products" grid with existing category/search filtering (unchanged).
- Add `<img loading="lazy" decoding="async">` to `ProductCard` + banner.
- Replace the loader's `Promise.all` blocking with `ensureQueryData` for store + categories only; banners/products/best-selling become `prefetchQuery` so first paint is faster.
- Add lightweight skeleton components (banner + product-card skeletons) for the initial suspense fallback instead of a blank screen.
- No new routes. Product details and cart already exist and stay as-is (kept off critical path).

### 5. Store Admin editability (no change needed)

Existing product/category/banner editors already own the seeded rows after creation. No dependency on Winner Admin remains — call out in the plan, no code change.

## Technical details

- **Migration**: one migration to populate `store_template` row `'global'` with the demo JSON (categories, products, banners, legal pages) using stable Unsplash image URLs.
- **New server fn** `applyTemplateToAllStores` in `src/lib/owner.functions.ts`, admin-role gated via `has_role`, uses `supabaseAdmin` inside handler.
- **Seeder extension**: `seedStoreFromTemplate` gains a `legal` branch writing to `store_legal_info` (upsert by `store_id`).
- **Storefront rails**: pure client-side filtering off the existing `products` query — no new server fns, no new requests.
- **Skeletons**: new `src/components/storefront/Skeletons.tsx` (banner + card + rail).
- **Caching**: keep 5-min `staleTime`; add `gcTime: 30 * 60_000` so revisits are instant.

## Out of scope

- Cart/checkout redesign, product detail page changes, account pages.
- Multi-language demo variants.
- Auto-refreshing existing stores on every template edit (opt-in only via the new button).