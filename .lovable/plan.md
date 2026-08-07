# AI Sales Agent Settings — Redesign

Rebuild the AI Sales Agent settings page into a clean, fast, mobile-friendly configuration screen with the same three tabs (General, Knowledge, Behavior), and make the agent pull its knowledge from the store's real data instead of duplicated manual text.

## General tab

Keep: Enable/Disable agent, Agent Name, Welcome Message.

Add:
- Short agent description (one line, used in the system prompt as the agent's role)
- Fallback message shown when the agent cannot answer
- Toggle: product recommendations
- Toggle: order assistance (order taking / tracking help)

When the agent is disabled, the rest of the settings dim but stay editable.

## Knowledge tab

Stop asking admins to retype what the store already stores. The tab becomes a list of live data sources the agent may use, each with an on/off toggle and a small read-only preview of what is currently configured plus a link to the page where it is managed:

- Products and prices (products table)
- Stock / availability
- Categories
- Delivery information (delivery zones)
- Payment methods (store payment gateways)
- Return & exchange policy (return settings)
- Warranty information (store/product warranty)
- Store information (name, address, phone, description)
- Business hours (store setting)

Below that, the manual FAQ editor stays: add / edit / remove question-answer pairs, reorder-free simple list, mobile friendly.

Existing manually typed policy text is not thrown away — if a store already has text in the old fields it is shown as an "extra notes" collapsible per source, optional and empty by default for new stores.

## Behavior tab

- Language: Bangla / English / Both (auto)
- Communication style: Friendly / Professional / Casual (select, replacing today's free-text field)
- Human-like conversation: on/off
- Use emojis: on/off
- Sales-focused responses: on/off
- Recommend related products: on/off
- Ask customer for required information when needed: on/off
- Never invent information: always on, shown locked with an explanatory note
- Escalate to a human/admin when necessary: on/off

## Accuracy rules (enforced server-side)

The system prompt is updated so the agent:
- may only state prices, stock, delivery charges, payment options, policies and warranty from live store data or tool results;
- when it does not know something, says so plainly in the customer's language and (when escalation is on) offers to connect the store admin, using the configured fallback message;
- respects each behavior toggle (emoji, sales focus, related products, info collection, escalation) and skips product recommendation or order flows when those toggles are off.

## Technical notes

- Migration on `public.store_ai_agents` adding: `description`, `fallback_message`, `product_recommendations`, `order_assistance`, `sales_focused`, `recommend_related`, `ask_for_info`, `escalate_to_human`, and a `sources` jsonb holding the knowledge-source toggles. All with sane defaults so existing rows keep working. Table already has owner-scoped RLS; no policy change needed.
- `getMyAgent` / `updateMyAgent` in `src/lib/ai.functions.ts` extended with the new fields and a zod schema for `sources`; the old `knowledge` text fields stay optional for backward compatibility.
- Knowledge previews come from one new authenticated server function that returns compact counts/summaries (zone count, enabled gateways, return window, business hours, product/category counts) — no heavy queries.
- `buildSystemPrompt` in `src/lib/ai-agent.server.ts` rewritten to compose the prompt from the toggles + live store facts, and to gate the order-flow and recommendation sections behind their toggles.
- Page split into small components under `src/components/admin/ai-agent/` (GeneralTab, KnowledgeTab, BehaviorTab, FaqEditor) so the route file stays light; keeps the existing FeatureGate and card/tab styling used elsewhere in Store Admin.
- Single sticky-free "Save changes" button at the bottom, consistent with current Store Settings behavior.
