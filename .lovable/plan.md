## Goal
Fix product image upload, add multi-image gallery, add category selection, and add discount price on the Add/Edit Product form.

## Changes

### 1. Fix image upload (`src/components/admin/ImageUploader.tsx`)
- Add proper error surfacing: log the Supabase error code and show a clear toast (current `error.message` from storage may be empty for permission errors).
- Add client-side validation: max 5 MB, image MIME check.
- Sanitize filename extension (strip query/dot edge cases).
- Show upload progress state more clearly.

If the underlying cause is RLS, the new error message will reveal it; the existing policy already allows the signed-in store owner to write into `{storeId}/...`, so the upload path used by the component is correct.

### 2. Multi-image gallery uploader
- New component `src/components/admin/GalleryUploader.tsx`: upload up to 5 additional images, reorder (move up/down), remove. Stores array of storage paths in `products.gallery` (column already exists).
- Wire into the Product dialog alongside the primary image uploader.

### 3. Category selection
- Categories table already exists. Add server functions in `src/lib/admin.functions.ts`:
  - `listMyCategories` — list categories for the current store.
  - `upsertCategory` / `deleteCategory` — manage categories.
- Add inline category picker in the Product dialog with a "+ New category" quick-add (name only).
- New admin page `src/routes/_authenticated/admin/categories.tsx` for full CRUD and a sidebar link.
- Save `category_id` on the product (column already exists; extend `productSchema` and the upsert handler).

### 4. Discount support
- `products.old_price` already exists. Rename the form field UX to "Discount":
  - Inputs: **Regular price** and **Discount price** (optional). If discount price is set and less than regular, storefront shows the strike-through.
  - Add a small computed badge in the dialog showing the discount percentage.
- Storefront product card / product page already reads `old_price`; verify and adjust labels so the discounted price is the active selling price (swap mapping: `price` = selling price, `old_price` = original). Keep DB columns unchanged to avoid a migration; only adjust labels and the form so "Discount price" maps to `price` and "Regular price" maps to `old_price`.

### 5. Minor
- Add the "Categories" link to the admin sidebar in `src/routes/_authenticated/admin/route.tsx`.

## Technical notes
- No DB migration needed — `gallery`, `category_id`, and `old_price` already exist on `products`, and `categories` table is in place.
- Image proxy `/api/img/...` already serves uploaded paths, used for previews.
- All new server functions use `requireSupabaseAuth` and scope by the caller's store, matching existing patterns.