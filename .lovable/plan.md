
# ORZEN Enterprise AI Sales Agent

The platform already ships a centralised AI engine (`ai_global_settings`, `store_ai_agents`, `ai-agent.server.ts` with 15+ tools, Messenger inbox, plan-gated storefront icon, usage logging). This plan closes the gaps between what exists and the enterprise spec, without rebuilding what works. Delivered in 4 phases so you can approve/ship incrementally.

## Current state (verified)

- ONE global AI key + model in `ai_global_settings` (Winner Admin controlled) ✓
- Per-store agent config, plan-gated icon, RLS isolation ✓
- Tools: searchProducts, listCategories, sendProductCard/Carousel, collectOrderInfo, finalizeOrder, trackOrder, getRelatedProducts, getCustomerMemory, escalateToHuman ✓ (Messenger only)
- Usage logging in `ai_usage` ✓

## Gaps to close

1. Storefront web chat has no conversation persistence, no tools, no order/tracking/escalation — only free-form streamText.
2. Winner Admin can set model + key, but not temperature, max tokens, global system prompt, brand voice, safety rules, supported languages.
3. No voice (STT/TTS) pipeline on Messenger.
4. No image-understanding pipeline (customer uploads a product photo).
5. No explicit confidence signal — escalation is only when the model chooses.
6. Human handover for web chat (Messenger has takeover already).

---

## Phase 1 — Web chat parity with Messenger (biggest UX win)

Goal: the storefront widget behaves like Messenger — memory, product cards, order taking, tracking, escalation.

- `ai_conversations` + `ai_messages`: add a `web` channel row per browser session (localStorage `orzen_ai_cid`).
- `src/routes/api/ai/chat.ts`: create/load conversation, persist user + assistant messages, pass `conversationId` into `buildTools(ctx)`.
- Reuse existing tools; add a lightweight `webRenderProductCard` alias so results stream inline (the Messenger `sendProductCard` short-circuits when `psid` missing — return structured JSON instead).
- `AIChatPanel.tsx`: render tool-result product cards (image, name, price, stock, "View" + "Order now" buttons that deep-link to product page / trigger order flow).
- Add "Talk to a human" button → creates `admin_notifications` row + sets conversation `needs_human=true` (already exists on the table).
- Load recent history on panel open for returning visitors.

## Phase 2 — Winner Admin global controls

Goal: single control room for the entire platform's AI behaviour.

- Extend `ai_global_settings` columns: `temperature numeric`, `max_tokens int`, `global_system_prompt text`, `safety_rules text`, `brand_voice text`, `supported_languages text[]`, `fallback_model text`.
- `src/routes/_authenticated/owner/ai.tsx`: tabbed UI (Provider & Key · Model & Params · Global Prompt · Safety · Brand voice · Languages · Usage).
- `buildSystemPrompt` in `ai-agent.server.ts` prepends `global_system_prompt`, `safety_rules`, `brand_voice`; `streamText`/`generateText` pass `temperature` and `maxOutputTokens`.
- Fallback model: on gateway 429/5xx, retry once with `fallback_model` before surfacing error.

## Phase 3 — Voice + image understanding

Goal: Messenger + web chat accept voice notes and product photos.

- Voice: Messenger webhook detects `attachments[].type === "audio"`, downloads via `pageToken`, calls Lovable AI Gateway `/v1/audio/transcriptions` with `openai/gpt-4o-transcribe`, feeds text into the same agent pipeline. Optional TTS reply behind a per-store toggle (`voice_reply_enabled` on `store_ai_agents`) using `openai/gpt-4o-mini-tts`.
- Image: Messenger `attachments[].type === "image"` and web chat file upload → pass image as multimodal `image` part to `openai/gpt-5.5` with instruction "identify the product category/keywords". Feed keywords into `searchProducts` and return matches. Store attachment URL in `ai_messages.attachments`.

## Phase 4 — Confidence + safer handover

Goal: never guess; escalate cleanly.

- Add `confidence` output requirement to the system prompt ("emit `[[conf:HIGH|MED|LOW]]` at end of each reply"), parse+strip before sending to user.
- LOW → auto-call `escalateToHuman` and reply with the polite fallback.
- Track `confidence` on `ai_messages` for analytics.
- Frustration heuristic: 2 consecutive user messages with negative intent keywords (regex, both bn/en) → auto-escalate.

---

## Non-goals for this plan

- No new AI provider integration (Lovable AI Gateway only).
- No WhatsApp/Instagram/Telegram connectors — architecture already supports them via the same `AgentContext`, but wiring each is separate work.
- No changes to Messenger inbox UI, duplicate protection, or plan gating (already working).

## Technical notes

- All new columns via `supabase--migration` with GRANTs.
- All server-only code stays in `*.server.ts`; server functions in `*.functions.ts` reachable through `useServerFn`.
- New `/api/ai/chat` conversation ID flows via request body; RLS unaffected (admin client, store-scoped queries).
- Cost impact: voice/image raise per-message cost — Winner Admin can toggle each feature globally.

## Suggested rollout order

Phase 1 → Phase 2 → Phase 4 → Phase 3 (voice/image last; highest cost, most infra).

Approve the whole plan or tell me which phase to build first.
