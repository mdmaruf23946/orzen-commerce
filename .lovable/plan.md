# Store Icon + Favicon Management System

Adds a dedicated per-store square identity icon that also drives the storefront favicon, on top of the existing `stores.logo_url` (wordmark/logo) and `seo.favicon_url` fields.

## 1. Database

Migration on `public.stores`:
- Add `icon_url text` — square store icon (512×512 preferred).
- Add `favicon_url text` — resolved favicon (mirrors `icon_url` when auto mode).
- Add `use_icon_as_favicon boolean not null default true`.
- Add `custom_favicon_url text` — optional separate favicon upload.

No new table — extends the existing `stores` row, matching the current architecture. Existing RLS on `stores` (owner-only update) already enforces tenant isolation. `get_public_store_by_slug` RPC is extended to return the four new fields for public storefront rendering.

Do **not** touch `platform_branding` (ORZEN global) or `branding` jsonb.

## 2. Storage

Reuse existing `store-assets` bucket. Path convention:
```
stores/{store_id}/branding/icon-{timestamp}.{ext}
stores/{store_id}/branding/favicon-{timestamp}.{ext}
```
Timestamp suffix busts CDN/browser cache on replace. Existing storage RLS already scopes writes to `{store_id}/…` for the store owner.

## 3. Upload + Crop UI

New component `src/components/admin/StoreIconUploader.tsx`:
- Accepts PNG/JPG/WebP (SVG rejected for safety).
- Max 2 MB, validates square-ish aspect, warns if <256px.
- Opens a crop dialog using the existing `react-easy-crop` pattern from `src/components/admin/product-form/CropDialog.tsx` — locked 1:1 aspect, zoom slider.
- Compresses via existing `src/lib/compress-image.ts` to 512×512 WebP before upload.
- Uploads to Supabase Storage, returns the public URL.

## 4. Store Settings Section

In `src/routes/_authenticated/admin/settings.tsx`, add a new `Store Icon` section (icon: `ImageIcon`) placed after Store Identity:

- **Store Icon card**: current icon preview (square, 96×96), file name, `Upload / Replace / Remove` buttons. Remove button opens an `AlertDialog` confirmation. Fallback message when unset: "Using Default Store Icon" showing platform default.
- **Favicon card**:
  - Switch `Use Store Icon as Favicon` (default ON) → hides custom uploader.
  - When OFF, show custom favicon uploader (PNG/ICO/WebP, ≤512 KB).
- **Live Preview panel** (3 mini previews, updates on state change):
  1. Store Admin identity — `[icon] Store Name / Store`
  2. Browser tab — rounded rect with icon + store name
  3. Storefront header — `[icon] Store Name`
  Rendered on both light and dark backgrounds.

Save uses the existing sticky bar + inline save via `updateMyStore`.

## 5. Server function updates

`src/lib/admin.functions.ts` → extend `updateMyStore` Zod schema and update payload with:
`icon_url`, `favicon_url`, `use_icon_as_favicon`, `custom_favicon_url`.

Server also computes `favicon_url` on save:
- if `use_icon_as_favicon` → `favicon_url = icon_url`
- else → `favicon_url = custom_favicon_url || icon_url || null`

## 6. Fallback resolver

New helper `src/lib/store-icon.ts` exporting `resolveStoreIcon(store, platformBranding)` and `resolveStoreFavicon(store, platformBranding)` implementing the spec's priority (store icon → platform default → 'O' letter mark).

## 7. Store Admin sidebar/header

`src/routes/_authenticated/admin/route.tsx`: below the existing `<StoreBrandMark>` (ORZEN, unchanged), render a new store identity row using the resolver:
```
[Store Icon] Store Name
             Store
```
No duplicate ORZEN icon.

## 8. Storefront injection

`src/routes/store/$slug/route.tsx` `head()`:
- Compute favicon from `store.favicon_url ?? store.icon_url ?? store.seo?.favicon_url`.
- Emit `<link rel="icon">`, `<link rel="apple-touch-icon">`, `<meta name="theme-color">`.
- Also update `StoreHeader` to use `icon_url` (fallback to `logo_url`) beside the store name.

Store-scoped, so Store A never shows Store B's icon.

## 9. Winner Admin visibility

`src/routes/_authenticated/owner/…` stores list (existing): add `icon_url` column with thumbnail + "custom favicon" badge. Read-only.

## 10. Cache invalidation

- Upload paths carry a timestamp → new URL each replace.
- After save, invalidate `["admin","store"]` and `["store", slug]` React Query keys.
- Storefront `<link rel="icon">` re-renders per store because head is per-route.

## Technical notes

- No new tables, no changes to `platform_branding`, `branding` jsonb, or `seo.favicon_url` (kept as legacy fallback and still honored in the resolver).
- SVG intentionally excluded to avoid XSS via storage.
- Uses existing crop dialog, image compressor, `store-assets` bucket, and RLS — no security posture change.
- All wiring is additive; existing logo/wordmark flows are untouched.

## Files touched

- Migration (add 4 columns to `stores`; update `get_public_store_by_slug`).
- `src/lib/admin.functions.ts` — extend `updateMyStore`.
- `src/lib/store-icon.ts` — new resolver.
- `src/components/admin/StoreIconUploader.tsx` — new.
- `src/routes/_authenticated/admin/settings.tsx` — new sections + previews.
- `src/routes/_authenticated/admin/route.tsx` — store identity row under ORZEN mark.
- `src/routes/store/$slug/route.tsx` — favicon in `head()` + header icon.
- `src/lib/storefront.functions.ts` — pass new fields through `get_public_store_by_slug`.
- Owner stores list — add icon column.
