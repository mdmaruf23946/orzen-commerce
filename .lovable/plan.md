## Goal
Route every Messenger (and web) AI request to Google Gemini only. Remove OpenAI models, OpenAI-specific parameters, and the OpenAI audio transcription endpoint that are causing the `max_tokens is not supported with this model. Use 'max_completion_tokens'` error visible on the Messenger Integration page.

## Root cause
`getModelForStore()` in `src/lib/ai-agent.server.ts` falls back to `openai/gpt-5.4-mini` when no default is set (or if the DB row still holds an OpenAI id). The store's `ai_global_settings.default_model` is currently an OpenAI model, so the AI SDK sends `max_tokens` (as OpenAI-compatible) to a model that now requires `max_completion_tokens`, which the gateway rejects.

## Changes

1. **`src/lib/ai-agent.server.ts`**
   - Change the hard-coded fallback in `getModelForStore()` from `openai/gpt-5.4-mini` to `google/gemini-2.5-flash`.
   - Change the "fast" downgrade branch to `google/gemini-2.5-flash` (drop the `pro` → OpenAI swap).
   - Remove the `service_tier: "priority"` `providerOptions` block (that is an OpenAI-only serving tier).
   - Keep `maxOutputTokens` / `temperature` — those are AI SDK params that map cleanly to Gemini via OpenRouter.

2. **`src/lib/ai-product-builder.functions.ts`**
   - Replace `provider("openai/gpt-5.5")` with `provider("google/gemini-2.5-pro")` (multimodal image-input capable).

3. **`src/routes/_authenticated/owner/ai.tsx`**
   - Drop `openai/gpt-5-mini` and `openai/gpt-5` from the `MODELS` list so only Gemini options are selectable.

4. **`src/routes/api/public/messenger/webhook.ts` – voice transcription**
   - Remove the `openai/gpt-4o-transcribe` call to `/v1/audio/transcriptions`.
   - Replace `transcribeAudioAttachment` with a Gemini-native transcription: fetch the audio, base64-encode it, and send it as an inline `file` part in a one-shot `generateText` call using `google/gemini-2.5-flash` with a prompt "Transcribe this voice message verbatim." Return the text.

5. **Data migration (one-off)**
   - `UPDATE public.ai_global_settings SET default_model = 'google/gemini-2.5-flash' WHERE default_model LIKE 'openai/%'; UPDATE ... SET fallback_model = NULL WHERE fallback_model LIKE 'openai/%';`
   - This clears the stored OpenAI selection so live Messenger conversations immediately switch to Gemini.

## Not changing
- `maxOutputTokens` / `temperature` in `streamText` (SDK-owned, valid for Gemini through OpenRouter).
- Web chat route (`src/routes/api/ai/chat.ts`) — it already calls `getModelForStore()`, so it inherits the Gemini default automatically.
- `src/lib/ai.functions.ts` default (`google/gemini-2.5-flash`) — already correct.

## Verification
- After the migration + code edits, reload `/admin/messenger`, click "Clear" on the last-error banner, send a Messenger test message, confirm no `max_tokens` error and that the AI reply is generated.
- Send a Messenger voice note and confirm it is transcribed and answered.
- Typecheck passes.