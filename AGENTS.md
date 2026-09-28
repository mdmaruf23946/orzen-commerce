<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Conversational checkout uses server-issued, hashed, single-use, two-hour sessions; this isolates customers and keeps payment credentials outside chat.
- All HTML responses use `Cache-Control: no-store, must-revalidate` so deployed Merchant Panel changes replace stale browser/CDN shells immediately.
- Customer photo matching uses `findProductByPhoto` (fingerprint, then 768-dim `gemini-embedding-2` vectors on the owner's Gemini keys, HNSW, store-scoped); one shared path keeps Messenger and WhatsApp consistent and independent of Lovable.
- AI replies pass through `guardReply` (src/lib/reply-guard.server.ts) before sending: every money amount/stock claim must match this turn's tool results or a fresh store-scoped lookup; delivery charges come only from the `getDeliveryCharge` tool — prevents hallucinated prices on WhatsApp/Messenger.
- Chat orders (AI finalizeOrder, Messenger direct order) are created only via the `create_chat_order` RPC with an idempotency key (src/lib/chat-order.server.ts): advisory lock + 30-min same-key reuse + stock check under row lock, so duplicate messages never create a second invoice.
- Pending orders reserve stock for 24h: BEFORE INSERT trigger `order_items_stock_guard` locks the product row and rejects items exceeding stock minus pending reservations (stock itself still decrements on confirm) — prevents two customers buying the last piece.
- AI provider routing uses a 12s per-attempt timeout and a per-isolate circuit breaker (3 fails → skip 120s); shared store/agent/settings/delivery-zone reads use a 30–60s TTL cache (src/lib/ttl-cache.server.ts) — never cache customer, order, stock or price-verification data.
- Message telemetry: WhatsApp/Messenger workers run each job inside `runWithTrace` (src/lib/telemetry.server.ts, AsyncLocalStorage) and store stage ms in `*_jobs.timings`; helpers call `traceTime`/`setTraceMeta` — no parameter threading, and telemetry never throws.
- AI system prompt is compact and conditional (order/non-physical/policy/FAQ sections only when the latest message needs them; max 3 matched FAQs; rarely-used tools dropped per turn; temperature capped at 1.0) — keeps prompts ~2k chars instead of ~12k for speed and cost.

- Delivery time and return/exchange statements come only from `loadStorePolicy` (src/lib/store-policy.server.ts); `guardReply` also rewrites unavailable size/colour claims from the focus product's `variants` — prevents invented policies and variants in chat.
