## Root cause

Today the AI agent has two independent surfaces per turn:

1. A **product tool** (`sendProductCard` / `showProduct` / `searchProducts`) that emits an image + card using a `productId` the model chose.
2. **Free-form assistant text** the model writes separately, drawing on the full prompt (system prompt "recent product ids", "pending order product_name", earlier assistant messages, tool results from *other* products it looked at this turn).

Nothing links (1) and (2) to the same DB row. The model can call `sendProductCard(A)` and then, in the same turn, write a sentence describing product B — often the *previously* recommended product still sitting in `recent_product_ids` / `pending_order` / prior messages. The mismatch the user reported ("image of one product, description of another") is exactly this: two independent generations, one grounded in a tool call, one grounded in stale context.

Secondary contributors:
- `searchProducts` returns up to 6 products; the model picks *which id* to card, but writes text from any of them (or from an earlier turn's product).
- `sendProductCard` / `showProduct` only return `{ sent: true }` / a summary — they don't return the *authoritative* caption, so the model has no anchor forcing its text to match the card.
- The system-prompt "Conversation state" block leaks a `product_name` from `pending_order` and a list of `recent_product_ids` into every turn, which the model happily uses as if it were the current focus.

## Fix strategy

Make the product being talked about a single, server-resolved value per turn, and make the outgoing text derive from *that record only*.

### 1. `resolveFocusProduct(userMessage, convId, storeId)` — server-side, deterministic
New helper in `src/lib/ai-agent.server.ts` that runs *before* `streamText`:

- Extract candidates from the customer's latest message: explicit product id/slug, product name/code/SKU tokens, "this/that/এটা/এইটা/ওটা/এই product" deictic references.
- Deictic → last product from `ai_product_recommendations` for this conversation (single row, most recent, not blacklisted).
- Name/SKU/code → run the same ranked search as `searchProducts` but return **only the top-1 match with score ≥ threshold**; if ambiguous (top-2 within 10% score), mark `ambiguous: true` and return the top candidates.
- Returns `{ product: fullRow | null, ambiguous, candidates }`.

Called from `src/routes/api/public/messenger/webhook.ts` and `src/routes/api/ai/chat.ts` right before building the system prompt.

### 2. Inject a "Focus product" block into the system prompt
When `resolveFocusProduct` returns a product, append a block:

```
# Focus product (ONLY product allowed in this reply)
id, name, slug, price, old_price, stock, brand, short_description, primary_image_url, key features, variants
```

And a hard rule:

> If a Focus product is set, every product fact in your reply MUST come from that record. Do not describe, name, price, or image any other product. Do not use `pending_order.product_name` or `recent_product_ids` as a substitute. To show it, call `sendProductCard`/`showProduct` with that exact id.

When `ambiguous: true`, inject the top candidates and require the model to ask a one-line disambiguation question instead of guessing.

### 3. Remove leaky context that lets the model drift
- Drop `product_name` and `product_id` from the `pending_order` line in the system prompt when no Focus product is set for this turn (keep name/phone/address so the order flow still works).
- Drop the "Recently recommended product ids: …" line — it is the biggest source of "wrong product" hallucinations. Replace it with the Focus-product block above (which is only present when the current turn actually needs it).

### 4. Make the product tools return an authoritative caption + reject stale ids
- `sendProductCard` / `showProduct` (and Messenger / web variants):
  - When a Focus product is set for this turn, **reject** any `productId` that doesn't match — return `{ sent: false, error: "must_use_focus_product", focus_product_id }`. The model is forced to retry with the right id.
  - On success, return `{ sent: true, canonical_caption }` where `canonical_caption` is a one-sentence, DB-derived line (name + short_description + price + stock). Instruct the model that its follow-up text MUST paraphrase only that caption, no new facts.
- `sendProductCarousel` / `showProducts`: when a Focus product is set, restrict to related/upsell context; keep the same "canonical captions per id" return shape.

### 5. Voice: transcribe first, resolve product from transcript
In `src/routes/api/public/messenger/webhook.ts`, keep the Gemini transcription, then treat the transcript as the "latest user message" fed into `resolveFocusProduct`. Persist the transcript to `ai_messages` so the same resolution logic runs identically for text and voice.

### 6. Verification (built into the change, not left to manual QA)
Add `scripts/ai-agent-conversations.test.ts` (bun test) that drives `resolveFocusProduct` + a stubbed `streamText` over 30 scripted turns:

- 10 text conversations across 5 different products (exact name, partial name, SKU, brand + category, Bangla name).
- 10 follow-up/deictic turns ("এইটার দাম কত", "ছবি দেখান", "stock আছে?") after a prior recommendation, including cases where a *different* product was mentioned in an earlier turn.
- 5 voice-transcript inputs (pre-recorded Gemini transcript strings) covering the same intents.
- 5 ambiguity cases (two products share a keyword) — assert the agent asks a disambiguation question instead of picking one.

Each test asserts:
1. `resolveFocusProduct` returns the expected product id (or `ambiguous`).
2. The tool call arguments passed to `sendProductCard`/`showProduct` match that id.
3. The assistant text contains the focus product's name and *no* other product name from the fixture set.

CI fails on any mismatch. Iterate on `resolveFocusProduct` scoring + the system-prompt rule until all 30 pass.

## Files touched

- `src/lib/ai-agent.server.ts` — add `resolveFocusProduct`, update `buildSystemPrompt` (Focus block, drop leaky state), update `sendProductCard` / `sendProductCarousel` / `showProduct` / `showProducts` to enforce focus id + return canonical caption.
- `src/routes/api/public/messenger/webhook.ts` — call `resolveFocusProduct` on the resolved text (typed or transcribed) and pass it into the prompt/tool context.
- `src/routes/api/ai/chat.ts` — same call on the last user UIMessage text.
- `scripts/ai-agent-conversations.test.ts` — new 30-case regression suite.

## Not changing

- Model choice (stays Gemini) and the AI SDK wiring.
- The order / tracking / handoff flows.
- Storefront UI, product card rendering.
