## What I verified

I traced the full path end to end: Store Admin gateway list → connect/test → save (encrypted) → storefront checkout list → order placed → provider redirect → webhook → order status. I read every adapter, both webhook receivers, `startOnlineCheckout`, `placeOrder`, and queried the live `platform_payment_gateways` table.

**Good news:** the Custom Payment Gateway Builder path (Rupantor Pay) is sound — credentials decrypt, checkout executes, webhook verifies and updates the order.

**Bad news:** the built-in provider path is broken in several places. Confirmed by reading the code and DB:

### 1. Built-in checkout sends EMPTY credentials (critical)
`startOnlineCheckout` reads `conn.credentials` — that column does not exist on `store_payment_gateways`. The real value is `credentials_ciphertext` and must be decrypted. So **even SSLCommerz, the only fully wired provider, would fail** at "Pay now".

### 2. 16 of 17 built-in providers throw on checkout, yet all are offered to shoppers (critical)
All 18 rows in `platform_payment_gateways` are `enabled = true`. Only `sslcommerz` implements `createCheckout`. Every other adapter (Stripe, PayPal, ShurjoPay, AmarPay, PortWallet, bKash, bKash/Nagad/Upay Merchant, BDGate, NagorikPay, PaybyBD, Fastaar, PayBD, iPayBD, UrbdPay) throws "not yet wired".

Because `pendingAdapter.testConnection` returns success, the owner's connection is saved with `status = 'connected'`, so `listStoreOnlineGateways` shows it at checkout. The shopper then: places the order → cart is cleared → stock/flow proceeds → "Pay now" throws. Order stranded, no payment, bad UX.

### 3. Built-in webhook never marks orders paid (critical)
`api/public/store-payments/webhook.$store.$provider.ts` parses, verifies, and logs into `payment_webhook_events` — but never touches `orders`. Nothing sets `payment_status = 'paid'` or applies the owner's "online paid" status rule. Only the custom-gateway webhook does that. So a real SSLCommerz payment would stay `unpaid`.

### 4. Payment reference can be null, so the webhook can't find the order
Both webhooks match on `orders.payment_ref`. Providers that only return a redirect URL (Rupantor Pay returns just `payment_url`) leave `payment_ref` null → the successful webhook silently matches zero rows.

### 5. Cart is cleared before payment even starts
In `checkout.tsx`, `clearCart()` runs before `startOnlineCheckout`. If the gateway call fails, the shopper loses their cart and sees only an error.

Minor (no change needed, noting it): `orders.subtotal` actually stores the grand total (items + delivery − discount); the charged amount is therefore correct.

## The fix

**A. Decrypt credentials for built-in checkout** — `src/lib/storefront.functions.ts`: load `credentials_ciphertext` + `status`, decrypt via `@/lib/crypto/credentials.server`, require `status = 'connected'`, and pass the real credentials to `adapter.createCheckout`.

**B. Capability flag so shoppers never see a dead gateway**
- `providers/types.ts`: add `storefrontCheckout?: boolean` to `ProviderMeta`.
- `providers/sslcommerz.ts`: set `storefrontCheckout: true` (the only one, until each real API is wired).
- `listStoreOnlineGateways`: skip built-ins whose adapter lacks the flag.
- `startOnlineCheckout`: hard-fail early with a clear message if the flag is missing.
- Store Admin gateway card (`payment-gateway.tsx` / provider list): show a "Storefront checkout coming soon — credentials saved" note on those providers, so owners understand they can save keys but not yet collect payments. Nothing is removed; every provider stays connectable.

**C. Reconcile orders in the built-in webhook** — in `webhook.$store.$provider.ts`, when `verifyPayment` returns `paid`, update the matching order: `payment_status = 'paid'` plus the store's configured `payments_config.order_status.online_paid` (default `confirmed`), mirroring the custom-gateway webhook exactly.

**D. Always have a matchable reference**
- `startOnlineCheckout` writes `payment_ref = provider_ref ?? invoice_no ?? order.id` for both built-in and custom paths.
- Both webhooks match on `payment_ref` **or** `invoice_no` (sanitised value, scoped to `store_id`), so a provider echoing our transaction id still reconciles.

**E. Don't clear the cart until payment is under way** — `src/routes/store/$slug/checkout.tsx`: for online methods, call `startOnlineCheckout` first, clear the cart only once a `redirect_url` is returned, and on failure keep the cart and show the provider's error.

## Notes

- No database migration is required; all `orders` payment columns already exist.
- No existing gateway, credential, or UI feature is removed.
- After the changes I'll re-check the Rupantor Pay custom gateway still starts a session, and confirm the built-in path now carries real credentials.
