# ORZEN Digital Store

A complete digital-marketplace experience that activates on the **same URLs** when a store's mode is Digital (or a digital cart in Hybrid). The Physical store keeps its current code paths, routes and APIs untouched — every digital surface is a new component tree chosen at render time.

Existing groundwork already in place: `store_mode` on stores, `product_type` on products, `product_files`, `order_downloads`, `license_keys`, the private `digital-files` bucket, entitlement/unlock/email engine, a basic `MyDownloads` and a Digital Orders admin page. This plan builds the real marketplace on top of it.

Shipped in 5 phases; each phase is usable on its own.

---

## Phase 1 — Digital theme + homepage

- New **Digital** theme in the theme catalog (Winner-Admin owned, same locking rules): tech-forward, minimal, dark/light ready, download-focused cards, smooth reveal animations. Visually distinct from the physical themes — no shared card component.
- New storefront homepage rendered when store mode is Digital: premium hero, Featured, Best Selling, New Releases, Trending, Recently Updated, Free Resources, Bundle Deals, Collections, Popular Categories, Reviews, FAQ, Newsletter, digital footer. Every section toggleable in the existing theme customizer.
- Store header/nav switches to a marketplace layout (search-first, categories mega-list, My Downloads entry).
- Physical homepage file untouched; mode picks the component.

## Phase 2 — Digital categories + product model

- Global digital category catalog owned by Winner Admin (eBooks, Courses, Templates, Source Code, Website Templates, UI Kits, Graphics, Fonts, Icons, Plugins, Software, Mobile Apps, Audio, Video, Photography, Documents, Business Resources) — auto-applied to every digital store, extendable globally, hideable per store.
- Digital product types: Downloadable File, External Link, License Key, Online Course, Subscription, Software, Bundle.
- Digital product form (new tabbed form, physical form untouched): Basic (name, short + full description, category, tags) · Media (thumbnail, gallery, preview video, demo URL) · Files (multi-upload + external links) · Info (size, format, version, last updated, compatible devices/software) · Pricing (regular, sale, free, limited-time offer window) · Downloads (limit, expiry, max devices, instant vs manual) · License (keys/serials/activation codes, pooled).
- Bundles reference child products.

## Phase 3 — Product page, cart, checkout

- Digital PDP: large preview, screenshots gallery, preview video, description, features, included files, version + changelog, compatibility, requirements, reviews, related. No shipping/stock/courier blocks anywhere.
- Digital cart: products, coupons, discounts, total, instant checkout. No weight, shipping, courier or delivery charge.
- Digital checkout: name, email, optional phone, payment method only. Delivery forced to zero server-side, courier auto-draft skipped.
- After payment: order created → entitlements unlocked → download email sent → download page shown → invoice generated.

## Phase 4 — Customer downloads + admin

- Customer dashboard **My Downloads**: thumbnail, name, purchase date, current version, download button, remaining downloads, download history, license key.
- Digital admin dashboard: total digital products, total downloads, digital sales, most downloaded, recently updated, active licenses, free downloads.
- Digital Orders table upgraded: order no, customer, product, payment status, download status, download count; actions View / Resend download / Reset limit / Generate new license / Cancel access.
- Search & filter across storefront: category, price, Free, Premium, Latest, Best Selling, Recently Updated, product type, file format.

## Phase 5 — AI agent + notifications

- AI Sales Agent context switches fully to digital knowledge in Digital mode (downloads, licenses, versions, compatibility, installation, updates, refunds, file access) and ignores physical shipping knowledge.
- Notification templates: purchase confirmation, download ready, product update, new version released, license activated — delivered over the current email/in-app system, with the channel structure left open for SMS/WhatsApp/Messenger.

---

## Technical notes

- **Routing:** `/store/$slug/*` stays. Each route picks a Physical or Digital view component from store mode; Hybrid decides per product/cart. No route renamed, no API signature changed.
- **New tables:** `platform_digital_categories` (global catalog, Winner-Admin managed) and `store_digital_category_prefs` (per-store hide/rename), plus `product_bundle_items`. Extra product columns for version/changelog/compatibility/demo URL/limited-offer window go into the existing `digital` jsonb where possible; only promote to real columns where they are filtered on. Every new table ships with GRANTs, RLS scoped by store owner + anon read where public, and updated_at triggers.
- **Downloads** keep the existing signed-URL server function: entitlement verified, counter decremented, hit logged, files never public. Max-devices enforced by recording device fingerprints per entitlement.
- **Pricing and totals** stay server-calculated; digital lines force delivery zero server-side, not just in UI.
- **Performance:** digital homepage sections load through one batched server function; images lazy-loaded; mobile-first layout throughout.
- Physical store files are not edited beyond the mode branch at the route entry points.

## Out of scope

SMS/WhatsApp/Messenger delivery of download links (structure prepared only), multi-vendor/affiliate selling, and course video hosting/player (courses ship as downloadable + external-link products in this pass).
