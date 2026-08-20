# WhatsApp AI Messaging — mirroring the Messenger system

Add a complete WhatsApp Cloud API channel that works exactly like the existing Messenger channel: per-store connection, AI sales agent, inbox with human takeover, order flow, notifications and basic analytics. Messenger code stays untouched — WhatsApp reuses the same core AI/business logic through a channel-aware layer.

## Sidebar

Under **AI & Automation**, after the existing Messenger and Messenger Inbox entries:

```text
Messenger
Messenger Inbox
WhatsApp Integration   (new)
WhatsApp Inbox         (new)
```

Same styling, WhatsApp icon, same unread badge behaviour (separate WhatsApp count).

## WhatsApp Integration page (`/admin/whatsapp`)

Mirrors the Messenger settings page layout and card style.

- Connect form: Phone Number ID, WhatsApp Business Account ID, Access Token, App Secret (for webhook signature), auto-generated Verify Token, webhook URL with copy button.
- Status indicator: Not connected / Connecting / Connected / Error / Disconnected.
- Actions: Connect, Test Connection, Send Test Message, Reconnect, Disconnect, Regenerate verify token, Clear error.
- When connected, shows: display name, phone number, quality rating (if returned), Phone Number ID, WABA ID, last successful check, last error.
- AI toggles matching Messenger: auto reply, human takeover, order detection, product recommendation, FAQ reply.
- Webhook health block: subscription status, last webhook received, last event type, last error, "Test webhook" diagnostic.
- Message Templates section: sync templates from Meta, list name / language / category / status (Pending, Approved, Rejected) — read-only status straight from Meta, never assumed approved.
- Tokens and secrets are stored encrypted and never returned to the browser; UI shows a masked "configured" state only.

## WhatsApp Inbox page (`/admin/whatsapp-inbox`)

Same layout, components and behaviour as Messenger Inbox, but scoped to `channel = 'whatsapp'`:

- Left panel: conversation list with name, phone, last message, time, unread count, search; filters All / Unread / Open / Waiting / Resolved / AI handled / Human handled.
- Thread view: customer, AI and admin messages, timestamps, delivery/read ticks, images, product messages, links, order messages.
- Composer: text, image attachment, product picker, link, emoji, saved replies, send.
- AI/Human toggle, Take over, Return to AI, Mark resolved — reusing the existing handoff fields.
- 24-hour session window awareness: when the last inbound message is older than 24h, free-form send is blocked with a clear notice and a template-send option instead (WhatsApp policy).

## AI behaviour

The same agent as Messenger — no second AI system. `ai-agent.server.ts` gains a `whatsapp` channel so the same prompt, store knowledge (products of all types, prices, discounts, stock, images, links, delivery, payments, policies), tools and conversation memory run over WhatsApp; only the send/rendering layer differs.

- Physical products: full ordering inside WhatsApp using the admin-configured order flow (same `order_flow` config as Messenger, shared — one place to configure).
- Digital / Service / Subscription: explain, show image and info, send the website link, tell the customer to complete purchase on the site. Never collect payment credentials in chat.
- The existing text sanitizer runs on every WhatsApp reply, so the AI can never say "see the image below" unless an image is actually attached; if no image exists it says so plainly.
- Bangla/English mirroring, concise natural replies, no repetition — same rules as Messenger.

## Product messages on WhatsApp

WhatsApp has no Messenger-style carousel, so product presentation maps to: image message + caption (name, price, old price, availability, short description, benefits) followed by an interactive reply-buttons message ("Buy now", "View site"). Where interactive buttons are unavailable, a plain link and a "Buy now" keyword reply is used. Button replies feed the same order-flow handler used by Messenger postbacks.

## Notifications & analytics

- Reuses the existing notification dispatcher: new WhatsApp conversation, new customer message, order placed via WhatsApp, human-support request, handoff, order confirmation.
- Analytics block on the Integration page: total / new / unread conversations, AI vs human handled, orders from WhatsApp, conversion rate, messages sent and received.

## Technical notes

- **Database (one migration, RLS + GRANTs, all store-scoped):**
  - `whatsapp_integrations` — mirrors `messenger_integrations` (store_id unique, phone_number_id, waba_id, display_name, phone_number, access_token_encrypted, app_secret_encrypted, verify_token, status, permissions, ai flags, last_verified_at, last_error, delivery_failures, webhook fields).
  - `whatsapp_templates` — store_id, name, language, category, status, body preview, synced_at.
  - `whatsapp_webhook_events` — store_id, event type, payload, received_at, error (health + dedupe).
  - Conversations and messages reuse `ai_conversations` / `ai_messages` with `channel = 'whatsapp'` (external_id = customer WA id), so inbox, handoff, notes, tags, lead status and orders linkage all work unchanged. No duplicate tables.
  - Policies follow the existing owner-scoped pattern (`is_store_owner(store_id)`), service_role for webhook writes.
- **Server code:**
  - `src/lib/whatsapp-send.server.ts` — Cloud API senders (text, image, interactive buttons, template, mark-as-read).
  - `src/lib/whatsapp.functions.ts` — connect/disconnect/test/send-test/verify/refresh/template-sync/AI flags, all under `requireSupabaseAuth` + owned store.
  - `src/lib/whatsapp-inbox.functions.ts` — same server-fn surface as `messenger-inbox.functions.ts`, channel-filtered.
  - `src/routes/api/public/whatsapp/webhook.ts` — GET verify challenge, POST with `X-Hub-Signature-256` HMAC verification against the store's app secret, routed to the store by phone_number_id; handles messages, statuses (sent/delivered/read/failed), media, button replies.
  - Shared agent logic factored channel-agnostically inside `ai-agent.server.ts` (send adapter injected), leaving all Messenger paths and behaviour intact.
- **UI:** `src/routes/_authenticated/admin/whatsapp.tsx` and `whatsapp-inbox.tsx`, built from the existing Messenger pages' components and styling, mobile responsive, behind the same `FeatureGate` plan gate pattern.
- **Errors:** invalid credentials, expired token, disconnected number, webhook failure, API failure, rate limit, unsupported type and failed delivery are mapped to friendly admin-facing messages; raw API payloads are logged server-side only.
