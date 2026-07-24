
## Root cause

The Messenger webhook in `src/routes/api/public/messenger/webhook.ts` intercepts almost every incoming message with hard-coded template replies **before** the LLM is ever called. The chain (lines 1180‑1249) runs, in order:

1. `parsed.message_type !== "text" && "quick_reply"` → **silently drops audio/image** (no STT, no vision).
2. `maybeHandlePendingOrderText` → fixed strings like `"যে তথ্য দিয়েছেন সেগুলো সেভ করেছি। অর্ডার কনফার্ম করতে ... দিন।"`. Once a pending order slot exists, every subsequent message is captured here and the topic can never change.
3. `maybeHandleRepeatedOrderDetails` → fixed `"আপনার অর্ডারটি ইতিমধ্যে নেওয়া হয়েছে ✅ ..."`.
4. `maybeHandleGreeting` → fixed `"আলহামদুলিল্লাহ, ভালো আছি 😊 ..."` for any hello/hi/salam.
5. `maybeSendDirectProductReply` → keyword search + fixed `"জি, X আছে — ছবিসহ..."` / `"দুঃখিত, এই নামে কোনো স্টকে থাকা প্রোডাক্ট পেলাম না..."`.

The `generateAgentReply` call at line 1268 only runs when none of the above matched, which is rare. History is capped at 12 messages and only `text/quick_reply/postback` — tool product cards and order state aren't in the model's context, so even when it does answer it lacks memory of what it just showed.

Web chat (`src/routes/api/ai/chat.ts` + `AIChatPanel.tsx`) already goes straight to the LLM with tools — issues #1‑#6 primarily apply to Messenger, but the fixes below also lift the web-chat history cap.

## What to change

### 1. Delete the hard-coded reply gates
In `src/routes/api/public/messenger/webhook.ts`:
- Remove the calls to `maybeHandleGreeting`, `maybeHandleRepeatedOrderDetails`, and `maybeSendDirectProductReply` from the incoming-message flow.
- Replace `maybeHandlePendingOrderText` with a **context-only** helper: parse any order details out of the text and merge them into the conversation slot (existing `patchConversationPendingOrder` + `parseOrderDetailsText`), then fall through to the LLM. Do not send any fixed reply. Duplicate-order blocking (`maybeBlockDuplicateMessengerOrder`) stays — that's a safety guard, not a template.
- Keep `handleBuyPostback` (it's triggered by a UI button, not a chat message), but let its acknowledgement come from the LLM by pushing the "started order for X" as a system message and calling `generateAgentReply` instead of sending a fixed string.
- Delete the now-unused template helpers so they can't be re-wired by accident.

### 2. Give the LLM the real context
In the same file, around line 1251‑1279:
- Load the last **30** turns (was 12), include `message_type` in the prompt as a small tag so the model sees `[product_card]`, `[image]`, `[audio]`, etc., not just raw text.
- Append a compact **conversation-state block** to the system prompt for this turn: pending-order slot (product, qty, missing fields), last order summary from `psid_profile.last_order`, and the last 3 recommended product ids. This is what lets the model "remember" without re-deriving from noisy history.
- Same treatment for the web-chat path: raise the SDK-side history limit and include the same state block. Web-chat history is already client-driven via `useChat`, so this is a one-line prompt-builder change.

### 3. Voice support (Messenger)
- When `parsed.message_type === "audio"`, download the first attachment URL with the page access token, POST it to `https://ai.gateway.lovable.dev/v1/audio/transcriptions` with `openai/gpt-4o-transcribe` (per the `ai-speech-to-text` knowledge), and use the transcript as the message text going into the LLM pipeline. Store the transcript in `ai_messages.content` and keep the original audio URL in `attachments` so the inbox still shows the voice note.
- Reply is text by default. Optional TTS reply is Phase 3 in `.lovable/plan.md` and is out of scope here.

### 4. Trust the model to switch topics
Because steps 1‑2 remove the interceptors, a customer who was mid-order and asks "আচ্ছা, ডেলিভারি চার্জ কত?" now reaches the LLM with the full history + the pending-order state block. The system prompt already tells it to use tools; add one line: *"If the user changes topic, answer the new question first; only resume the pending order when they signal readiness."*

### 5. No-confident-answer behavior
Add to the system prompt: *"If you cannot answer confidently from tools/store data, ask one specific follow-up question in the customer's language — never send a generic greeting or apology."* No new code; this replaces the deleted greeting/no-match templates.

## Files touched

- `src/routes/api/public/messenger/webhook.ts` — remove template gates, rewire pending-order to context-only, add audio STT branch, expand history + state block.
- `src/lib/ai-agent.server.ts` — `buildSystemPrompt` gains an optional `state` param (pending order, last order, recent products, topic-switch + follow-up rules).
- `src/routes/api/ai/chat.ts` — pass the same state block into `buildSystemPrompt` for web chat.

No DB migration. No new dependencies. No changes to the Messenger inbox UI, plan gating, duplicate protection, or existing tool implementations.

## Verification

- Send "হ্যালো" on Messenger twice → replies differ, both LLM-generated.
- Start an order, then ask "ডেলিভারি চার্জ কত?" → answer is about delivery, order slot preserved for later confirmation.
- Send a voice note on Messenger → transcript stored, LLM answers based on it.
- Ask an unknown question → LLM asks a specific follow-up instead of an apology template.
