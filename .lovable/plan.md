# Store Panel (Customer Storefront) — Full Audit and Fix Plan

Audit scope: only the customer-facing Store Panel under `/store/$slug` (home, catalog, product page, cart, all four checkout types, order page, returns/exchange, digital access, customer account, auth). The Merchant/Owner panels were not touched.

Everything below was verified by reading the actual route, component and server-function code and by loading the live store `abdullah` in a 404px mobile browser.

## What is genuinely broken (confirmed)

### Security / data protection
1. **Order pages expose customer PII to anyone with the order link.** `getOrder` and `getOrderPaymentTimeline` accept only an order UUID — no session token, no phone/email proof — and return name, phone, full address, payment reference. An `ownsOrderRecord` helper already exists but is not used on these two paths.
2. **Return requests upload files and compute refunds before ownership is checked.** In `createMyReturnRequest`, order items are read with no `store_id` filter and images are written to storage before the RPC verifies the order belongs to the caller.
3. **No throttling on customer login/signup.** Unlimited attempts per store against `customer_login`.
4. **Password change does not kill other sessions.** Tokens live 90 days; a stolen token survives a password change.

### Broken or dead functionality
5. **Forgot password is a dead end.** The page has no form and no backend at all, yet it is linked from the sign-in page.
6. **Two fixed bottom bars overlap on the product page.** The bottom nav is not excluded on `/product/...`, so it sits on top of the sticky "Add to cart / Buy now" bar — the main conversion button can be blocked on phones.
7. **Hydration mismatch on storefront load** (React error in console on every page). Needs to be traced and fixed.
8. **"Write a review" and the review breakdown are fake.** The star bars are hardcoded to 0% and the button only shows a "coming soon" toast.
9. **Messenger share button** uses an app-only `fb-messenger://` link with no web fallback — dead on desktop.
10. **Dead duplicate code in the account page:** an unused `OrdersTab` (with a wrong total formula) shipping next to the real `OrdersPanel`; two overlapping server functions for the same order list.

### Data-correctness bugs
11. **Cart never revalidates against the server.** Prices are snapshotted at add-to-cart time and never reconciled, quantity can exceed stock, and "Buy again" re-adds old prices. The checkout total can therefore differ from what the server charges.
12. **Coupon free-shipping can silently diverge:** if a coupon expires between validation and submit, the UI still shows free shipping while the server charges it.
13. **Return window is computed twice with different sources** — one component hardcodes 7 days, the other reads the store policy, so the same order page can contradict itself.
14. **Exchange replacements are priced at the base product price server-side**, while the wizard showed the chosen variant price.
15. **Order status filter buckets overlap** — a cancelled unpaid order matches both "cancelled" and "expired".
16. **Cancel button stays visible for returned orders**, then fails with a raw error.
17. **Phone numbers are not validated anywhere** (client or server) — "aaaaa" is accepted, which breaks courier contact and phone-based duplicate protection.
18. **Setting a default address re-sends cached address text**, which can overwrite newer values.
19. **Orders list is fully unbounded** — the whole order history plus items, timeline and returns is fetched and then filtered/searched in JavaScript on every visit.

### UX / consistency / mobile
20. **Large untranslated areas** despite the new language system: the entire main (physical) checkout, the whole product detail page, search bar, share bar, payment timeline, and the Services / Notifications / Payments / Privacy / Support account panels. All server error toasts are raw English.
21. **Address delete has no confirmation**; a small ghost trash icon deletes permanently on one mobile tap.
22. **Checkout flashes the physical form** before cart data loads, even for a digital/service cart, and shows "no gateway configured" when the gateway query merely failed.
23. **Search matches product name only** (not brand/SKU/description) and runs undebounced on every keystroke.
24. **Wishlist is browser-scoped, not customer-scoped**, but presented inside the signed-in account area — one device shows the same wishlist to different customers.
25. Delivery-zone chips can overflow at 360px; policy links in the mobile drawer do a full page reload out of the store shell.

## Fix plan

**Phase 1 — Security and data integrity (highest priority)**
- Require ownership proof (session token, or the phone/email on the order) for `getOrder` and `getOrderPaymentTimeline` via the existing `ownsOrderRecord` helper; keep the immediate post-checkout confirmation working by passing the buyer's contact/token.
- Verify order ownership in `createMyReturnRequest` before reading items or uploading images; scope the item query by store.
- Add per-store attempt throttling on customer login/signup and delete all sessions on password change; add "sign out of all devices".
- Add real phone/email format validation on client and server for checkout, signup and addresses.

**Phase 2 — Correctness of money and order state**
- Reconcile cart lines against live product data on the cart and checkout pages: refresh price, cap quantity at stock, flag removed/out-of-stock items, and show a clear "price updated" notice. Apply the same to "Buy again".
- Re-validate the coupon server-side at submit and return the authoritative totals; show the server total if it differs.
- Single source of truth for the return window (store policy) across both order-page components.
- Price exchange replacements by the selected variant server-side.
- Fix the cancelled/expired filter overlap, hide Cancel for returned orders, and fix the default-address partial update.
- Paginate the customer orders list and push status/search filtering into the query.

**Phase 3 — Broken UI and dead ends**
- Hide the bottom nav on the product route (or offset the sticky bar) so the buy CTA is never covered; verify at 360–404px.
- Diagnose and fix the hydration mismatch.
- Forgot password: implement a real reset (emailed one-time token using the existing email infrastructure) — the current page is linked but does nothing.
- Reviews block: either wire submission to the existing review tables or remove the fake breakdown and CTA. Recommendation: remove the fake percentage bars and the dead button for now.
- Add a web fallback for the Messenger share link.
- Delete the unused `OrdersTab` and consolidate the duplicate order-list server functions.
- Confirmation dialog before deleting an address.

**Phase 4 — Language and mobile polish**
- Translate the remaining surfaces: main checkout, product detail page, search bar, share bar, payment timeline, and all account sub-panels; route server error messages through the translation layer with a generic fallback.
- Fix loading/error states on checkout (skeleton while the cart resolves, retry on gateway fetch failure).
- Extend search to brand/SKU/description with a short debounce.
- Truncate long delivery-zone labels; make policy links stay inside the store shell.
- Scope the wishlist to the signed-in customer (falling back to local storage for guests, merged on login).

## Technical notes
- No schema change is needed for Phases 1–3 except a small table for password-reset tokens and (in Phase 4) an optional customer-scoped wishlist table; both come with RLS plus explicit GRANTs.
- Ownership checks reuse `src/lib/order-ownership.server.ts`; nothing in the merchant panel is modified.
- Totals will be computed in one shared helper used by checkout, `placeOrder`, `startOnlineCheckout`, and the order page, replacing three copies of the same formula.
