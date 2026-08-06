# Product Defaults Page Redesign

Turn Product Defaults into a clean, card-based page that holds only global defaults applied when a new product is created — with no settings that already live in another module.

## Removed

- Default Shipping Information field. Shipping text/rules come from the Shipping & Delivery module only; new products no longer prefill a shipping paragraph from this page, and the old saved value is dropped from the defaults payload.

## Kept / new defaults

1. Default Warranty — prefilled into new Physical products.
2. Default Return Policy — prefilled into new Physical products.
3. Default Description Footer — appended to the description of every new product (any type); editable/removable per product.
4. Default Product Tags — comma-separated SEO/search keywords prefilled into the product SEO keywords field.
5. Default Visibility — Public / Draft / Hidden (default Public).
6. Default Status — Active / Inactive (default Active).
7. Default Tax — not shown. There is no global tax module in the project today, so per the spec this option stays hidden; the field is wired to appear automatically if a tax setting is added later.

## Product-type awareness

A type switcher (Physical / Digital / Service / Subscription) at the top of the page. Warranty and Return Policy cards render only for Physical. Description Footer, Tags, Visibility and Status render for all four types and are stored per type, so each product type can have its own footer/tags/visibility/status defaults while sharing one page.

## Applying defaults on product creation

- Physical form: warranty and return policy prefill as today (minus shipping info); footer appended to description; tags into SEO keywords; visibility/status preselected.
- Digital / Service / Subscription forms: footer, tags, visibility, status only — no warranty/return-policy prefill.
- Defaults apply only on create, never on edit, so per-product overrides are never overwritten.

## UI

Modern card layout, one card per setting with a short helper line, mobile-first single column, dirty-state indicator ("Unsaved changes" / "All changes saved"), a Save Changes button, and a success toast.

## Technical notes

- `product_defaults` (jsonb on `stores`) gets a new shape: `{ per_type: { physical|digital|service|subscription: { footer, tags, visibility, status, warranty?, return_policy? } } }`, with a read-time migration that maps existing flat `warranty` / `return_policy` into the physical bucket and discards `shipping_info`. No database migration needed.
- `updateProductDefaults` in `src/lib/admin.functions.ts`: replace `productDefaultsSchema` with the new nested schema.
- `src/routes/_authenticated/admin/product-defaults.tsx`: rewritten as a dedicated page (no longer using the generic `SettingsPage` wrapper) with the type switcher and cards.
- `ProductDialog.tsx`, digital/service/subscription dialogs: read defaults through a single shared helper (`src/lib/product-defaults.ts`) that resolves the bucket for the current product type and returns prefill values; drop `shipping_info` prefill.
- Visibility is stored in `meta.visibility`; status maps to the existing `product_status` enum (Active → `active`, Inactive → `draft`); Hidden sets `status: draft` plus `meta.visibility: hidden`.

## Verification

- Creating each product type prefills exactly the fields listed for that type.
- No shipping-info prefill anywhere; shipping stays in its own module.
- Editing an existing product is unaffected by defaults.
- Typecheck passes.
