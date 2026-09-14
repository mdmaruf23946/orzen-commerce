# AI Command Center — Merchant Panel

Ekta central "AI Command Center" toiri hobe Merchant Panel-e, jekhane Master AI Agent + 9 ta sub-agent thakbe. Merchant nijer Messenger/WhatsApp theke business control korte parbe, customer-ra shudhu public support pabe, ar prottek merchant-er data strictly alada thakbe.

Ei plan Admin Winner Panel-er kono kichu sposhbo korbe na — oi dik-er AI Admin Control jemon ache temon-i thakbe.

## Ki toiri hobe

### 1. Sidebar reorganize
"AI & Automation" group-er scattered link gulo (AI Sales Agent, AI Recommendations, Handoff Queue, Messenger, Messenger Inbox, WhatsApp, WhatsApp Inbox, Facebook Page) sidebar theke sore ekta entry hobe:

```text
AI & AUTOMATION
└── AI Command Center
```

Purono URL gulo kaj korbe (redirect), tai bookmark ba purono link vangbe na. Purono page-er functionality notun Command Center-er vitore tab/page hisebe thakbe — kichu delete hocche na.

### 2. Command Center dashboard
Master Agent upore boro card-e (status, ajker command count, pending approvals). Niche sub-agent gulo card grid-e:

Messenger, WhatsApp, Facebook Page, Sales, Order, Customer, Courier, Notification, Human Handoff — prottek-e short description, status badge (Active / Needs Setup / Paused / Error), last activity, ar Enable/Disable + Settings.

Mobile responsive, premium look, existing design token diye.

### 3. Master Agent (orchestration)
Merchant-er command (Messenger/WhatsApp/panel chat) → Master Agent bujhe → dorkari sub-agent chalabe, dorkar hole ek command-e kayekta (customer khoja → order toiri → courier submit → notification)। Proti step activity log-e jabe.

Agent registry modular: future-e Payment/Inventory/Analytics/Marketing Agent ekta file add korlei jog hobe.

### 4. Merchant identity verification
Merchant Settings-e nijer Messenger PSID ebong WhatsApp number add korbe (verify code diye confirm)। Same page/number-e:
- Authorized sender → Master Agent (business control)
- Onno sobai → Customer AI (shudhu public info)

Prompt-injection guard: keu "ami owner" likhleo business access pabe na — shudhu verified PSID/number-i chole.

### 5. Permission system (3 level)
- Auto — AI nijei kore (FAQ, product info, search, recommendation)
- Approval Required — AI prostut kore, merchant Approve/Reject korle tobei execute (order cancel, refund, courier submit, verification, boro change)
- Restricted — kokhonoi na (secret/key dekha, onno merchant-er data, permission bypass)

Approval merchant-er kache Messenger/WhatsApp-e button/reply diye ebong panel-e "Approvals" page-e ashbe. Pending action-er expiry thakbe.

### 6. Sub-agent kaj
- Sales: product, price, variant, stock — database theke real data, tarpor order flow
- Order: create/search/update/verify/cancel, customer-product match
- Customer: search, profile, order history (shudhu nijer store-er)
- Courier: address validate, shipment create, tracking, status (existing courier integration diye)
- Notification: shudhu important event-e (notun customer, order, payment, AI fail, human chai, high-risk) — "Hi/price koto" e noy; rules merchant control korbe
- Human Handoff: customer human chaile merchant-ke context soho notification, merchant Messenger/WhatsApp theke reply korte parbe
- Facebook Page: comment reply, post, moderation, spam — existing Facebook module-ke agent hisebe organize kora

### 7. Settings + logs
AI Settings: General, Agent Management, Agent Permissions, Auto/Approval/Restricted Actions, Notifications, Messenger, WhatsApp, Facebook Page, Merchant Identity, Security, Activity Logs.

Activity Log: prottek command/step/result timestamp soho; sensitive data log hobe na.

### 8. Plan gating
Command Center ebong agent gulo plan feature diye control hobe. Plan-e na thakle English "Update" action dekhabe ja billing page-e niye jabe; expired plan hole Free-plan access-e nambe.

## Technical notes

- Notun table (sob store_id scoped, RLS `has_store_access(store_id)` + staff section permission): `store_ai_agents_registry` (per-store agent enable/status/config), `store_ai_identities` (merchant PSID/WhatsApp, verified flag), `store_ai_permissions` (action → auto/approval/restricted), `store_ai_pending_actions` (approve/reject, expiry), `store_ai_activity_logs`, `store_ai_notification_rules`, `store_ai_threads`/`store_ai_thread_messages` (merchant command history)। Existing `store_ai_agents`, `messenger_integrations`, `whatsapp_integrations`, `facebook_page_integrations`, `ai_conversations` reuse hobe — replace na.
- Orchestration code: `src/lib/merchant-ai/` — `registry.ts`, `master.server.ts`, `identity.server.ts`, `permissions.server.ts`, `activity.server.ts`, `notify.server.ts`, ar per-agent `agents/*.server.ts` (sales, order, customer, courier, messenger, whatsapp, facebook, handoff, notification)। Tool gulo Zod-validated, prottek tool call-e storeId server side theke ashe — AI kokhono storeId choose korte parbe na (cross-tenant leak impossible by construction)।
- Existing webhook gulo (`/api/public/messenger/webhook`, `/whatsapp/webhook`, `/facebook/webhook`) same URL-e thakbe; vitore shudhu router boshbe: verified merchant identity → Master Agent, onno sobai → existing customer sales agent. Credentials/verify token/signature kichu bodlabe na.
- Server-only: sob AI call, key ebong tool execution `createServerFn` / server route-e; browser-e kono secret jabe na. Rate limit, HMAC signature verify, webhook dedup, authorization check protita entry point-e.
- Routes: `src/routes/_authenticated/admin/ai.*.tsx` (index, agents, approvals, identity, settings, logs + per-agent detail); purono path gulo notun path-e redirect।
- Cloudflare deployment-e already-thaka server-env forwarding layer-i use hobe, notun kichu lagbe na.

## Phases

1. Database schema + RLS + grants, agent registry, permission defaults
2. Backend: identity verify, master orchestrator, permission engine, activity log, notification rules
3. Sub-agent tools (sales, order, customer, courier, handoff, facebook) real data diye
4. Channel routers: Messenger, WhatsApp, Facebook — existing webhook-er vitore
5. UI: Command Center dashboard, agent pages, approvals, settings, logs; sidebar consolidate + redirects; plan gating
6. End-to-end test: merchant command → Master → sub-agent → DB/API action → result → notification + log; ar customer side theke check je kono internal data leak hocche na
