# Digital Store Mode

Extend ORZEN with a Digital Store Mode without creating a second dashboard. Same admin panel, same database, same routes, same payment/order engine — digital capability is layered on top and switched on by a single Store Mode setting.

Because this is large, it ships in 5 phases. Each phase is usable on its own and leaves the physical store untouched.

## Store Mode (Phase 1)

New setting in Store Settings: **Store Mode** — Physical / Digital / Hybrid (default Physical for every existing store, so nothing changes for current merchants).

The mode drives what is shown, never what is deleted:

- Physical: exactly what exists today.
- Digital: courier, parcels, delivery zones, shipping address and low-stock UI are hidden; digital pages appear.
- Hybrid: everything visible; each product decides its own behaviour, and checkout adapts to what is in the cart.

Existing data is never touched when the mode changes.

## Digital products (Phase 2)

Products get a type of Physical or Digital. A digital product adds:

- Multiple downloadable files (PDF, ZIP, RAR, MP4, MP3, PNG, JPG, PSD, AI, FIG, DOCX, XLSX, PPTX, APK, EXE, source archives) or an external download URL.
- Version, changelog, file size, compatible platforms, last updated.
- Preview images, preview video, tags, gallery (reuses the existing uploader).
- Pricing: regular, sale, free, and a limited-time discount window.
- Download settings: instant vs manual approval, max download count, expiry days, custom button label.
- Optional license key / serial / activation code delivery, with a global on/off switch in the Winner Admin panel.

Digital products skip stock and shipping entirely.

## Checkout and order flow (Phase 3)

When the cart is all-digital, checkout asks only for name, email, optional phone and payment method. Shipping address, district, courier and delivery charge are hidden and delivery cost is forced to zero. Hybrid carts with any physical item keep the full form.

After a successful payment the existing order pipeline runs, then: the order is marked paid, download entitlements are unlocked, a download email is sent, and the buyer lands on a download page. No courier step and no parcel draft is created for digital orders.

## Customer downloads and admin (Phase 4)

- Customer account gets a **My Downloads** tab: product name, purchase date, download button, remaining downloads, version, license key when applicable.
- Store Admin gets a **Digital Orders** page: order number, customer, product, payment status, download status, download count, plus View, Resend download email, Reset download limit and Cancel access actions.
- Product page for digital items shows preview media, screenshots, file information, version, last updated, compatible platforms and download information instead of shipping blocks.
- Storefront filters gain Free / Premium / Latest / Best Selling alongside category and price.

## Digital theme, notifications, AI (Phase 5)

- A new **Digital** theme added to the theme catalog (Winner Admin owned, same locking rules as existing themes), with a marketplace-style homepage: hero, featured, best selling, new releases, categories, bundles, reviews, FAQ, newsletter, footer. Sections are toggleable in the existing theme customizer.
- Notification templates for purchase confirmation, download ready, product update and new version, delivered through the current email/in-app system with the channel structure left open for SMS, WhatsApp and Messenger later.
- The AI agent's store context switches to digital knowledge in Digital/Hybrid mode: downloads, file access, license keys, versions, updates, refund policy.

## Technical notes

- New tables: `product_files`, `order_downloads` (entitlement + counter + expiry), `license_keys`. All with grants, RLS scoped by store owner and by customer session, and updated_at triggers.
- `stores.store_mode` text column, default `physical`; `products.product_type` promoted from meta JSON to a real column with a backfill from existing meta values.
- Digital files live in a private storage bucket; downloads are served through a short-lived signed URL issued by a server function that verifies the entitlement, decrements the counter and logs the hit. Files are never publicly readable.
- Public product reads keep the existing column-level anon grants — file paths and license keys are never exposed to anon.
- Checkout totals stay server-calculated; digital lines force delivery to zero server-side, not just in the UI.
- Order confirmation hook skips courier auto-draft when every line is digital.
- No existing route is renamed and no current API signature changes; all new behaviour is additive and gated on store mode.

## Out of scope for now

SMS, WhatsApp and Messenger delivery of download links (structure prepared, channels not wired), and affiliate/marketplace multi-vendor selling.
