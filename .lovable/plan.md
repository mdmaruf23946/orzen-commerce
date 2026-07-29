## Payment Gateway — full audit result

I traced the whole path: Store Admin connect/test → checkout gateway list → order placement → provider redirect → webhook → order reconciliation, for both built-in adapters and Custom Gateway Builder. Below is what I verified in code, and what must be fixed.

### Critical (real money / security impact)

**1. Online payment charges the wrong amount**
`startOnlineCheckout` in `src/lib/storefront.functions.ts` sends `amount = order.subtotal`. The order total is `subtotal + delivery_amount − discount_amount` (computed in `placeOrder`). So the shopper is charged without the delivery fee, and a coupon discount is not applied at the gateway either. Fix: read `delivery_amount`/`discount_amount` and send the true payable total.

**2. Anyone can mark an order as paid via the custom webhook**
`src/routes/api/public/store-payments/custom-webhook.$store.$gateway.ts` runs the order-reconciliation block (`payment_status = 'paid'` + owner's paid status) even when:
- `?source=test` is used — signature verification is explicitly skipped on that path, yet reconciliation still runs;
- the gateway has `signature.type = "none"` (the Rupantor Pay preset), where `verifyWebhookSignature` returns `null` and is treated as acceptable.

Since `providerRef` is matched against `invoice_no`, a forged POST with a guessed invoice number flips a real order to paid. Fixes: never reconcile when `source=test`; when the signature is not cryptographically verified, confirm through the gateway's own verification endpoint (`executeVerification`) before marking paid, and refuse to mark paid if neither signature nor verification succeeded.

**3. No fallback when the webhook never arrives**
Reconciliation happens only in the webhook. If the provider fails to call back (or the store has no verification configured), the order stays pending forever and the shopper sees no payment status on `/store/$slug/order/$orderId`. Fix: add a `verifyOrderPayment` server function that the order page calls on load for online orders in a non-paid state — it calls the provider's verify endpoint (custom) or `verifyPayment` (built-in) and applies the same status rules. Show a "Payment confirmed / awaiting confirmation" line on the order page.

**4. `startOnlineCheckout` is an unguarded public endpoint**
It accepts any `orderId`, always creates a provider session, and overwrites `payment_ref`. Fix: reject orders that are already `paid`, cancelled, or older than a short window; require the gateway key to match the order's recorded `payment_gateway_id`.

### Medium (will bite later)

**5. Currency hardcoded** — the built-in path sends `currency: "BDT"` regardless of `stores.currency`. Use the store currency (custom path already reads gateway currency).

**6. No amount check on webhooks** — a callback reporting a smaller paid amount still marks the order paid. Compare the reported amount to the order total (with a small tolerance) and log a mismatch instead of confirming.

**7. Store-active not checked in `listStoreOnlineGateways`** — it queries with the admin client and skips the `stores.status = 'active'` guard used elsewhere.

**8. Sandbox gateways are indistinguishable at checkout** — a gateway left in sandbox/test mode is offered to real shoppers with no label. Add a "Test mode" badge and warn the owner in the admin card.

**9. Failed/abandoned online orders never expire** — they hold reserved intent as `pending` with no cleanup. Keep behaviour, but record `payment_status = 'failed'` when a verification returns a failed/cancelled state so the admin order list is truthful.

### Verified as correct (no change)
- Credentials are AES-256-GCM encrypted, decrypted only server-side; previews are masked; secrets never enter the client payloads.
- `saveStorePaymentGateway` merges blank fields with previous values so partial edits don't wipe keys, and only persists after a successful `testConnection`.
- Only providers with `meta.storefrontCheckout` are offered at checkout, so the 16 stub adapters cannot strand a shopper.
- Owner-side platform gateway management is role-gated via `has_role`.
- Order status rules (`online_pending`, `online_paid`, `manual`, `cod`) are validated against the allowed enum in every writer.

### Technical notes
Files to change: `src/lib/storefront.functions.ts` (total amount, currency, guards, new `verifyOrderPayment`), `src/routes/api/public/store-payments/custom-webhook.$store.$gateway.ts` (test-source + unsigned reconciliation, amount check), `src/routes/api/public/store-payments/webhook.$store.$provider.ts` (amount check), `src/routes/store/$slug/order.$orderId.tsx` (payment status + verify-on-load), `src/routes/store/$slug/checkout.tsx` and `src/routes/_authenticated/admin/payment-gateway.tsx` (sandbox badge). No schema migration is required — `payment_status`, `payment_ref`, `payment_gateway_id` already exist on `orders`.
