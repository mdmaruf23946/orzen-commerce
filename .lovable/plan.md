
# Custom Payment Gateway Builder

Extends the existing Store Admin → Payment Gateway page with a configurable, per-store custom gateway system. All existing hard-coded gateways (SSLCommerz, Stripe, bKash, etc.) remain untouched.

## Architecture overview

Custom gateways live in their own tables and their own runtime path — they do NOT join the `PROVIDERS` registry. The existing gateway list on the Payment Gateway page shows platform providers first, then a new "Custom gateways" section listing this store's custom gateways plus an "+ Add Custom Gateway" card. Checkout picks the store's active gateway from either source.

## Database (new migration)

1. `public.custom_payment_gateways`
   - `id uuid pk`, `store_id uuid → stores`, `name text`, `slug text`, `logo_url text`, `description text`, `website_url text`, `docs_url text`, `support_email text`, `currency text default 'BDT'`, `currencies text[]`
   - `status text` in (`draft`,`testing`,`connected`,`active`,`error`,`disabled`)
   - `environment text` in (`sandbox`,`production`) default `sandbox`
   - `auth_type text`, `api_base_url text`, `sandbox_base_url text`
   - `config jsonb` (non-secret: request/response mapping, headers template with `{{placeholders}}`, checkout type, response paths, webhook config, status map, verification config, refund config, payment methods)
   - `credentials_encrypted text` (AES-256-GCM via existing `src/lib/crypto/credentials.server.ts`)
   - `credentials_preview text` (masked hint only)
   - `is_default boolean`, `is_active boolean`, `last_tested_at`, `last_test_result jsonb`
   - `created_at`, `updated_at`
   - Unique `(store_id, slug)`; partial unique index enforcing one `is_default=true` per store
2. `public.custom_payment_gateway_events` (webhook log + idempotency)
   - `id uuid pk`, `store_id`, `gateway_id`, `event_id text`, `event_type text`, `payload jsonb` (sanitized), `signature_valid boolean`, `processing_status text`, `processed_at`, `created_at`
   - Unique `(gateway_id, event_id)` for idempotency
3. `public.custom_payment_gateway_audit` — `id, store_id, gateway_id, actor_user_id, action, meta jsonb, created_at`

GRANTs + RLS: `authenticated` gets `SELECT/INSERT/UPDATE/DELETE` on rows where `is_store_owner(store_id)`. `service_role` full. `credentials_encrypted` is never selected from client — a `SECURITY DEFINER` RPC `get_custom_gateway_public(_id uuid)` returns everything except that column for the admin UI. Webhook events are read-only for owners; inserted only by service_role.

## Server code

Files (all thin `createServerFn` wrappers, real logic in `.server.ts`):

- `src/lib/custom-gateway/types.ts` — Zod schemas for config, mapping, headers, status map, verification, refund.
- `src/lib/custom-gateway/engine.server.ts` — pure engine:
  - `renderTemplate(str, vars)` — safe `{{var}}` substitution (no eval).
  - `buildRequest(config, vars, creds)` — assembles method, URL, headers, body per Content-Type.
  - `readPath(obj, "a.b.c")` — response mapping.
  - `signHmac(body, secret, algo, encoding)` and `verifyWebhookSignature(config, rawBody, headers, creds)`.
  - `normalizeStatus(providerStatus, statusMap)` → `pending|processing|paid|failed|cancelled|refunded|expired`.
  - `executeCheckout`, `executeVerification`, `executeRefund` — server-side `fetch` to provider.
- `src/lib/custom-gateway/gateways.functions.ts` — `listCustomGateways`, `getCustomGateway`, `upsertCustomGateway` (splits secret fields into `credentials_encrypted` + preview), `deleteCustomGateway`, `toggleCustomGateway`, `setDefaultCustomGateway` (rejects unverified), `testCustomGatewayConnection`, `testCustomGatewayPayment`, `importCustomGatewayConfig`, `exportCustomGatewayConfig` (strips secrets). All `.middleware([requireSupabaseAuth])` + `assertStoreOwnership`.
- `src/routes/api/public/store-payments/custom-webhook.$store.$gateway.ts` — POST handler: loads gateway via `supabaseAdmin`, verifies signature per config, checks idempotency on `(gateway_id, event_id)`, normalizes status, updates matching `payments`/`orders` row, records event. Returns 200 for known events, 401 on bad signature, 409 on duplicate.
- Extend existing checkout flow (`src/lib/store-payments.functions.ts` create-intent path) to detect custom gateway selection and call `engine.executeCheckout` instead of the `PROVIDERS` registry. Response mapping extracts payment URL / transaction id.
- Extend the return/callback route to call `engine.executeVerification` server-side before marking paid — never trust redirect params.

