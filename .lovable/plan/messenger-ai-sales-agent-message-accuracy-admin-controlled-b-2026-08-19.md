# Messenger AI Sales Agent — Message Accuracy + Admin-Controlled Buy Now

Improve the existing Messenger AI so its messages always match what is actually delivered, sound like a real sales person, and let each Store Admin control the Physical Product "Buy Now" flow. No rebuild — the current Messenger integration, product tools, product cards and physical order flow stay as they are.

## 1. Message and payload consistency

Today the model writes free text and separately calls send tools, so it can say "ছবিটি নিচে দিলাম 👇" when no card or image follows.

Two layers of protection:

- **Prompt rules (strict):** the agent may only reference an image, card, link, button or "details below" when it is calling the matching tool in the same turn. If no media is available, it states the information plainly with no pointer phrases.
- **Outgoing text sanitiser (server-side):** before any Messenger text is sent, the text is checked against what the turn actually produced (card sent? image? link/button?). Dangling pointer phrases in Bangla and English — "নিচে দেখুন", "ছবিটি দেখুন", "নিচে দিলাম", "এই লিংকে ক্লিক করুন", "see below", "click the link below", trailing 👇 — are removed or rewritten to a neutral sentence when the referenced element is not part of the payload. This runs for every outbound text, so a bad sentence can never reach the customer.

## 2. Human-like conversation

Rewrite the tone section of the system prompt:

- one clear intent per reply, short when a short answer is enough
- no repeated stock openers ("অবশ্যই!", "জি!"), varied natural phrasing
- match the customer's language automatically, mixed Bangla/English only when natural
- emoji use stays limited and respects the existing admin emoji toggle
- never repeat what the product card already shows (name, price, image, buttons) — add only what the card does not say (stock, benefit, next step)
- never re-ask for information already in the conversation slot; changing product or quantity updates only that part

Product benefits are explained conversationally from real product data (features, short description) with varied phrasing, never invented.

## 3. Admin-controlled Buy Now flow (Physical products only)

New **Ordering** tab in the existing AI Sales Agent settings page, alongside General / Knowledge / Behavior:

- **Buy Now message** — text sent when a customer taps Buy Now (editable, sensible Bangla default)
- **Customer information fields** — enable/disable and mark Required or Optional for: Name, Phone, District, Thana/Upazila, Union, Village, Area/Market, Full delivery address, Quantity, Payment method, Additional note
- **Collection style** — one question at a time (default) or a single combined message
- **Order confirmation message** — editable, with placeholders for product, quantity, total, customer name, address, payment method; placeholders with no value are dropped
- **Payment methods** — read-only list showing the methods actually enabled for the store (COD and configured gateways); the agent may only offer these

Everything is stored per store on the existing `store_ai_agents` row (new `order_flow` jsonb column), so existing owner-scoped RLS and store isolation already apply. Defaults keep current behaviour for stores that never touch the tab.

## 4. Order flow behaviour

- The Buy Now postback and the `collectOrderInfo` / `finalizeOrder` tools read the admin config instead of the hard-coded required list. Required fields come from the config; optional fields are asked at most once and never block confirmation.
- Collection is conversational, one field per message by default.
- Payment options offered are limited to the store's enabled methods.
- Digital, Service and Subscription products keep the existing website-only rule — info + image + link, no Messenger checkout. Unchanged.

## Technical notes

- Migration: add `order_flow jsonb not null default '{}'::jsonb` to `public.store_ai_agents`. No policy change (owner-scoped RLS already present).
- `src/lib/ai.functions.ts`: extend `getMyAgent` / `updateMyAgent` with a zod schema for `order_flow`; add a small server function returning the store's enabled payment methods for the read-only list.
- New `src/components/admin/ai-agent/OrderingTab.tsx` + types, wired into `src/routes/_authenticated/admin/ai-agent.tsx` as a fourth tab (grid-cols-4, mobile friendly, existing card/toggle styling).
- `src/lib/ai-agent.server.ts`: rewrite the tone/rules portion of `buildSystemPrompt` (payload-consistency rules, anti-repetition, card-aware phrasing) and add an `order_flow` block describing required/optional fields, collection style and allowed payment methods. `collectOrderInfo` / `finalizeOrder` compute `missing` from the config.
- New helper `sanitizeOutgoingText(text, { hasCard, hasImage, hasLink, hasButton })` in a server module, applied in the Messenger webhook's text-send path (`sendAndLogText` and the AI reply path) and in `handleBuyPostback`, which now uses the admin-configured Buy Now message.
- Web chat (`src/routes/api/ai/chat.ts`) picks up the prompt improvements automatically; no payload sanitiser needed there since cards render inline.
