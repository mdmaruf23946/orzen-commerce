# Store Payment Gateway Management

A per-store payment gateway module that lets each store owner connect their own merchant account for any provider the Winner Admin has enabled. Customer payments go directly to the store owner's account — the platform never touches funds.

## Scope

- New store-admin page: **Payment Gateway** (`/admin/payment-gateway`).
- Winner Admin defines which providers exist and are enabled globally (reuses the existing modular provider registry from Subscription Payments).
- Store owner: connect / disconnect / switch / update / test / enable-disable per provider. Only one gateway is `active` per store at a time.
- Checkout: online methods appear only when an active, connected gateway exists; otherwise show a clear warning and offer manual methods (COD / bKash / Nagad already in `payments_config`).
- Credentials encrypted at rest, never returned to the client.

## Providers

Reuse and extend `src/lib/subscription-pay/providers/` as a shared modular provider layer (rename conceptually to `payment-providers/`, keep subscription-pay adapters working). Ship adapters:

- SSLCommerz (already implemented)
- ShurjoPay
- AmarPay
- PortWallet
- Stripe (BDT/USD via `enable_stripe` BYOK style — store-owner enters own keys)
- PayPal
- Manual (fallback, disabled by default)

Each adapter declares `credentialFields` (Merchant ID, Store ID, API Key, Secret, Username, Password, Sandbox toggle — only the fields it actually needs). Adding a new provider = one file + one registry line. No changes to checkout or store logic.

## Data model (one migration)

New tables:

- `platform_payment_gateways` — Winner Admin catalog. Columns: `id` (provider slug, PK), `label`, `enabled` (bool), `sort_order`, `logo_url`, `notes`, timestamps. Owner-only writes; **all authenticated users can SELECT enabled rows** so store admins see what's available.
- `store_payment_gateways` — per-store connections. Columns: `id`, `store_id`, `provider_id`, `credentials_ciphertext` (text, AES-256-GCM), `sandbox` (bool), `enabled` (bool), `is_active` (bool — only one true per store, partial unique index), `status` (`connected` / `disconnected` / `error` / `untested`), `last_tested_at`, `last_test_result` (jsonb, no secrets), `connected_at`, `updated_at`. RLS: `store_id` owner via `is_store_owner`. **`credentials_ciphertext` is never returned to the client** — server functions return only a masked preview (last 4 chars) + `has_credentials` boolean.

Grants: `authenticated` SELECT/INSERT/UPDATE/DELETE scoped by RLS; `service_role` full. `anon` gets no access.

Encryption key: reuse the existing `APP_USER_CONNECTION_KEY_SECRET` env (already documented in the connector knowledge) via a new `src/lib/crypto/credentials.server.ts` helper (`encrypt` / `decrypt`, AES-256-GCM). Plaintext credentials only touch server-fn handlers.

## Server functions — `src/lib/store-payments.functions.ts`

All `requireSupabaseAuth`, scoped to the caller's store:

- `listAvailableGateways()` — joins `platform_payment_gateways` (enabled) with the caller's `store_payment_gateways` row per provider. Returns provider meta + `credentialFields` (from registry) + connection summary (masked, no secrets).
- `saveStoreGateway({ provider_id, credentials, sandbox, enabled })` — validates credential shape against adapter, encrypts, upserts row. Runs `testConnection` before persisting (`validate credentials before saving`); on failure returns the error without writing. Sets `status`, `connected_at`.
- `testStoreGateway({ provider_id })` — decrypts, calls adapter `testConnection`, stores result. Returns `{ ok, message, latency_ms }`.
- `setActiveStoreGateway({ provider_id })` — flips `is_active`, ensures single active row (transaction).
- `toggleStoreGateway({ provider_id, enabled })` — enable/disable without disconnecting.
- `disconnectStoreGateway({ provider_id })` — clears credentials + row, or wipes `credentials_ciphertext` and marks disconnected.
- `getActiveStoreGatewayForCheckout(store_id)` — server-only helper (no `requireSupabaseAuth`, called from `placeOrder`) returning `{ provider_id, sandbox }` or `null`. Used by checkout to know whether online payments are available.

Winner-Admin functions in `src/lib/owner.functions.ts` (owner-gated): `listPlatformGateways`, `togglePlatformGateway`, `upsertPlatformGateway`.

