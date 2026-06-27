
## AI Sales Agent — Multi-Tenant System

A modular AI layer added on top of the existing platform. Owner controls global AI settings + provider key; each store gets its own isolated agent with its own knowledge, behavior, and chat history. Storefront gets a lazy-loaded chat widget; Messenger integration is scaffolded with webhook + connect flow.

By default we use the built-in **Lovable AI Gateway** (no user-supplied API key required) with `google/gemini-3-flash-preview`. The Owner's "Connect AI Provider API Key" field is optional — if set, it overrides the gateway; if empty, the platform key is used. This keeps the system usable out-of-the-box.

---

### 1. Database (single migration)

New tables (all RLS-enabled, store-scoped):

- `ai_global_settings` (singleton row, owner-only) — `enabled`, `default_model`, `provider_api_key` (nullable, owner-only readable), `created_at/updated_at`.
- `ai_usage` — `id`, `store_id` (nullable for owner-level), `model`, `prompt_tokens`, `completion_tokens`, `cost_usd`, `kind` (chat/messenger), `created_at`. Indexed by `store_id, created_at`.
- `store_ai_agents` — one row per store: `store_id` (unique FK), `enabled`, `agent_name`, `welcome_message`, `language` (bn/en/both), `style`, `use_emoji`, `human_like`, `knowledge` jsonb `{ store_info, delivery_policy, return_policy, warranty_policy, payment_methods, business_hours, faqs:[{q,a}] }`.
- `ai_conversations` — `id`, `store_id`, `channel` (web/messenger), `external_id` (messenger PSID, nullable), `customer_name`, `phone`, `address`, `status`, `created_at`.
- `ai_messages` — `id`, `conversation_id`, `role` (user/assistant/system/tool), `content`, `created_at`.
- `messenger_integrations` — `store_id` (unique), `page_id`, `page_access_token` (encrypted/owner-managed at app level), `verify_token`, `connected_at`, `status`.

Every new public table gets explicit `GRANT` + RLS:
- `store_ai_agents`, `ai_conversations`, `ai_messages`, `messenger_integrations`: owner-of-store via existing `stores.owner_id` check; platform owner via `has_role(uid,'owner')`.
- `ai_global_settings`, owner-wide `ai_usage`: `has_role(uid,'owner')` only.
- Storefront widget reads agent config + writes conversations through server functions (publishable-key path with store scoping), not direct table access for writes.

### 2. Server functions (`src/lib/ai.functions.ts` + `ai.server.ts`)

Lovable AI Gateway helper in `src/lib/ai-gateway.server.ts` (per knowledge file). Reads `LOVABLE_API_KEY`; falls back to `ai_global_settings.provider_api_key` if owner configured a custom one.

Functions:
- Owner: `getAiGlobalSettings`, `updateAiGlobalSettings`, `getAiUsageStats` (totals, by store, last 30 days).
- Store admin: `getMyAgent`, `updateMyAgent` (general/knowledge/behavior in one upsert).
- Storefront chat: `chatWithAgent({ slug, conversationId?, messages })` — streams via `streamText`, loads store's products/categories/stock + agent knowledge as system context, logs usage to `ai_usage`, persists to `ai_conversations`/`ai_messages`. Tool calls:
  - `searchProducts(query)` → only this store's products.
  - `getProduct(id)` → price/stock/details, scoped.
  - `placeOrder({ items, name, phone, address })` → creates `orders` + `order_items` for this store, returns order id.
- Messenger: `connectMessenger`, `disconnectMessenger`, public webhook route below.

All store-scoped functions resolve `store_id` from the slug or auth context and pass it explicitly to every DB query — no cross-store reads possible.

### 3. Storefront chat widget (lazy)

- `src/components/storefront/AIChatLauncher.tsx` — tiny (~1 KB) floating button only. No AI code, no markdown lib, no streaming code.
- On click → `React.lazy(() => import("./AIChatPanel"))` loads the heavy panel: message list, input, streaming via `useChat` → `/api/ai/chat`.
- Mounted from `src/routes/store/$slug/route.tsx` only when `store_ai_agents.enabled = true` (already in loader data — no extra request).
- Uses store theme variables already on the layout.
- Mobile-first sheet on small screens, bottom-right panel on desktop.
- Conversation id stored in `localStorage` per store slug for continuity.

Server route: `src/routes/api/ai/chat.ts` (streaming `POST`, validates slug, calls `chatWithAgent`).

### 4. Messenger integration

- Admin page `src/routes/_authenticated/admin/messenger.tsx`: Connect Facebook Page form (page id + page access token + auto-generated verify token), status, disconnect.
- Public webhook route `src/routes/api/public/messenger/webhook.ts` — `GET` for FB verification, `POST` for messages. Looks up `messenger_integrations` by `page_id`, resolves `store_id`, runs the same agent logic (non-streaming), replies via Graph API. No streaming.
- Full OAuth login flow is out of scope for phase 1 — user pastes page access token. Documented in the UI.

### 5. Admin UI additions

Store Admin sidebar (`src/routes/_authenticated/admin/route.tsx`) — add two links:
- **AI Sales Agent** → `/admin/ai-agent` (tabs: General · Knowledge · Behavior).
- **Messenger** → `/admin/messenger`.

Owner sidebar (`src/routes/_authenticated/owner/route.tsx`) — add:
- **AI Settings** → `/owner/ai` (enable toggle, optional provider key field, default model select, usage dashboard: total tokens, est. cost, per-store breakdown).

All forms reuse existing `SettingsPage`, `Input`, `Textarea`, `Switch`, `Button`. No new UI libs.

### 6. Security & isolation

- Every agent server fn derives `store_id` server-side from slug or authenticated owner. Tool implementations always filter by that `store_id`.
- Tool schemas exposed to the model never accept a `store_id` argument — model cannot target another store.
- `messenger_integrations.page_access_token` and `ai_global_settings.provider_api_key` are select-restricted by RLS to owner/store-owner respectively; never sent to the client.
- Webhook verifies FB signature (`x-hub-signature-256`) using app secret stored as a Lovable secret.

### 7. Performance

- Widget: launcher only on first paint (button + 1 icon). Panel + AI SDK loaded on click.
- No tracking scripts touched; no extra network calls on homepage.
- Server route streams responses (`toUIMessageStreamResponse`).
- Agent enabled flag included in existing `getStoreBySlug` response — zero extra queries on storefront load.
- `staleTime` continues to apply; queries unchanged.

### 8. Secrets

- `LOVABLE_API_KEY` — already present.
- `FB_APP_SECRET` — request via `add_secret` only when user starts the Messenger flow (not now).

### Out of scope (ask later)
- Full Facebook Login OAuth flow (phase 1 uses pasted page token).
- WhatsApp / Instagram channels.
- Voice / image input.
- Fine-tuning or per-store custom models.

---

### Build order
1. Migration (tables + RLS + grants).
2. Gateway helper + `ai.functions.ts` (chat + tools + usage logging).
3. Owner AI Settings page + route.
4. Store Admin AI Agent page (3 tabs).
5. Lazy chat widget + `/api/ai/chat` route + mount in store layout.
6. Messenger admin page + public webhook route + connect/disconnect.
7. Verify: storefront LCP unchanged, cross-store isolation test, order creation from chat.
