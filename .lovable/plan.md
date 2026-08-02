# Service Product Creation Form

Today a service is created through the shared `ProductDialog`, which just hides inventory/shipping/variants tabs and offers two service fields (booking type, delivery time) stored in `meta.service`. The upgrade is a dedicated Service form with its own 12 steps, rendered instead of the shared form whenever the product type is `service`.

## 1. Dedicated form

New `src/components/admin/product-form/service/ServiceProductDialog.tsx`, rendered by `products.tsx` (and edit actions) when the active type is `service`; the shared `ProductDialog` keeps handling physical/digital/subscription untouched.

It reuses the existing wizard shell, `Field`, `ImageUploader`, `GalleryUploader`, `RichTextEditor`, sonner toasts and the same `onSave` contract, so validation, saving and the ORZEN mobile-first look stay identical.

Repeatable-list UI (included items, requirements, deliverables, add-ons, FAQ) comes from one small shared `RepeatableList` component in the same folder.

## 2. Steps

1. **General** — name*, category*, subcategory, brand/provider, short + full description, thumbnail, gallery, intro video URL, status (draft/active)
2. **Pricing** — regular price, sale price, pricing type (fixed / starting from / hourly / daily / weekly / monthly / custom quote), enable discount, tax included, featured
3. **Delivery** — estimated delivery time + unit (hours/days/weeks), express delivery toggle + fee, availability (available / busy / fully booked / temporarily closed), max orders + period
4. **Service details** — Included services, Customer requirements, Deliverables (all unlimited repeatable)
5. **Booking & workflow** — booking type (instant / request first / appointment / manual approval); when appointment: working days, working hours, slot duration, buffer time
6. **Media** — featured image, gallery, portfolio images, before/after pairs, demo video
7. **Add-ons** — unlimited { name, price, description }
8. **FAQ** — unlimited { question, answer }
9. **SEO** — meta title, meta description, slug, keywords
10. **Visibility** — featured / best seller / recommended / new service switches, publish now or schedule
11. **Policies** — refund, cancellation, service terms, warranty
12. **Review** — read-only summary of every step, footer actions Save Draft / Preview / Publish Service

Custom-quote pricing hides price inputs and marks the product as quote-only. No physical, digital or subscription field appears anywhere in this form.

## 3. Data model

No migration. Everything lands in the existing `products` row: `name`, `description`, `short_description`, `price`, `old_price`, `category_id`, `image_url`, `gallery`, `status`, `product_type = 'service'`, plus a richer `meta.service` object holding pricing_type, delivery, availability, booking, included/requirements/deliverables, addons, faq, media, policies and visibility flags. `meta.seo` keeps using the existing shape so current SEO handling still works.

Stock/shipping/variant columns are never written for services.

## 4. Isolation and integration

- Category and subcategory dropdowns already receive only same-type categories via the global Product Type Scope; the form inherits that scope and stamps `product_type: "service"`.
- Because the row is a normal `products` row of type `service`, Service Orders, Coupons, Categories, Analytics and Search — all already scoped by `product_type` — pick it up with no extra work.
- The storefront PDP and AI assistant read the new `meta.service` keys; the AI Product Builder prompt/validator gains service-only output (name, descriptions, pricing type, included items, requirements, deliverables, FAQ, SEO) and is blocked from emitting physical/digital/subscription fields.

## Technical notes

- New files: `service/ServiceProductDialog.tsx`, `service/RepeatableList.tsx`, `service/steps/*.tsx` (one file per step group to keep files small).
- Edited: `src/routes/_authenticated/admin/products.tsx` (branch on type for create/edit), `src/lib/ai-product-builder.functions.ts` and `AIProductBuilderDialog.tsx` (service schema branch), `src/components/storefront` PDP service rendering for the new fields.
- `ProductDialog.tsx` loses only its now-dead service branch; physical/digital/subscription behaviour is unchanged.