## Store-admin UI — `src/routes/_authenticated/admin/payment-gateway.tsx`

- Header: current active gateway pill (name + mode badge + status dot), "No active gateway" empty state.
- Grid of provider cards (one per enabled platform gateway). Each card:
  - Logo, label, methods badges.
  - Status pill: `Connected` / `Disconnected` / `Missing credentials` / `Sandbox` / `Error`.
  - Last connected time, last test result.
  - Actions: **Connect** (opens drawer) / **Test** / **Set active** / **Enable-Disable** switch / **Disconnect** / **Update credentials**.
- Configure drawer: fields rendered from adapter `credentialFields` (password inputs masked, existing values shown as `••••1234`), Sandbox switch, "Test connection" button, Save. Save runs test → persists on success.
- Mobile-first: single column < 640px, sticky action bar, compact cards. Reuse existing admin card style + Sonner toasts.

Nav: add "Payment Gateway" entry to `src/routes/_authenticated/admin/route.tsx` sidebar (icon: CreditCard).

## Winner-Admin UI — `src/routes/_authenticated/owner/payment-gateways.tsx`

- Table of all providers in the registry with global enable toggle, sort order, edit label/notes/logo. Only enabled rows appear to store owners. Add nav entry under existing owner "Payments" group.

## Checkout integration — `src/routes/store/$slug/checkout.tsx` + `src/lib/storefront.functions.ts`

- On checkout page load, call `getActiveStoreGatewayForCheckout` (via a new public server fn that returns only `{ provider_id, sandbox, label, methods } | null` — no credentials).
- If `null` → hide the "Pay online" section, show a `<Alert>`: "Online payment is not configured for this store yet. Please choose Cash on Delivery or another manual method." Manual methods (`payments_config`) remain untouched.
- If present → render "Pay with {label}" button. Selecting online payment routes `placeOrder` to a new `initiateStoreCheckout(orderId)` server fn that: loads the active gateway server-side, decrypts, calls adapter `createCheckout`, returns `redirect_url`. Return URL hits a store-scoped landing route (`/store/$slug/pay/return`) that verifies via adapter `verifyPayment` and marks the order paid.
- Webhook: reuse the existing `/api/public/subscription-pay/webhook.$provider.ts` pattern with a new route `/api/public/store-pay/webhook.$provider.ts` that resolves the store from the signed payload/`tran_id` prefix, verifies signature via adapter, marks the order paid via `supabaseAdmin`.

Order table already has `payment_method`, `txn_id`, `payments` table. Add `payment_provider` text column and `payment_status` if not already present (verify in migration; only add missing columns).

## Security

- Credentials encrypted server-side with `APP_USER_CONNECTION_KEY_SECRET`; ciphertext never leaves server functions.
- `saveStoreGateway` validates + tests before persisting (`validate credentials before saving`).
- RLS on `store_payment_gateways` scoped strictly by store ownership; no `anon` grants.
- Client only ever sees masked previews + `has_credentials` + `status`.
- Webhooks verify signature via adapter before any DB write, use `supabaseAdmin` inside handler only.
- Rate-limit `testStoreGateway` per store (in-fn simple check on `last_tested_at`).

## Out of scope

- Migrating the existing Subscription Payments module (kept as-is; this module is for storefront checkout only).
- Refunds beyond a manual "mark refunded" (future).
- Multi-active gateways per store (single active by design; can be extended later via `payment_methods` array on the row).

## Deliverables checklist

- [ ] Migration: `platform_payment_gateways` + `store_payment_gateways` + grants + RLS + partial unique index on `(store_id) where is_active`.
- [ ] `src/lib/crypto/credentials.server.ts` (AES-256-GCM helpers).
- [ ] Extend provider registry with ShurjoPay, AmarPay, PortWallet, Stripe, PayPal adapters (SSLCommerz + Manual reused).
- [ ] `src/lib/store-payments.functions.ts` + `store-payments.server.ts` dispatch.
- [ ] `src/routes/api/public/store-pay/webhook.$provider.ts` + return route.
- [ ] Store-admin UI page + nav entry.
- [ ] Winner-admin UI page + nav entry.
- [ ] Checkout page + `placeOrder` integration, "no gateway" alert.
- [ ] Typecheck + build clean.
