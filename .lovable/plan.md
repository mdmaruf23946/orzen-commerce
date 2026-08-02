# ORZEN Digital Product Experience

## Current state (verified)

- Digital products already exist **only in the admin product form**: type + files + preview + download rules are saved into `products.meta.digital` (`ProductDialog.tsx`, `DigitalFilesUploader.tsx`).
- The storefront returns `meta` and `product_type`, but the product page (`store/$slug/product/$productId`) renders one physical layout for everything.
- Checkout always offers Cash on Delivery and the shipping/delivery block; there is no digital branch.
- There are **no** digital tables (no entitlements, downloads, licenses) — the earlier digital tables were dropped. Storage buckets `store-assets` and `digital-files` exist and are both private, so signed URLs are already the only way to serve files.

So this is mostly new build, not repair. It ships in 5 phases; each phase is usable on its own and the physical flow stays untouched.

## Phase 1 — Digital Product Details Page

New route-level branch: if `product_type === 'digital'`, render `DigitalProductPage` instead of the physical PDP. Same ORZEN design language, digital-specific components under `src/components/storefront/pdp/digital/`.

Sections, in order:

1. **Hero** — cover + gallery on the left; title, category, rating, review count, creator/brand, version, last updated, file size, license type as a meta strip. Right rail: price, old price, discount badge, Add to Cart, Buy Now, and Secure Payment / Instant Access / Lifetime Access badges.
2. **Preview** — driven by seller config: image slider, YouTube/Vimeo embed, PDF embed, audio player, live demo / external demo link.
3. **Description** — existing sanitized rich text (images, video, tables, lists) reused.
4. **What's Included** — icon list (ZIP, PDF, source code, PSD, Figma, Canva, video, audio, templates, fonts, license, docs, bonus).
5. **System Requirements** — optional table (OS, software version, browser, RAM, storage, dependencies).
6. **License Information** — Personal / Commercial / Extended / Custom.
7. **FAQ** — unlimited, accordion.
8. **Reviews** — verified purchases only, stars, images, seller replies, sorting.
9. **Related Products** — same category, existing rail.

Product cards stay exactly as they are: thumbnail, title, rating, category, price, sale price, stock status (Unlimited / Limited), wishlist, Add to Cart, Buy Now — no download/access buttons anywhere before payment.

## Phase 2 — Admin fields behind the new page

Extend the digital tabs in the product form so a seller can actually fill everything above: preview type + sources, What's Included picker, system requirements, license type, FAQ repeater, version + changelog, SEO, visibility, and the download rules (unlimited/limited, expiry date, link expiration, max devices, max IP, max activations, require login, auto email/invoice/delivery). Stored as an extended `meta.digital` shape, backward compatible with what is already saved.

## Phase 3 — Digital checkout

- Cart is scanned by product type. Any digital line ⇒ COD is removed from the payment list; an all-digital cart also hides shipping address, district, courier and delivery charge, and forces delivery cost to zero **server-side** as well as in the UI.
- Mixed cart keeps the full physical form but still hides COD.
- Remaining methods: Stripe, SSLCommerz, bKash, Nagad, Rocket, card, PayPal — whatever the store has enabled.

## Phase 4 — Delivery, entitlements, downloads

New tables (grants + RLS + `updated_at` triggers): `digital_entitlements` (order, customer, product, expiry, max downloads, counter, status), `digital_downloads` (per-hit log with IP, device, timestamp), `digital_licenses` (key, type, activation count, max activations).

On successful payment: order created → invoice generated → entitlements + license granted → delivery email sent → success screen with instant access.

Downloads are served by a server function that verifies the entitlement, enforces limits/expiry/devices/IPs, logs the hit and returns a short-lived signed URL. Original paths are never exposed to the client; no direct-link access.

## Phase 5 — Customer surfaces

- Order page: purchased products, order ID, purchase date, payment status, license, download count, latest version, download button, invoice.
- Account: new tabs for Downloads, Licenses, Invoices, Updates — alongside existing orders, wishlist, reviews.

## Technical notes

- Digital files move to the private `digital-files` bucket; access only through the signed-URL server function.
- Public product reads never expose file paths or license keys — the storefront product payload strips `meta.digital.files` and returns only presentation data.
- No existing route is renamed; digital behaviour is additive and gated on `product_type`.

## Out of scope for now

Watermarking of delivered files, and Subscription / Service product types (they stay "Coming Soon").
