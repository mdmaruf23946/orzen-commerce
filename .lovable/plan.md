# AI Voice Call Center (ElevenLabs + Twilio)

Adds an AI voice calling layer on top of the existing Manual Call Center, without changing or removing it. Owner Admin owns all infrastructure; Store Admin gets a 5-step wizard and a simple dashboard.

## How calls actually happen

ElevenLabs Agents Platform natively owns the phone leg: Twilio numbers are imported into ElevenLabs and attached to an agent, so ElevenLabs handles the live audio, interruptions, barge-in and turn-taking. Our backend never streams audio — it only:

- creates/updates agents and imports numbers through the ElevenLabs API,
- triggers outbound calls (`/v1/convai/twilio/outbound-call`),
- exposes secure tool endpoints the agent calls mid-conversation (get order, confirm, cancel, change address, stock, delivery charge, callback, transfer, ticket),
- receives post-call webhooks to store status, result, duration, transcript and recording URL.

This is the only approach that gives natural real-time conversation on a serverless runtime.

## Owner Admin — new section "AI Call Center"

New routes under `/owner/ai-call-center`:

1. **Overview** — total / inbound / outbound calls, successful, confirmed, cancelled, no answer, failed, total minutes, active stores, active agents, active numbers, estimated cost.
2. **Providers** — ElevenLabs settings (API key, default agent, voice, language, gender, tone, system instructions) and Twilio settings (Account SID, Auth Token, region, default caller ID, webhook status), each with a Test Connection action. Keys are stored encrypted server-side using the existing AES-256-GCM credential helper and are never returned to the browser (only a masked preview).
3. **Phone Numbers** — table with number, country, assigned store, status, inbound/outbound flags, assigned agent, created date, usage, actions (assign store, change agent, enable, disable, release, view calls). A number can only go active when it has both a store and an agent.
4. **AI Agents** — create/manage agents (name, ElevenLabs agent id, voice, gender, tone, language, personality, instructions, knowledge, enabled tools, inbound/outbound, status), plus one **Master Template** agent used to auto-provision store agents.
5. **Voices & Tones** — approved voice library (name, ElevenLabs voice id, gender, language, accent, tone, speed, status) with preview playback, and tone presets whose hidden instructions only Owner Admin can edit.
6. **Behavior & Rules** — interruptions, barge-in, turn-taking, response timing, silence timeout, max response length, conversation timeout; plus auto order confirmation, delay before calling, retry count/interval, max duration, calling hours, weekend/holiday rules; plus business behavior toggles (greeting, product questions, cancellation, address change, callback, human transfer) and the AI tool allow-list.
7. **Stores** — per-store table (AI status, number, agent, voice, calls, minutes) with activate / disable / configure / assign number / assign agent / view calls / usage.

## Store Admin — simple experience

`/admin/ai-call-center`, visible only when Owner Admin enabled the feature for that store, plan-gated through the existing `FeatureGate`.

- OFF state: single "Activate AI Call Center" button.
- Wizard: **1** pick from numbers made available to that store → **2** pick an approved voice (with preview) → **3** gender → **4** tone → **5** review (store, number, voice, gender, tone, inbound, outbound, auto-confirmation) → Activate.
- On activation the backend clones the master template into a store-specific ElevenLabs agent injected with store name, info, products, delivery charges, return and warranty policy, then binds the number to it.
- Dashboard after activation: calls today, inbound, outbound, confirmed, cancelled, no answer, total minutes, plus a recent-calls list.
- Call detail: customer, phone, order, type, duration, status, result, transcript, recording. No keys, prompts, agent ids, webhooks or infrastructure fields anywhere in this panel.

## Outbound order-confirmation flow

New order → store AI enabled? → resolve store number + store agent → load full order context (customer, items, qty, prices, delivery charge, total, payment method, address, policies) → wait the configured delay → place the call inside allowed hours → agent talks → post-call webhook writes result (confirmed / cancelled / callback / no answer / wrong number / failed) and updates the order. Retries follow the configured count and interval. Scheduling runs off a queue table drained by an existing-style cron endpoint.

## Inbound flow

Twilio number → ElevenLabs → our tool endpoints receive the agent's calls with the number identity → we resolve store id from the number and answer strictly from that store's data.

## Data model (all `store_id` scoped, RLS + grants)

- `ai_voice_settings` (owner-global provider config, encrypted credentials)
- `ai_call_voices`, `ai_call_tones`
- `ai_call_agents` (template + per-store agents)
- `ai_phone_numbers`
- `store_ai_call_settings` (per-store activation, choices, status)
- `ai_calls` (extends existing call logging with direction, agent, result, cost, minutes)
- `ai_call_transcripts`
- `ai_call_queue` (outbound scheduling and retries)

Store Admin policies read/write only rows matching their own store; owner-only tables are restricted to the owner role. Manual `calls` and `call_provider_settings` stay untouched.

## Security

- `ELEVENLABS_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` live in server env / encrypted rows and are read only inside server handlers.
- ElevenLabs post-call webhooks are HMAC-verified; agent tool endpoints require a per-agent shared secret and resolve the store from that secret, never from client input.
- Every tool action re-validates that the order belongs to the resolving store before mutating.

## Delivery order

1. Database + owner provider settings + connection tests
2. Voices, tones, agents, master template
3. Phone numbers + store assignment
4. Store Admin wizard + activation provisioning
5. Outbound queue, retries, post-call webhook, results into orders
6. Inbound routing + AI tool endpoints
7. Dashboards, call details, transcripts, usage/cost

Existing pages, tables and design language are reused throughout; nothing currently working is rewritten.
