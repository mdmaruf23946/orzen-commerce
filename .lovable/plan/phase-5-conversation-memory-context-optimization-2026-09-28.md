# Phase 5: Conversation Memory & Context Optimization

## What changes for the merchant
- The AI sends only the **last 6 messages** plus a short, structured **memory card** instead of up to 30 old messages.
- Replies should come faster and cost less. No change to how customers order or how the panel works.
- Speed and token savings will be **measured before and after** on real conversations. The 60% / 3x figures are targets, not promises.

## Memory card (one per conversation, kept up to date)
Stored inside the existing conversation profile, so no new table is needed:
- **Cart / pending order:** product, variant, qty, name, phone, address, payment (already collected)
- **Last confirmed order:** short invoice number, product, qty, status
- **Products discussed:** last 5 product ids (from recommendations and photo matches)
- **Customer facts:** preferred language, name, district (Dhaka / outside), budget or size if said
- **Rolling summary:** 2–3 short lines about older messages, refreshed only when messages drop out of the 6-message window. It uses a cheap background call and never delays a reply.

Private data stays only in this customer's conversation. It is never put in a shared cache and is always filtered by store.

## Steps
1. **Baseline:** record current prompt size (tokens) and reply time for 20 recent WhatsApp and Messenger AI replies.
2. **Shared context builder** used by both WhatsApp and Messenger: loads the 6 latest messages and the memory card in one database read. The 30-message query in WhatsApp and the 8/16/30 speed setting in Messenger go away.
3. **Memory updates:** refresh the card after each reply, product match, Buy Now tap, and order creation. The existing pending-order and last-order fields are reused, not replaced.
4. **Prompt:** the existing "Conversation state" block grows into the full memory card. The latest message stays pinned as "answer this first".
5. **Summary worker:** when older messages fall out of the window, a background step updates the rolling summary. If it fails, the reply still goes out without the summary.
6. **Safety switch:** a per-store setting (default on) to turn compact memory off and go back to the old history.
7. **Measure again** with the same 20 conversations and report real numbers. Deploy to orzen.top with the usual wrangler procedure and parity check.

## Not changed
Webhooks, queue/debounce, fast paths, photo matching, order creation, merchant commands, human takeover, the web chat widget.

## Technical details
- New `src/lib/conversation-context.server.ts`: `loadConversationContext(sb,{storeId,conversationId})` returns `{history: last 6 ai_messages (role user/assistant, text only, truncated to 600 chars each), memory}`; `updateConversationMemory(sb, conversationId, patch)` does a merge-write into `psid_profile.memory`.
- `buildSystemPrompt` state type is extended with `memory` (summary, facts, recent_product_ids); the output stays compact (about 400 tokens or less).
- `whatsapp-webhook.server.ts` (~line 592) and `messenger-webhook.server.ts` (~line 2508) switch to the builder. `recent_product_ids` for WhatsApp is filled in (it is empty today).
- Summary: `openai/gpt-6-astra` would go through the gateway, but the store's own routed provider (`routedModel`) is used to stay independent of Lovable. It runs async after send and is guarded by a `summary_upto_message_id` field so it never runs twice.
- Setting: `compact_memory boolean default true` column on `whatsapp_integrations` and `messenger_integrations` (migration applied to both prod and dev).
- Metrics: `usage.inputTokens` and processing_ms are logged per reply (already in `logUsage` / jobs) and compared before and after.
