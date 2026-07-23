## Goal

Upgrade the existing Add/Edit Product dialog in `src/routes/_authenticated/admin/products.tsx` into a professional, tabbed product manager without removing any existing field or behavior. All current columns (`name`, `price`, `old_price`, `cost_price`, `stock`, `sku`, `product_code`, `brand`, `category_id`, `gallery`, `primary_image_url`, `variants`, `specifications`, `features`, `meta`, `video_url`, `status`, `is_featured`, `warranty`, `return_policy`, `shipping_info`, `low_stock_threshold`, `delivery_charge`, `delivery_time_days`, `related_product_ids`, `slug`, `short_description`, `description`) keep working exactly as before.

## Strategy: extend, don't replace

The `products` table already has `variants JSONB`, `specifications JSONB`, `meta JSONB`, `gallery JSONB`. New concepts ride inside these JSON blobs — no destructive schema change, no data migration.

- `meta` gains typed sub-keys: `product_type`, `subcategory_id`, `discount` `{type, value}`, `tax` `{rate, inclusive}`, `barcode`, `inventory_status`, `attributes[]`, `shipping` `{weight,l,w,h,type,rate}`, `purchase` `{cod, online, min_qty, max_qty}`, `labels[]`, `related` `{related[], fbt[], cross[], upsell[]}`, `seo` `{title, description, keywords, slug}`, `videos[]` (array of `{url, provider, primary}`), `visibility` `{scheduled_at}`, `ai_ready` (reserved flags, disabled).
- `variants` JSON schema becomes `{ options: [{name, values[]}], items: [{id, options:{}, sku, price, discount, stock, barcode, image}] }`. Existing flat variant data auto-migrates on load via a shim (`normalizeVariants()`).
- `specifications` continues to hold dynamic attributes (already supported).

## Database (one small migration)

- Add `parent_id` awareness already exists on categories → reuse for Main/Sub selection (no schema change).
- Add a helper GIN index on `products.meta` for future queries: `CREATE INDEX IF NOT EXISTS products_meta_gin ON public.products USING gin (meta jsonb_path_ops);`
- No column drops. No RLS change.

## Server functions (`src/lib/admin.functions.ts`)

- `upsertProduct` (existing) — extend Zod schema to accept the new `meta` shape and the richer `variants`/`videos`. Backward compatible: unknown keys pass through, missing keys default. SKU auto-generation stays server-side when blank.
- Add `generateSku(storeId, name)` helper (pure) used by client for the "Auto" button; server re-generates if omitted.
- No new endpoints for images — reuse existing `store-assets` bucket + `ImageUploader`/`GalleryUploader`. Add client-side crop/rotate/resize before upload (extends `src/lib/compress-image.ts` with `cropToAspect`, `rotate`, and multi-size output: thumb 200, medium 800, large 1600, all WebP when supported). The primary path stays the same; extra sizes are stored alongside as `path.thumb.webp` / `path.md.webp` / `path.lg.webp` and referenced from `meta.image_variants[path]`.

## UI — tabbed dialog (desktop) / accordion (mobile)

Rewrite the current form body in `products.tsx` as a tabbed shell (using the existing shadcn `Tabs`, wrapped in an `Accordion` under `md`). Tabs:

1. **General** — Name, Type (Physical/Digital/Service/Subscription), Main Category, Subcategory (filtered by parent), Brand, SKU (auto+manual), Product Code, Short Description, Full Description (rich editor via lazy-loaded `@tiptap/react` — new dep, code-split).
2. **Media** — Drag-and-drop multi-upload built on `GalleryUploader`, reorder, star = primary, per-image crop dialog (`react-easy-crop`, lazy) with 1:1 / 4:5 / 16:9 / free presets + zoom/rotate. Auto-generates thumb/md/lg WebP on upload. Low-resolution warning (<800px longest edge). Video section: add YouTube/Facebook URL list with validation regex + embed preview; primary video selector. No file upload for video.
3. **Pricing** — Regular, Discount Type (percent/fixed), Discount Value → computed Discount Price (read-only), Cost Price, Auto Profit (read-only), Tax rate/inclusive.
4. **Inventory** — Stock management toggle, Quantity, Low Stock Alert, Inventory Status (In Stock / Out of Stock / Pre-Order), Barcode, SKU mirror.
5. **Variants** — Dynamic option builder (add option → add values), auto-generated variant matrix table with per-row image, SKU, price, discount, stock, barcode. Unlimited options/values.
6. **Attributes** — Free-form key/value list persisted to `specifications` (already supported); add/remove rows.
7. **Shipping** — Weight, L/W/H, Shipping Type (Free / Fixed / Calculated) + rate when fixed.
8. **Purchase** — COD toggle, Online payment toggle, Min/Max purchase qty.
9. **Visibility & Labels** — Status (Draft/Active/Hidden) + Scheduled publish datetime; label chips (Featured, Best Seller, New Arrival, Hot, Sale, Limited Stock). Existing `is_featured` bool kept in sync with the "Featured" chip.
10. **Related** — Four product multi-selects (Related / FBT / Cross-sell / Upsell) using existing product search.
11. **SEO** — Title, Meta Description, Keywords, URL Slug (mirrors existing `slug`).
12. **AI (Coming Soon)** — Four disabled toggles with tooltip.

Everything lives in the same dialog. Tabs on `md+`, accordion on mobile. Lazy-load Media, Variants, Related, and the rich editor via `React.lazy` so the initial dialog stays light.

## Layout / design

Reuse existing tokens, spacing, and shadcn components. No new global CSS. Sticky footer with Save/Cancel remains. Existing table view, filters, and pagination untouched.

## Performance

- Tiptap editor, `react-easy-crop`, and heavy tabs are `React.lazy` + `Suspense`.
- Image processing runs in the browser via `OffscreenCanvas` (already used in `compress-image.ts`); multi-size generation reuses one decode.
- No extra list queries; category, product, and variant data comes from the queries already loaded on this page.

## New dependencies

- `@tiptap/react` + `@tiptap/starter-kit` — rich text (lazy).
- `react-easy-crop` — crop UI (lazy).

## Non-goals

- No AI implementation (structure reserved only).
- No new routes or pages.
- No changes to storefront rendering beyond reading fields it already reads (extra `meta` keys are ignored safely).
- No removal of any existing field, column, or workflow.

## Technical notes

- All new form state lives in one `useReducer` to keep re-renders local per tab.
- Zod schema on submit validates the enriched payload; unknown keys are stripped before insert to match existing column shape (`meta` catches everything new).
- Variant matrix generator is a pure function `buildMatrix(options)` — tested inline.
- Image variant paths are deterministic (`<orig>.thumb.webp` etc.) so storefront can opt-in later without another migration.
