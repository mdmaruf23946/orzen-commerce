# Fix: AI keys do nothing, and web chat gives no reply

## What I found (verified)

1. **The API keys saved in Winner Admin → AI are stored but never used.** The owner page saves an OpenAI key, a Gemini key, and a rotating list of Gemini keys (2 keys are stored right now). Every AI call in the app — storefront web chat, Messenger, admin agents, product builder — instead uses the built-in Lovable AI connection only. No code anywhere reads the saved OpenAI/Gemini keys. So saving them changes nothing.

2. **The web chat really did fail today.** The visitor message "হাই" sent at 03:29 today was saved, but no reply was written. The AI request log shows **zero AI calls in the last 7 days**, so the chat never reached the AI service at all — it failed before that, and the failure was swallowed. An older conversation (Aug 31) did get a reply, so this is a recent break.

3. **The chat window hides errors.** The chat panel does not handle errors at all, so a failed request looks like "nothing happened" instead of showing a message. The server also returns failures as a bare 400 with no readable reason.

## The fix

### A. Make the saved keys actually work

- Add one shared "which AI provider do we use" resolver used by every AI entry point:
  - **Platform (default):** built-in Lovable AI connection, as today.
  - **Gemini:** uses the saved Gemini keys, tried in the stored order with the existing daily rotation rules (a key that fails is paused for the rest of the day, next key takes over, resets daily).
  - **OpenAI:** uses the saved OpenAI key.
- Model names are translated per provider so the same selected model works on each.
- If a chosen key fails, the failure is recorded against that key (visible in the owner panel), the next key is tried, and the platform connection is the last resort — so the chat never goes silent because of one bad key.
- Show on the owner AI page which provider is actually in use right now and which key served the last request.

### B. Make the web chat reply again, and never fail silently

- Return real, readable errors from the chat endpoint instead of a bare 400.
- Show the error inside the chat window ("couldn't reach the assistant, try again"), with a retry, instead of the message appearing to do nothing.
- Record failures so the owner panel's AI logs show why a chat failed.
- Verify the model currently selected as default is still served; switch the default to a current model if it is not.

### C. Verify end to end

- Send a real message through the storefront chat and confirm a reply is written back.
- Test with a saved Gemini key selected, and with a deliberately wrong key, to confirm rotation and fallback behave.
- Confirm the Messenger and admin agents still work unchanged.

## Technical notes

- New `src/lib/ai-provider.server.ts`: resolves `{ model, modelId, providerUsed, keyId }` from `ai_global_settings` (`provider`, `provider_api_key`, `openai_api_key`, `gemini_api_key`, `gemini_api_keys`) using `pickActiveGeminiKey` / `normalizeGeminiKeys` from the existing `gemini-keys.server.ts`. Gemini keys are used through the Gemini OpenAI-compatible endpoint (`https://generativelanguage.googleapis.com/v1beta/openai/`) with `createOpenAICompatible`, so no new dependency; OpenAI keys through `https://api.openai.com/v1`. Model id is stripped of the `google/` / `openai/` prefix for direct providers.
- `getModelForStore` in `ai-agent.server.ts` delegates to the resolver; `ai-admin/agent.server.ts`, `ai-admin/customer-agent.server.ts`, `facebook-ai.server.ts`, `merchant-ai`, `ai-product-builder.functions.ts` and `communication.functions.ts` use the same resolver instead of reading `LOVABLE_API_KEY` directly.
- On a provider error, mark `failed_on` + `last_error` on that Gemini key row in `ai_global_settings.gemini_api_keys` and retry with the next key, then the platform key.
- `src/routes/api/ai/chat.ts`: JSON error body (`{ error }`) with the right status, and the assistant failure logged to `ai_messages`/console rather than dropped. `AIChatPanel.tsx`: `useChat({ transport, onError })` plus an inline error row and retry.
- No schema changes required; no existing settings, credentials or webhooks are touched.
