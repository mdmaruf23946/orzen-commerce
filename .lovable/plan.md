## Goal

Upgrade only the Product Add/Edit dialog (`ProductDialog.tsx`) so that choosing **Digital** switches the form to a digital-product layout. Physical stays byte-for-byte the same. No changes to Orders, Checkout, Inventory, Courier, Payments, or Store Design.

## Where things stand (verified)

- The form already has a Product Type selector (Physical / Digital / Service / Subscription), defaulting to Physical.
- The form is a step wizard with tabs: General, Media, Pricing, Inventory, Variants, Attributes, Shipping, Purchase, Visibility & Labels, Related, SEO, AI.
- `product_type` is already accepted and saved by `upsertProduct`, and the product row has a free-form `meta` JSON column that the form already writes structured sections into (`shipping`, `purchase`, `seo`, `videos`, …).

## Approach

All new digital data is stored inside the existing `products.meta` JSON under a new `meta.digital` key. No migration, no API change, full backward compatibility. Files upload to the existing private `store-assets` bucket through the existing uploader components.

### 1. Product Type selector
- Relabel the two future options as **Subscription (Coming Soon)** and **Service (Coming Soon)** and make them non-selectable; keep Physical as default.

### 2. Conditional tabs (no reload, smooth transition)
When type is Digital the wizard shows:

```text
General → Media → Digital Files → File Info → Download Settings → Pricing → Visibility & Labels → SEO
```

Hidden (not deleted) for Digital: Inventory (stock qty), Variants, Attributes, Shipping, Purchase (COD / delivery charge), and the weight/dimension fields.
Physical keeps its exact current tab list. Switching types only re-derives the tab array, so every state value already typed stays in memory until save.

### 3. New tab — Digital Files
- Multi-file uploader (reuses the existing upload path, `accept` widened to pdf, zip, rar, mp4, mp3, png, jpg, psd, ai, fig, docx, xlsx, pptx, apk, exe, source archives).
- Alternative **External download URL** field.
- Clean list of uploaded files showing file name, size, type, and a remove button.

### 4. New tab — File Information
Version, Changelog (multiline), Compatible platforms (multi-select chips: Windows, macOS, Android, iOS, Web).

### 5. New tab — Download Settings
Delivery mode (Instant download / Manual approval), Max download limit, Download expiry (days), Allow re-download toggle.

### 6. Pricing for Digital
Existing pricing block reused, plus a **Free product** toggle (zeroes price and skips price validation) and a limited-time discount window (start/end datetime). Sale price already exists.

### 7. Media for Digital
Existing thumbnail + gallery + video URL, plus optional Preview images and Demo URL fields.

### 8. Validation (Digital only)
Require: name, category, thumbnail, at least one digital file **or** an external URL, and a price unless Free is on. Physical validation untouched.

### 9. Save payload
Physical: unchanged. Digital: same top-level columns as today (stock forced to 0, shipping/purchase meta left as-is) plus `meta.digital = { files, external_url, version, changelog, platforms, download: {...}, preview: {...}, free }`.

## Technical notes

- Files touched: `src/components/admin/product-form/ProductDialog.tsx`, plus two small new components under `src/components/admin/product-form/` (`DigitalFilesUploader.tsx` and shared digital field cards) to keep the dialog file manageable.
- No database migration, no server-function signature change; `meta` is already a permissive JSON field on `upsertProduct`.
- Sections rendered as collapsible cards with clear titles, mobile-first spacing consistent with the current dialog.
