
## Goal

Upgrade the Store Admin → Messenger page from the current 2-field form (Page ID + Page Token) to a complete Meta Messenger integration console covering credentials, webhook, permissions, live status, AI behavior toggles, test tools, and a compact dashboard — mobile-first.

## Database changes (one migration)

Extend `public.messenger_integrations` with:

- `page_name text`, `page_picture_url text` — filled from Meta Graph after connect.
- `app_id text`, `app_secret_encrypted text` — optional, secret encrypted via existing `PAYMENT_CREDENTIALS_KEY` helper (`src/lib/crypto/credentials.server.ts`).
- `page_access_token_encrypted text` — replaces plaintext storage; keep old `page_access_token` column temporarily, migrate values into the encrypted column, then set old column to `NULL`. Reads always go through decrypt.
- `token_expires_at timestamptz null` — parsed from Meta `debug_token`.
- `permissions jsonb default '[]'` — cached scope list from `debug_token`.
- `last_verified_at timestamptz`, `last_error text`.
- `ai_auto_reply boolean default true`, `human_takeover boolean default false`, `conversation_history boolean default true`, `order_detection boolean default false`, `product_recommendation boolean default false`, `faq_reply boolean default true`.
- Daily counters view/RPC `get_messenger_daily_stats(store_id)` returning `{ messages_today, failed_today, last_incoming_at }` from `ai_conversations` + `ai_messages` (channel = `messenger`) plus a new `messenger_delivery_failures` counter written from the webhook / send helper.

RLS: existing store-owner policy already covers new columns. Add `service_role` grant explicitly (already implicit) — no anon.

## Server functions (`src/lib/ai.functions.ts`)

Replace the current 3 messenger fns with a fuller set — all `requireSupabaseAuth` + `assertPlan("ai_messenger")`:

1. `getMessengerIntegration` → returns full row minus raw encrypted blobs, plus derived `webhook_url`, decrypted `verify_token`, `permissions`, `token_expires_at`, `page_name`, `page_picture_url`, `last_error`, `stats` from the RPC.
2. `connectMessenger({ page_id, page_access_token, app_id?, app_secret? })`:
   - Call Meta Graph `GET /{page_id}?fields=name,picture{url}` with the token → fills `page_name`, `page_picture_url`. Fail with a clear message on 4xx.
   - If `app_id` + `app_secret` supplied, call `debug_token` → capture `scopes`, `data_access_expires_at`/`expires_at`.
   - Encrypt token (and app secret if present) via `encryptJSON`. Generate verify_token if none exists.
   - Upsert row with `status='connected'`, `last_verified_at=now()`, clear `last_error`.
3. `verifyMessengerWebhook()` — server-side self-check: GET the app's `/api/public/messenger/webhook?hub.mode=subscribe&hub.verify_token=…&hub.challenge=ping` using the published URL; success writes `last_verified_at`, failure writes `last_error`.
4. `sendMessengerTestMessage({ recipient_id })` — decrypts token, POSTs to Graph `/me/messages` with a canned "✅ Test from ORZEN".
5. `regenerateVerifyToken()` — replace `verify_token` (invalidates existing webhook, user must re-verify).
6. `refreshMessengerPermissions()` — re-hit `debug_token` (needs app_id/app_secret); updates `permissions` + `token_expires_at`.
7. `updateMessengerAiFlags({ ai_auto_reply, human_takeover, ... })` — updates the 6 boolean toggles.
8. `disconnectMessenger` — unchanged behavior, also clears cached page metadata.

Webhook route (`src/routes/api/public/messenger/webhook.ts`):
- Decrypt token when sending replies.
- When `human_takeover=true` OR `ai_auto_reply=false`: skip AI, just persist the incoming message.
- On send failure, `UPDATE messenger_integrations SET last_error=$1` and increment failure counter.
- Optional `X-Hub-Signature-256` verification when `app_secret_encrypted` is present.

## Admin UI rewrite (`src/routes/_authenticated/admin/messenger.tsx`)

Mobile-first single-column layout that becomes 2-column ≥ `lg`. Sections top → bottom:

1. **Dashboard card** — page picture, page name, status pill (Connected/Disconnected/Error), webhook pill, AI pill, 3 mini-stats (Messages today, Failed, Last incoming), token expiry countdown with "Refresh token" reminder when < 7 days.
2. **Connection form** — Page ID, Long-lived Page Access Token (password + Show/Hide + Copy), App ID (optional), App Secret (password + Show/Hide, optional). Client-side validation (required lengths, digits for page id). Buttons: Connect / Save Changes / Disconnect / Reconnect.
3. **Webhook card** — Webhook URL (read-only, Copy). Verify Token (read-only, Show/Hide, Copy, Regenerate). Status pill + "Verify Webhook" button (calls `verifyMessengerWebhook`). Shows `last_verified_at` and `last_error`.
4. **Permissions card** — list of required scopes with green ✓ / red ✗ derived from `permissions`. Note when app_id/app_secret missing that permissions can't be checked. "Refresh permissions" button.
5. **AI behavior card** — 6 toggle switches (Auto Reply, Human Takeover, Conversation History, Order Detection, Product Recommendation, FAQ Reply). Auto-save on change (debounced) via `updateMessengerAiFlags`.
6. **Test tools card** — "Send Test Message" (input Messenger PSID), "Verify Webhook", "Send Test Event" (posts a synthetic event to the webhook). Small live log (last 10 entries from `last_error` + verification history stored in-memory client-side per session).

Use existing shadcn `Switch`, `Card`, `Button`, `Input`. Reuse toast/pattern from current file. All copy buttons via `navigator.clipboard`. All secrets hidden by default with eye toggle. Responsive: cards stack, buttons full-width < `sm`, mini-stats use `grid-cols-3` at all sizes with truncation.

## Files to touch

- Migration: alter `messenger_integrations` + create `get_messenger_daily_stats` RPC + counter column.
- `src/lib/ai.functions.ts` — replace messenger section with 8 fns above; import `encryptJSON`/`decryptJSON` inside handlers (dynamic import to keep server-only helpers off client bundle).
- `src/routes/api/public/messenger/webhook.ts` — decrypt token, respect AI flags, record failures / errors, optional signature check.
- `src/routes/_authenticated/admin/messenger.tsx` — full UI rewrite as above.

## Out of scope

- Meta OAuth login flow (users still paste a long-lived token; documented in-page).
- Historical analytics beyond today's counters.
- Multi-page per store.
- Storefront-side changes (product recommendation & order detection use the existing AI agent context; no storefront UI change here).
