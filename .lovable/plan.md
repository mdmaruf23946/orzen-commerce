# AI Admin Control (Winner Admin Panel)

A new module inside the existing Winner Admin Panel that lets you run the platform from WhatsApp: ask questions in plain Bangla/English, get real answers, approve things, and receive live alerts when something important happens on the site.

Nothing existing is changed or removed — this is added alongside the current sections.

## What you get

**New sidebar group "AI Admin Control"** with eight pages:

1. **Overview** — WhatsApp status, AI agent status, today's commands, successful/failed actions, pending approvals, recent notifications.
2. **WhatsApp Connection** — connect your WhatsApp Business number (Phone Number ID, Business Account ID, access token, app secret, webhook URL + verify token). Credentials are stored encrypted and never shown back in full — only a masked hint. Buttons: Verify Connection, Test Connection, Disconnect.
3. **AI Agent** — enable/disable the agent, choose reply language (Bangla/English/auto), set the verified admin phone numbers allowed to command it, plus the conversation history view (date, time, who, command, AI reply, action executed, result).
4. **Notifications** — on/off per event (new user, new subscription, payment, new order, failed payment, pending subscription alert, system alert), with an editable message template and recipient number per event.
5. **Commands & Permissions** — a switch per action group and per individual action. The AI can only use what is switched on. Refund / delete user / admin management default to OFF.
6. **Automation** — scheduled digests (daily summary, pending-approval reminder) and the event → notification rules.
7. **Activity Logs** — full audit trail of every AI action with filters and result status.
8. **Settings** — risk thresholds (which actions need confirmation), rate limits, and **Test Mode** (send a test New User / Payment / Subscription / Order notification, and run a test command like "Show today's users" without WhatsApp).

## How it works

- You message your connected WhatsApp number.
- The webhook verifies Meta's signature and checks the sender is a verified admin number; anyone else is ignored.
- The AI reads your message, picks a tool from an allow-listed action layer, and checks the permission switches.
- Low-risk (read-only) actions run immediately. Medium-risk actions ask "Confirm?" and wait for your reply. High-risk actions require a typed confirmation word and an explicitly enabled permission.
- The action runs through server-side code with the same rules the admin panel uses, then the result comes back on WhatsApp and is written to the audit log.
- When a new user signs up, a payment or subscription arrives, or an order comes in, you get a WhatsApp message — and for approvals you can just reply "Approve" or "Reject".

## Actions available to the AI

Read: today's users / orders / revenue, subscription stats, active users, pending payments, pending subscriptions, search user / order / product / transaction, view details.

Write (permission-gated + confirmation): change user plan, suspend/activate user, approve/reject/cancel/renew subscription, change subscription plan, approve/reject payment, change order status, update product price, enable/disable product, update stock.

## Technical notes

**Database (new tables only, no changes to existing ones):**
`ai_admin_connections` (encrypted WhatsApp credentials, status, connected number), `ai_admin_settings`, `ai_admin_permissions`, `ai_admin_threads` + `ai_admin_messages` (conversation history — named separately so the existing store `ai_conversations`/`ai_messages` tables are untouched), `ai_admin_pending_actions` (awaiting confirmation, with expiry), `ai_admin_action_logs`, `ai_admin_notification_rules`, `ai_admin_webhook_events` (raw payload + dedup on message id). All RLS-enabled, owner-only via `has_role(auth.uid(),'owner')`, with GRANTs; webhook writes use the service role.

**Server code:**
- `src/lib/ai-admin/tools.server.ts` — the allow-listed tool layer. Each tool declares a Zod input schema, a risk level, a permission key, and a handler that reuses existing server logic where it exists (subscriptions, payments, orders, products, users). No free-form SQL is ever exposed to the model.
- `src/lib/ai-admin/agent.server.ts` — AI SDK `generateText` with `tools`, `stopWhen: stepCountIs(50)`, via the Lovable AI Gateway provider (`src/lib/ai-gateway.server.ts`). Permissions filter the tool set before the call.
- `src/lib/ai-admin/notify.server.ts` — event → template → WhatsApp send, reusing `src/lib/notify/whatsapp.server.ts`.
- `src/lib/ai-admin.functions.ts` — owner-authenticated server functions for all panel reads/writes, credential save (encrypted with `src/lib/crypto/credentials.server`), verify/test/disconnect, and Test Mode triggers.
- `src/routes/api/public/ai-admin/webhook.ts` — GET verify challenge + POST with HMAC signature verification, sender allow-list, per-minute rate limit, dedup, and event logging. Modelled on the existing `api/public/whatsapp/webhook.ts` but kept separate so store messaging is unaffected.

**Event hooks:** notification triggers are added at the existing signup, subscription-transaction, payment and order-create paths as fire-and-forget calls that never block or fail the original operation.

**UI:** routes under `src/routes/_authenticated/owner/ai-admin.*.tsx` following the existing owner page patterns (shadcn cards/tabs/switches, mobile-friendly), plus one new sidebar group in `src/routes/_authenticated/owner/route.tsx`.

## Build order

1. Migration + permissions/settings defaults
2. WhatsApp Connection page + verify/test/disconnect
3. Tool layer + agent + confirmation flow
4. Webhook + sender verification + rate limiting
5. Notifications, automation, Test Mode
6. Overview, conversation history, activity logs
