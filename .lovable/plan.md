
## Goal

Bring the Global Store Template (Winner Admin → Store Template) to parity with the Store Admin uploader UX, and expand the default product schema to match a full product form.

## Current state (verified)

- `src/routes/_authenticated/owner/store-template.tsx` uses plain "Image URL" text inputs for banners, no image for categories, and a minimal product shape (name, price, stock, image_url, category_name, description).
- `src/components/admin/ImageUploader.tsx` and `GalleryUploader.tsx` already implement the desired upload flow (drag/click, preview, replace/remove, gallery reorder), but hardcode a `storeId` folder in the private `store-assets` bucket.
- Template data ships to new stores via `seedStoreFromTemplate` in `src/lib/store-template.ts`, which reads `p.image_url`/`p.images` and passes them to `products`/`banners` rows. New product columns beyond the current seed are not yet propagated.

## Storage strategy

Reuse the existing `store-assets` private bucket with a reserved prefix `_template/` for all template media (banners, categories, products, gallery). Rendered via the existing `/api/img/{path}` proxy — no bucket-visibility changes.

Add a storage RLS policy on `storage.objects` allowing the `owner` role (via `public.has_role`) to `INSERT/UPDATE/DELETE/SELECT` objects under `bucket_id = 'store-assets'` where `name LIKE '_template/%'`. Store owners' existing per-store-id policies stay untouched.

## Uploader reuse

Generalize the two uploaders to accept an arbitrary folder prefix instead of only `storeId`:

- `ImageUploader` / `GalleryUploader`: accept a new optional `folder` prop (default derived from `storeId` for backward compatibility). Internally build `${folder}/{timestamp}-{rand}.{ext}`.
- All existing call sites keep working (they pass `storeId`, which becomes the folder).
- Template page passes `folder="_template"`.

## Template page rewrite (`store-template.tsx`)

### Banners tab
Replace the URL text input row with a card containing:
- `ImageUploader` (folder `_template`) bound to `image_url`
- Link input, sort order input, delete button
- "Add banner" button appends `{ image_url: "", link_url: "", sort_order }`

### Categories tab
Each row becomes a card:
- Category Name (existing)
- `ImageUploader` bound to a new `image_url` field
- Optional description (textarea)
- Remove button
- Extend `TemplateForm.categories` to `{ name; image_url?; description? }`

### Products tab
Replace the minimal card with a collapsible accordion per product (title = product name) containing tabbed sections:

1. **Basic** — name, slug (auto-suggested from name, editable), short_description, description, sku, brand, category_name, subcategory_name, tags (comma-separated → string[])
2. **Images** — `ImageUploader` for main image (`image_url`), `GalleryUploader` for `gallery` (folder `_template`)
3. **Pricing** — price (regular), sale_price, cost_price, discount_type (`percent`/`fixed`), discount_value
4. **Inventory** — stock, low_stock_alert, unlimited_stock (bool), status (`active`/`draft`)
5. **Variants** — dynamic list of attribute rows `{ name; values: string[] }` with defaults size/color/model/storage/ram + free-form add
6. **Shipping** — weight, length, width, height, free_shipping (bool)
7. **Media** — youtube_url, video_url (`ImageUploader`-style upload button, but accept mp4 — see note below)
8. **SEO** — meta_title, meta_description, seo_image (`ImageUploader`)
9. **Visibility** — featured, new_arrival, best_seller, visibility (`published`/`draft`/`hidden`)

Expand `TemplateForm.products` element to a superset that covers all fields; keep everything optional so old templates still load.

Video upload note: reuse `ImageUploader` code path but with a `accept="video/*"` variant — implement as a light `FileUploader` component sharing the same code, or add an `accept`/`maxBytes` prop to `ImageUploader`. Recommend: extract shared logic into `FileUploader` and have `ImageUploader` wrap it with `accept="image/*"`.

### Client-side image compression
Add a small helper `src/lib/compress-image.ts` (canvas-based resize to max 1920px longest edge, JPEG q=0.82) invoked in `ImageUploader`/`GalleryUploader` before upload for files >500 KB and mime type starting with `image/`. Preserve PNGs with transparency (skip compression when PNG and <2 MB, or detect alpha and keep PNG). Show an upload progress state (already shows "Uploading…"; add per-file progress in `GalleryUploader`).

### Seeder update (`src/lib/store-template.ts`)
Extend `seedStoreFromTemplate` to map the expanded template product fields onto the `products` insert:
- Copy new columns that already exist on `public.products` as-is (sale/cost price if columns exist; otherwise ignore).
- For fields with no matching column (variants, brand, tags, shipping dims, videos, SEO), stash them into an existing JSON column on `products` (e.g. `meta` / `product_defaults`) — if no such column exists, add one via a small migration `ALTER TABLE public.products ADD COLUMN meta jsonb DEFAULT '{}'::jsonb`. Confirmation of `products` schema will drive the exact mapping during build.
- Categories seed uses new `image_url`/`description` (extend `categories` insert if those columns exist; if not, use the existing category migration already done for admin categories, which added `image_url`, `description`, `sort_order`, `is_active`).

Products schema audit will run in build mode via `supabase--read_query` before writing the seeder changes, so we only reference columns that exist.

### Save/load
- `updateStoreTemplate` in `owner.functions.ts` currently accepts the whole form as `data`; loosen its Zod validator (or ensure it uses `passthrough`) so the new fields flow through into the `store_template` JSON columns. Verify during build.

## Files to touch

- `src/components/admin/ImageUploader.tsx` — add optional `folder` prop, image-compression call, optional `accept`/`maxBytes`.
- `src/components/admin/GalleryUploader.tsx` — same `folder` prop, per-file progress, compression.
- `src/lib/compress-image.ts` — new helper.
- `src/routes/_authenticated/owner/store-template.tsx` — full rewrite of Banners/Categories/Products tabs, expand `TemplateForm`.
- `src/lib/store-template.ts` — extend seeder to propagate new fields.
- `src/lib/owner.functions.ts` — verify/loosen `updateStoreTemplate` input schema.
- Migration: (a) storage RLS policy allowing owners to manage objects under `store-assets/_template/*`; (b) optional `products.meta jsonb` column if not already present; (c) optional `categories.image_url/description/sort_order/is_active` if missing (admin change may have already added these — will verify).

## Out of scope

- Changing the storefront rendering of new product fields (variants UI, video player). This plan only ensures the fields are captured on the template and copied to new stores; storefront UI upgrades can follow.
- Retroactively re-seeding existing stores — the existing "Reset to Default Template" button already handles that.
