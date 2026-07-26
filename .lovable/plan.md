# Landing Page Integrations — Plan

Additive feature under **Store Admin → Integrations → Landing Pages**. Reuses the existing `orders` / `order_items` tables, courier, payment, and invoicing pipelines. No existing feature, table, RLS, or route is removed.

## 1. Database (one migration)

New tables, all scoped by `store_id`, RLS = owner-only, `GRANT` to `authenticated` + `service_role`:

- `landing_page_connections` — id, store_id, name, landing_page_name, url, description, platform (`custom|wordpress|woocommerce|shopify|webflow|wix|custom_php|custom_react|universal|other`), method (`webhook|api|embed`), status (`active|paused|pending|failed`), default_product_id, orders_received, failed_count, last_order_at, last_error, last_error_at, created_at, updated_at.
- `landing_page_credentials` — connection_id, api_key (hash + last4), webhook_secret_encrypted (AES-GCM via existing `credentials.server.ts`), rotated_at.
- `landing_page_product_map` — connection_id, external_id/sku, store_product_id, qty_multiplier, variant_map jsonb.
- `landing_page_field_map` — connection_id, mapping jsonb (external→internal).
- `landing_page_logs` — connection_id, store_id, received_at, status (`success|failed|duplicate|invalid|unauthorized|test`), external_order_id, order_id (nullable FK to `orders`), request_hash, ip, ua, request_snippet, response_snippet, error, processing_ms.
- `landing_page_events` — lightweight event log (rotated separately from logs for status pings).

Extend existing `public.orders` (additive columns only, all nullable):
- `source` text default `'store'` (values: `store|landing_page|shopify|woocommerce|other`)
- `landing_page_connection_id uuid` (FK, nullable, on delete set null)
- `external_order_id text`
- `landing_page_url text`
- `utm jsonb` (utm_source/medium/campaign/term/content, fbclid, gclid)
- Unique partial index on `(landing_page_connection_id, external_order_id)` where both not null — idempotency.

Existing orders (source is null) are treated as `store` in code — no data migration needed.

## 2. Server functions (`src/lib/landing-pages.functions.ts`)

Auth via `requireSupabaseAuth` + `is_store_owner` check:

- `listConnections`, `getConnection`, `createConnection`, `updateConnection`, `deleteConnection`, `pauseConnection`, `resumeConnection`
- `regenerateWebhookSecret`, `regenerateApiKey`, `revokeApiKey` (returns plaintext once, then only stores hash + last4)
- `setProductMap`, `setFieldMap`
- `testConnection` (self-invokes intake endpoint with a signed sample payload; does NOT touch courier)
- `sendTestOrder` (creates a flagged test order with `notes` prefixed `TEST ORDER` and `source='landing_page'`, skips courier dispatch — matches existing "no automatic courier push" behavior; test orders excluded from courier automation via a `is_test boolean default false` column added to `orders`)
- `listConnectionLogs`, `retryLog`, `listConnectionOrders`

## 3. Public intake endpoints (server routes)

Under `src/routes/api/public/landing-pages/` — bypass site auth, verify their own credentials:

- `POST /api/public/landing-pages/$connectionId/orders` — webhook method. Verifies `X-Signature: sha256=hex(HMAC(secret, rawBody))` with timing-safe compare and `X-Timestamp` within ±5 min for replay protection.
- `POST /api/public/landing-pages/$connectionId/api/orders` — API-key method. Verifies `Authorization: Bearer <apiKey>` against stored hash.
- `POST /api/public/landing-pages/$connectionId/embed/orders` — embed/JS method with per-connection public token + Origin allow-list.
- `GET  /api/public/landing-pages/$connectionId/health` — simple ping for the Test button.
- `GET  /api/public/landing-pages/embed.js` — tiny form-serialization script; posts to embed endpoint.

Shared pipeline inside a server-only helper `landing-pages.server.ts`:

```text
Verify auth/signature → parse+Zod validate → apply field map →
resolve product (map or default_product_id) → build idempotency key
(external_order_id || sha256(body)) → check unique index →
supabaseAdmin insert into orders + order_items with source metadata →
write success log → return { ok, orderId, invoiceNo }
```

On duplicate: return 200 with `{ ok: true, duplicate: true, orderId }` and log as `duplicate`. On failure: log with human message, return sanitized error. Rate limit per connection (in-memory token bucket per worker + persisted counter on the connection row — best-effort, not billing-critical).

Order arrives in existing Store Admin orders list, invoice numbering runs on confirm as today. Courier + payment flows unchanged.

## 4. UI

- New sidebar entry: **Integrations → Landing Pages** (add to existing Store Admin sidebar group; do not touch other entries).
- Route: `src/routes/_authenticated/admin/landing-pages.index.tsx` — dashboard: 6 summary cards, connection table/cards, `+ Connect Landing Page` button.
- Route: `src/routes/_authenticated/admin/landing-pages.$id.tsx` — tabs: Overview / Configuration / Product Mapping / Field Mapping / Orders / Logs / Documentation.
- Wizard dialog `LandingPageWizard.tsx`: Step 1 Basics → Step 2 Platform → Step 3 Method (webhook/api/embed) → Step 4 Product Mapping → Done (shows credentials once with copy buttons; secret masked after leaving).
- Copy/reveal/regenerate buttons, confirmation dialogs, empty/loading/error states, mobile-friendly cards — matches existing Payment Gateway page conventions and tokens.
- Docs tab renders platform-specific instructions (Custom HTML, WordPress, WooCommerce, Shopify, Webflow, Wix, Universal) from a static content map — beginner-friendly, no code dumps beyond what's needed.

## 5. Orders page additions (non-destructive)

- Add filter chips: All / Store / Landing Page / Shopify / WooCommerce / Other. Existing status filter kept.
- Order row: show source badge when `source != 'store'`; `TEST ORDER` badge when `is_test`.
- Order details drawer: new "Source" section with landing page name (link to its detail page), platform, integration method, external order ID, landing page URL, UTM table.

## 6. Security

- Owner-only RLS on all new tables + `is_store_owner` guard in every server fn.
- Webhook secret + API secret encrypted with existing `PAYMENT_CREDENTIALS_KEY` (AES-256-GCM via `src/lib/crypto/credentials.server.ts`); plaintext returned only at create/rotate.
- API key stored as `sha256` hash + last-4 for display.
- HMAC signature verification, timestamp replay window, idempotency unique index, per-connection rate limit, input Zod validation, origin allow-list for embed.
- Test orders never dispatched to couriers (existing courier flow already manual).

## 7. Out of scope (kept as future-safe hooks)

- Order status push-back to external platform (columns/log types reserved; not wired).
- Dedicated WordPress plugin binary (architecture supports it via API/webhook endpoints).
- Automatic Shopify product sync (only order intake; product mapping is manual).

## Verification

- Migration applies clean; new tables invisible to other stores (RLS check via `read_query` as two users).
- Dashboard renders; wizard creates a connection; credentials shown once.
- `Test Connection` and `Send Test Order` succeed; test order appears in Orders with `TEST ORDER` + Landing Page badges, no courier call.
- Real webhook POST with valid HMAC creates an order; second identical POST returns duplicate, no new order.
- Invalid signature / bad API key → 401, logged as `unauthorized`.
- Existing Orders, Couriers, Payments, Products pages unchanged.
