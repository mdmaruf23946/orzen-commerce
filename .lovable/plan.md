# Payment Gateway Integration System Upgrade

Additive upgrade to the existing Store Admin payment gateway module. No existing provider, credential, webhook route, or DB row is removed. The current adapter registry (`src/lib/subscription-pay/providers/*`) and store-scoped tables (`platform_payment_gateways`, `store_payment_gateways`, `payment_webhook_events`) are extended, not replaced.

## Goals

1. Turn provider configuration into a schema-driven engine so Winner Admin can add new providers without code edits to the Store panel.
2. Add 10 new provider slots: BDGate, NagorikPay, PaybyBD, Fastaar, PayBD, iPayBD, UrbdPay, bKash Merchant, Nagad Merchant, Upay Merchant — each with its own credential schema and branding.
3. Show only fields required per provider, mask secrets, encrypt at rest, and never leak another store's credentials.
4. Keep the existing card + brand-mark layout (logo left of name, wordmark support already in place) and extend it with status metadata, diagnostics, priority ordering, and a step wizard.

## What changes

### 1. Schema-driven provider engine (backend)

- Extend `platform_payment_gateways` with additive columns (nullable, safe to backfill):
  - `provider_type` (enum-like text: `direct_mfs`, `aggregator`, `card`, `bank`, `unified`, `manual`)
  - `credential_schema jsonb` — array of `{ key, label, type, required, group, helper, pattern, secret }` describing the fields the connect form should render.
  - `webhook_support boolean`, `callback_support boolean`, `sandbox_support boolean`, `live_support boolean`
  - `docs_url`, `website_url`, `default_methods text[]`
- Seed the 10 new providers as rows (disabled by default) with placeholder brand assets and empty `credential_schema` for MFS direct integrations where we won't invent field names.
- Extend `store_payment_gateways` with:
  - `priority int` (display order at checkout)
  - `last_test_at timestamptz`, `last_test_ok boolean`, `last_test_message text`
  - Keep existing `is_active`, `enabled`, `status`, `sandbox`, `credentials_ciphertext`.

### 2. Adapter registry (backend)

- Add empty adapter stubs in `src/lib/subscription-pay/providers/` for each new provider (`bkash-merchant.ts`, `nagad-merchant.ts`, `upay-merchant.ts`, `bdgate.ts`, `nagorikpay.ts`, `paybybd.ts`, `fastaar.ts`, `paybd.ts`, `ipaybd.ts`, `urbdpay.ts`) implementing `SubscriptionPaymentProvider`.
- `testConnection` / `createCheckout` / `verifyPayment` return a clear "not yet implemented — configure via Winner Admin once official API docs are wired" error for now. This satisfies the rule to not invent endpoints.
- Register all in `providers/registry.ts` so the schema-driven form still works and webhook receiver can log deliveries.

### 3. Store Admin UI upgrades (`src/routes/_authenticated/admin/payment-gateway.tsx`)

Keep the existing page shell, cards, and BrandMark layout. Add:

- **Provider card metadata row**: connection status pill, sandbox/live pill, enabled/disabled pill, "Last verified …" line, and action buttons `Configure`, `Test Connection`, `Enable/Disable`.
- **Dynamic connect drawer** rendered from `credential_schema` — one component `DynamicCredentialForm` iterating fields, grouping by `group`, respecting `type` (`text | password | url | number | textarea | select`), and rendering Show/Hide + Copy on secret fields.
- **Environment toggle**: single Sandbox↔Live switch; on switch, form clears and loads credentials for the chosen environment (stored as two ciphertexts on the same row: `credentials_ciphertext_sandbox`, `credentials_ciphertext_live`, added in migration).
- **Webhook panel**: auto-generated URL `https://{host}/api/public/store-payments/webhook/{storeId}/{providerId}` with Copy buttons and a "Send test event" action that hits the existing route with `?source=test`.
- **Diagnostics section** (collapsible): reachability, credentials valid, webhook status, last success/failure — populated from `last_test_*` columns and `payment_webhook_events`.
- **Setup wizard**: 4-step drawer (Provider → Credentials → Test → Activate) with a progress header, reusing the same DynamicCredentialForm.
- **Checkout priority list**: drag-and-drop reordering of enabled gateways, writing back to `priority`.
- **Human-readable errors**: friendly toast + "View technical details" expander.

### 4. Winner Admin — provider management (`src/routes/_authenticated/owner/brand-assets.tsx` payments tab, plus a new "Provider Config" section)

Extend the existing payment brand assets page:

- Manage the additive columns: type, docs URL, website URL, supported methods, sandbox/live/webhook toggles.
- JSON editor for `credential_schema` with a field-by-field builder (add row: key, label, type, required, group, helper).
- Existing logo / wordmark / brand color management stays intact.

### 5. Security

- Credentials remain encrypted via `src/lib/crypto/credentials.server.ts` (AES-256-GCM). New sandbox/live split reuses the same encryptor.
- All server functions stay under `requireSupabaseAuth` middleware and scope every query by `store_id = owner's store`.
- RLS on `store_payment_gateways`: keep existing owner-only policy; add explicit deny for `anon`. GRANTs remain unchanged.
- Never return `credentials_ciphertext` to the client — server functions return only `{ hasCredentials: true, preview: '••••1234' }` via `credentialsPreview`.

### 6. Checkout & verification (no breaking changes)

- Existing checkout flow keeps working. `get_active_store_gateway_public` gains a `priority`-ordered variant `get_public_store_gateways` returning multiple enabled gateways so the storefront can render them in order (used only when store enables >1). Single-default path unchanged.
- Order payment statuses already exist; add missing values (`verification_required`, `partially_refunded`) to the status handling in payment write paths — no enum removal.

## Files to add or edit

**New**
- `src/lib/subscription-pay/providers/{bkash-merchant,nagad-merchant,upay-merchant,bdgate,nagorikpay,paybybd,fastaar,paybd,ipaybd,urbdpay}.ts`
- `src/components/admin/payments/DynamicCredentialForm.tsx`
- `src/components/admin/payments/ConnectionWizard.tsx`
- `src/components/admin/payments/DiagnosticsPanel.tsx`
- `src/components/admin/payments/WebhookPanel.tsx`
- `src/components/owner/payments/CredentialSchemaEditor.tsx`

**Edited (additive only)**
- `src/lib/subscription-pay/providers/registry.ts` (register new adapters)
- `src/lib/store-payments.functions.ts` (new: `getProviderSchema`, `savePriority`, `testStoreGateway`, `sendTestWebhook`, split sandbox/live credentials)
- `src/routes/_authenticated/admin/payment-gateway.tsx` (integrate new components; keep current cards)
- `src/routes/_authenticated/owner/brand-assets.tsx` (extend payments tab with schema editor + toggles)
- Migration file: new columns on `platform_payment_gateways` and `store_payment_gateways`, seed rows for new providers.

## Non-goals

- Not implementing real bKash/Nagad/Upay merchant HTTP calls — those need official API access. Adapters are scaffolded and clearly marked pending; Winner Admin can fill in schema and endpoints later without touching Store Admin code.
- Not touching subscription payments (`src/routes/_authenticated/owner/subscription-pay.*`).
- Not changing existing orders, webhooks, or checkout for currently connected gateways.

## Rollout

1. Migration (schema additions + seed rows).
2. Backend adapters + server functions.
3. Store Admin UI (dynamic form, wizard, diagnostics, priority).
4. Winner Admin schema editor.
5. Manual smoke test: existing SSLCommerz/Manual gateway still connects, tests, and receives webhooks unchanged.
