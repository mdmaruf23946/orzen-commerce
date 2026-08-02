# Digital Product Checkout Flow — Complete Upgrade

Digital-only behaviour is added on top of the existing engine. Every physical path (checkout fields, shipping, COD, courier, order stages) stays byte-for-byte as it is today; digital branches only activate when the cart contains digital products.

Already in place from the previous turn: `digital_entitlements`, `digital_licenses`, `digital_downloads` tables, `grantDigitalAccess` / `activateDigitalAccess` / `issueDownloadUrl`, digital PDP, and COD blocking + zero shipping for digital-only carts inside `placeOrder`.

## 1. Digital checkout page

Checkout detects cart composition (all-digital / mixed / all-physical) from product types already returned by `listProductsByIds`.

All-digital cart:
- Fields: Full Name*, Email*, Phone*, plus optional Country, Company, Order Note.
- Hidden: address, district/area, delivery zone, shipping method, courier, COD.
- Product summary per line: thumbnail, name, version, license type, category, quantity, and badges (Instant Download, Digital Product, Secure Purchase).
- Pricing: price, discount, coupon (instant validation, unchanged endpoint), optional tax, total. No delivery row.
- Payment: online gateways only, from the store's enabled gateway list (Rupantor Pay, SSLCommerz, Stripe, PayPal, bKash, Nagad, Rocket as configured). COD is not rendered and is rejected server-side.
- Two required checkboxes: digital-product acknowledgement and Terms & Conditions. Button label "Complete Purchase".

Mixed cart keeps the physical form (shipping needed) but still hides COD and shows digital badges on digital lines.

## 2. Payment processing

- Submit shows a secure-payment overlay (creating order → redirecting to gateway → verifying).
- Duplicate submit guarded by an idempotency key per cart snapshot plus the existing duplicate-order protection.
- On return, the order page verification retries a few times with backoff before showing "verification pending".

## 3. Payment success page

For digital orders the order page renders a dedicated success layout: large success icon, "Payment Successful", order number, payment ID, purchase date, customer email, product name(s), amount paid, payment method; buttons Download Now, View My Downloads, View Invoice, Continue Shopping.

## 4. Automatic access

On paid webhook / verification (already wired), `activateDigitalAccess` unlocks entitlements, generates license keys, stamps expiry — then queues the confirmation email. No manual approval.

## 5. Download page + My Downloads

- New route `store/$slug/downloads/$entitlementId`: thumbnail, name, version, license, file size, format, release date; buttons Download (signed URL), Copy License, View Documentation, Watch Tutorial, Report Problem, Support; shows downloads remaining, expiry, latest version.
- New account tab `downloads` (`/store/$slug/account?tab=downloads`): each purchase card with image, name, version, purchase date, download button, license key, expiry, download count, status; filters Active / Expired / Updated. Backed by the existing `listMyDigitalPurchases`.

## 6. Email automation

New digital-delivery template queued through the existing `enqueueEmail` pipeline: product name, download button, invoice link, license key, support link, order number.

## 7. Digital order statuses

Digital orders use their own ladder: `pending_payment → paid → processing_access → ready_to_download → completed`, plus `refunded` and `expired`. Physical stages (processing, packed, shipped, out for delivery, delivered) are not shown or selectable for digital orders. Implemented as a presentation + allowed-transition map keyed on order type, so the shared `orders.status` column is untouched for physical orders.

## 8. Store Admin digital order view

Order drawer gains a Digital section when the order has entitlements: customer name/email/phone, payment status, gateway, download count, remaining downloads, license key, access expiry, product version. Quick actions: Resend Download Email, Regenerate License, Disable Access, Enable Access, Refund (existing), View Logs (download log rows).

## 9. Fraud protection and download rules

Already partly implemented and completed here: short-lived signed URLs, per-entitlement download counter, device/IP logging, max devices / max IPs / max activations enforcement, and owner-configurable rules in the product form (unlimited, limited count, expiry days, lifetime).

## 10. Invoice

Digital orders reuse the invoice template engine; a digital variant omits shipping and adds license and product version rows.

## 11. Activity timeline

Digital order timeline: Order Created → Payment Completed → Access Granted → Download Completed → License Activated, built from order rows, entitlement rows and `digital_downloads` log. Shown on both the storefront order page and the admin drawer.

## 12. Future-ready

Digital behaviour is driven by `products.meta.digital` plus a product-type registry, so courses, ebooks, software, templates, music, video and membership files are new metadata presets rather than new code paths.

## Technical notes

- New files: `src/components/storefront/checkout/DigitalCheckout.tsx`, `DigitalOrderSuccess.tsx`, `DigitalTimeline.tsx`, `src/routes/store/$slug/downloads.$entitlementId.tsx`, `src/components/storefront/account/MyDownloads.tsx`, `src/components/admin/orders/DigitalOrderPanel.tsx`, `src/lib/digital-status.ts`.
- Edited: `checkout.tsx` (branching only), `order.$orderId.tsx`, `account.tsx` (new tab), `orders-admin.functions.ts`, `OrderDetailsDrawer.tsx`, `digital.functions.ts` (admin actions + email resend), `digital.server.ts` (license regeneration, enable/disable).
- Migration: add `email` and optional `company` / `country` capture on orders if not present, and an admin-side entitlement action audit trail. Grants + RLS follow the existing store-scoped pattern.
- Server functions for admin actions run under `requireSupabaseAuth` with a store-ownership check before touching entitlements.

## Assumptions

- Email on checkout becomes required for digital carts; physical checkout keeps phone-only.
- Tax stays optional and is displayed only when the store has a tax rate configured.
- "Watch Tutorial" / "View Documentation" read optional URLs from product digital metadata and hide when unset.