## URLs (auto-generated per store + gateway)

Built from `window.location.origin` / server request origin:
- Success: `/store/{slug}/payment/return?gw={gatewayId}&status=success`
- Cancel: `.../return?gw={gatewayId}&status=cancel`
- Failure: `.../return?gw={gatewayId}&status=fail`
- Callback: `.../return?gw={gatewayId}` (server-verified)
- Webhook: `/api/public/store-payments/custom-webhook/{storeId}/{gatewayId}`

Copy buttons in the UI use these.

## UI

- `src/components/admin/payments/custom/CustomGatewayCard.tsx` — matches existing card style; shows logo, methods, status badge, Manage/Test/Toggle/Delete/Set-default.
- `src/components/admin/payments/custom/CustomGatewayWizard.tsx` — Sheet-based 10-step wizard with progress rail, back/next preserving form state (single `useState` object). Steps: Basic Info · Authentication · Environment · Payment Request (headers/body builders with monaco-lite `Textarea` + JSON validation on blur) · Checkout/Redirect · Response Mapping · Callback & Webhook (copy URLs, signature config) · Payment Verification · Refund (toggle) · Payment Methods · Test Connection · Review & Activate.
  - Auth-type driven dynamic fields; all secrets rendered as password inputs with show/hide; on save, empty secret keeps existing value.
  - Field-mapping builder = repeatable rows (internal var → provider path) plus static values.
  - Header/body builders support `{{order_id}}`, `{{amount}}`, `{{currency}}`, `{{customer_*}}`, `{{success_url}}`, `{{cancel_url}}`, `{{fail_url}}`, `{{callback_url}}`, `{{webhook_url}}`, `{{store_id}}`.
  - Status-mapping table (provider value → internal enum).
  - Import/Export JSON (secrets stripped on export; validated on import).
- Insert `CustomGatewaySection` on `src/routes/_authenticated/admin/payment-gateway.tsx` below existing platform cards. No changes to existing cards.

## Checkout integration

- Storefront checkout gateway picker lists platform-active gateway + all `active` custom gateways.
- On submit for a custom gateway: server creates `payments` row (`pending`), runs `executeCheckout`, stores `provider_ref`, returns `redirect_url` or renders embedded per `checkoutType`. Never marks paid client-side.
- Return route: `executeVerification` when method = API status check; otherwise wait for webhook. Status set only from verified source.

## Security

- Credentials encrypted at rest with existing `encryptJSON`/`decryptJSON`; secret keys defined by auth-type map so they're stripped from `config` before persist.
- No secret ever selected client-side; UI only sees `credentials_preview` and boolean `has_credentials`.
- RLS scopes every table by `store_id` via `is_store_owner`; webhook route uses `supabaseAdmin` only after signature verification.
- Idempotent webhook via unique `(gateway_id, event_id)`.
- Audit log entry on create/update/activate/disable/test/delete/webhook/refund; payload sanitized (no secrets, truncated bodies).
- Rate-limit test-connection per store (soft: max 20/hour recorded in audit).

## Acceptance verification

After build: create two stores in the same account, add one custom gateway to each with different credentials, confirm store A's admin cannot fetch/manage/test store B's gateway (RLS query check), confirm webhook to store A's URL updates only store A's order, confirm exported config contains no secret keys, confirm existing SSLCommerz/Stripe cards still render and save.

## Out of scope

- Providers requiring proprietary SDKs / device signing — wizard's Review step surfaces the "dedicated integration required" message when config is incomplete for the chosen checkout type.
- Changes to subscription-pay providers, courier system, or platform admin panel.
