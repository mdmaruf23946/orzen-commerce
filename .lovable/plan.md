## Goal

Give Service products their own checkout, completely separate from Physical, Digital and Subscription. No address, no delivery zone, no courier, no shipping math, no COD. Instead: package selection, admin-defined project requirement fields, file uploads, communication preferences, advance/full payment, terms acceptance, and a service-specific thank-you page.

Today `src/routes/store/$slug/checkout.tsx` branches to `DigitalCheckout` for digital-only carts and falls back to the physical form for everything else — so service carts currently get the physical layout (address, zones, COD). That branch is the entry point for this work.

## Phase 1 — Data layer

- Migration adding:
  - `service_checkout_settings` (per store): required/optional field toggles, allowed payment methods + default, payment mode (`full` | `advance` | `advance_required`) and minimum advance %, terms visibility + policy links, upload limits (max size, max files, allowed extensions), auto vs manual confirmation, auto invoice, notification channels (email/SMS/WhatsApp), thank-you message, internal staff notes template, order tags.
  - `service_intake_fields` (per store, ordered): label, key, type (`short_text`, `long_text`, `dropdown`, `radio`, `checkbox`, `date`, `url`, `number`, `file`, `files`), options, placeholder/help, required flag, visible flag, sort order.
  - `service_order_files`: order id, store id, storage path, filename, mime, size.
  - Storage bucket `service-uploads` (private) with per-store path policies.
  - GRANTs + RLS on every new table (store owner full access, anon read only for the public settings/fields needed at checkout).
- Package + add-on data already lives in the service product's `meta.service` (`addons`, delivery time, pricing type). Extend `service-meta.ts` with an optional `packages` array (Starter / Standard / Premium: name, price, delivery time, revisions, summary, features) and surface it in the existing 12-step Service product form (new "Packages" step) so multi-package services are possible; single-price services keep working unchanged.

## Phase 2 — Store Admin settings

- New admin page **Service Checkout** (under the Service scope of the admin panel) with sections: Customer fields, Project requirement builder (drag to reorder, add/edit/hide/require), File upload rules, Payment methods & advance rules, Terms & policies, Confirmation/invoice/notification behaviour, Thank-you message, Tags & staff notes.
- Server functions in a new `src/lib/service-checkout.functions.ts` for reading/writing settings and intake fields (owner-authenticated), plus a public read used by the storefront.

## Phase 3 — Storefront Service Checkout

- New `src/components/storefront/checkout/ServiceCheckout.tsx`, mounted from `checkout.tsx` when every cart item is a service (mirroring the existing digital branch).
- Sections, in order: Service summary (image, name, package selector when packages exist, price, delivery time, revisions, summary) → Customer info (name, mobile, email required; company, website, business name, country, preferred language optional per settings) → Project requirements (rendered from the admin-defined fields with validation) → File upload (validated against admin limits, uploaded to the private bucket) → Communication preferences (channel + preferred time) → Coupon → Payment method (only admin-enabled methods; full vs advance amount shown) → Terms checkboxes → "Continue to Payment".
- Quantity selector hidden unless the service explicitly allows quantity.
- Mobile-first layout consistent with the digital checkout styling.

## Phase 4 — Order processing

- Extend `placeOrder` in `src/lib/storefront.functions.ts` for `orderType === "service"`: skip address/zone/shipping entirely, accept `service` payload (package, intake answers, uploaded file refs, communication prefs, advance amount), persist it in `orders.fulfillment_meta.service`, compute total from trusted product/package/add-on prices server-side (never client prices), and set order status from the store's confirmation rule (auto or manual).
- Reject COD for service orders; support partial advance by charging the advance amount through the gateway and recording the outstanding balance on the order.
- On success: create the service order, generate the invoice via the existing invoice pipeline, write the payment record, link/create the customer account, and fire owner + customer notifications through the existing notification service.

## Phase 5 — Thank-you page & admin visibility

- Service-specific success view on `src/routes/store/$slug/order.$orderId.tsx` (or a dedicated component) showing payment status, order ID, invoice number, service, package, delivery time, assigned status; buttons for View Order, Download Invoice, Dashboard, Contact Support, Continue Shopping.
- Service order cards in the admin Orders page (already type-aware via `TypeOrderCards.tsx`) gain the intake answers, uploaded files (signed download links), communication preferences and advance/balance figures.

## Technical notes

- Isolation is enforced by branching on cart product type before any shared form renders, and by keeping all service logic in service-only modules and an `orders.fulfillment_meta.service` namespace — the physical, digital and subscription paths are untouched.
- All pricing, advance calculation and coupon application are recomputed server-side inside `placeOrder`; client values are display-only.
- Uploads go to a private bucket; admin access is via short-lived signed URLs.
- SMS/WhatsApp notifications hook into the existing communication settings; if a channel has no provider configured, it is skipped silently and shown as unavailable in admin settings.
