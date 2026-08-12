# Messenger AI Agent — Strict Product-Type Sales Flow

Make the AI Sales Agent aware of each product's type (`physical`, `digital`, `service`, `subscription`) and enforce one rule: **only physical products can be ordered inside Messenger.** Everything else gets information + image + price + the real storefront link.

No new tables, no new settings panel, no changes to the existing physical order flow.

## What changes for customers

| Type | Messenger behaviour |
|---|---|
| Physical | Info + image + price + stock, full Messenger ordering (unchanged) |
| Digital | Info + image + price + what's included + official product link |
| Service | Info + image + price + what's included + official service link |
| Subscription | Info + image + price + billing frequency + benefits + official link |

If a customer says "buy this / order this / I'll pay here" for a non-physical item, the agent politely explains the purchase happens on the website and sends the real product page link — never an order, never payment details.

## Technical changes (all in `src/lib/ai-agent.server.ts`)

1. **Carry the type through.** Add `product_type` and `meta` to the product select lists (`PRODUCT_SELECT_MIN`, `productSelect`, and the card/carousel selects) and expose `product_type` in `productSummary`, plus `billing` info (`meta.subscription`) for subscription items. Non-physical items are not filtered out by `inStockOnly` (stockless types).

2. **Hard block in the order tools.** In `collectOrderInfo`, reject a `product_id` whose type isn't `physical` — return `{ error: "not_orderable_in_messenger", product_type, product_url }`. Same guard at the top of `finalizeOrder` (defence in depth, so no model mistake can create a digital/service/subscription order).

3. **Cards carry the right call-to-action.** `sendProductCard` / `sendProductCarousel` label the button "Buy Now" for physical and "View / Purchase on website" for the other types, using the existing `productUrl()` storefront URL (`/store/{slug}/product/{id}`) — the only URL source; no generated links.

4. **System prompt rules.** Add a short, strict "Product type rules" block to `buildSystemPrompt`: physical = Messenger order allowed; digital/service/subscription = information + link only, never collect payment card/CVV/OTP/banking data, never confirm a purchase, never invent a URL or a fact. Focus-product and search results now state the product type so the model picks the right path in mixed conversations.

5. **Tool result hints.** Search/related/focus results include `product_type` and `purchase_channel` (`messenger` | `website`) so the model's next step is unambiguous.

## Out of scope
No admin UI changes, no schema migration, no new checkout, no changes to the web chat ordering paths beyond the same type guard.
