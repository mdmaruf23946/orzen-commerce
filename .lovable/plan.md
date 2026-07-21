# AI Commerce Engine — Implementation Plan

Extend the existing AI agent (`src/lib/ai-agent.server.ts`) and Messenger webhook (`src/routes/api/public/messenger/webhook.ts`) into a full commerce engine. Reuses current tables (`products`, `orders`, `order_items`, `order_timeline`, `ai_conversations`, `store_customers`, `courier_providers`, `messenger_integrations`) and adds only what's missing.

## Phase 1 — Product Knowledge (live, no guessing)

Extend `products` schema so the AI has every attribute the request lists:

- New columns (nullable, backwards compatible):
  `brand text`, `product_code text`, `short_description text`, `features jsonb` (string array), `specifications jsonb` (key→value), `variants jsonb` (size/color/price/stock array), `video_url text`, `delivery_charge numeric`, `delivery_time_days text`, `rating numeric`, `total_sold integer`.
- `products.status` already gates draft/active; `stock`, `price`, `old_price`, `gallery`, `sku`, `category_id` already present.
- Product admin editor (`src/routes/_authenticated/admin/products.tsx`) gets new fields (brand, code, short desc, features list, spec key/value editor, variants editor, video, delivery). Global template product editor mirrors the same.

## Phase 2 — Smart Search + Comparison Tools

Rewrite tool set in `ai-agent.server.ts` (`buildTools`) so the model has strong, structured retrieval instead of one `ilike`:

- `searchProducts({ query, category?, brand?, maxPrice?, minPrice?, inStockOnly?, sort? })` — matches name/brand/sku/short_description/features via `ilike` + optional filters + sort by price / bestseller (uses existing `get_store_bestsellers`).
- `getProduct({ productId })` — returns full row incl. variants, specs, gallery, video, delivery.
- `getRelatedProducts({ productId, kind: "similar"|"accessory"|"upsell" })` — same-category or `meta.related_ids`.
- `compareProducts({ productIds[] })` — returns matrix (price, features, stock, rating) + a recommended pick (highest rating × in-stock × best price/feature ratio).
- `checkStock({ productId, variant? })` — real-time stock incl. variant.
- `listCategories` / `listBrands` — for browse intents.

All queries scoped to `store_id`; prompt updated to require tool use before naming any product/price/stock.

## Phase 3 — Messenger Product Cards

Add `sendProductCard` and `sendProductCarousel` tools that push Facebook `generic` template attachments via Graph API (from webhook helper):

- Card contains image, name, subtitle (price + discount + stock), and buttons: "Buy Now" (postback → starts order flow), "View Product" (web_url to storefront `/store/{slug}/product/{id}`).
- Carousel used when `compareProducts` or search returns >1 result.
- Webhook records the outgoing card as an `ai_messages` row with `attachments` so the inbox shows it.
- System prompt: "When recommending products, always call sendProductCard/sendProductCarousel — never describe products in plain text."

## Phase 4 — AI Order Taking + Auto Creation

Replace current single-shot `placeOrder` with a stateful order flow persisted on `ai_conversations.psid_profile.pending_order`:

- New tool `collectOrderInfo({ field, value })` — updates the pending order slot (name, phone, district, upazila, union, village, full_address, product_id, variant, qty, delivery_method, payment_method) and returns which fields are still missing.
- New tool `finalizeOrder()` — validates all required slots, re-checks stock, computes subtotal + delivery charge (from product or store `delivery` config) + grand total, then inserts into `orders` + `order_items` using `supabaseAdmin` (RLS-safe path). Stock decrement already handled by `on_order_status_change` on confirm; add pre-reservation via `stock_movements` on order create.
- Links `orders.customer_id` when a matching `store_customers` row exists (create one if not, per-store).
- Immediately sends a rich Messenger confirmation card: Order ID, invoice_no, items, qty, subtotal, delivery, grand total, ETA, support contact. Uses existing `generate_invoice_no` on confirm.
- Prompt: "Ask only for missing fields; never re-ask what the customer already gave."

## Phase 5 — Order Status Notifications

Ship a database-driven notifier so every status change reaches the customer on Messenger:

- New table `order_notifications_outbox(id, order_id, store_id, channel, status, payload jsonb, sent_at, error)` + trigger on `orders`/`order_timeline` insert: whenever status enters {received, confirmed, processing, packed, shipped, out_for_delivery, delivered, returned, cancelled, payment_received, refund_completed}, enqueue a row.
- New TanStack public route `src/routes/api/public/messenger/notify-cron.ts` (secured with `CRON_SECRET`) drains the outbox, formats a friendly localized message (uses `store_ai_agents.language`), and sends via Messenger Graph API to the PSID stored on the linked `ai_conversations` row.
- Registered as a pg_cron every minute (or invoked by external scheduler via the stable `project--*.lovable.app` URL).

## Phase 6 — Live Order Tracking + Courier Integration

- New tool `trackOrder({ orderId?|invoice_no?|phone? })` — looks up order (scoped to store), returns latest `order_timeline` entry, courier tracking number, courier name, ETA.
- Extend `courier_providers` with adapter interface (`steadfast`, `pathao`, `redx`) in `src/lib/couriers/`; add `orders.courier_tracking_id`, `orders.courier_code`, `orders.courier_status`, `orders.courier_last_synced_at`.
- Cron endpoint `api/public/couriers/sync.ts` polls active shipments hourly and updates `courier_status`, enqueuing an outbox message when status changes.

## Phase 7 — Sales Assistant (Upsell / Cross-sell)

- After `getProduct` or `finalizeOrder`, prompt instructs the model to call `getRelatedProducts` and offer 2–3 add-ons via `sendProductCarousel`.
- Global relationships live in `products.meta.related_ids` (editable in admin product form: "Frequently bought with").

## Phase 8 — Inventory Awareness

- All tools return `stock` and `low_stock_threshold`. Prompt: on out-of-stock, apologize and call `searchProducts` with same category to suggest alternatives.
- Admin notification (Phase 10) fires when a sale drops a SKU below its threshold.

## Phase 9 — Conversation Memory

- Persist per-customer summary in `store_customers.meta.ai_memory`: last N orders, favourite categories/products (derived from `order_items` history), preferred language (from `ai_conversations.language`).
- New tool `getCustomerMemory({ conversationId })` — returns memory for the sender. Called automatically at start of each turn via the system prompt so replies reference history.
- Update `handle_new_order` (or new trigger) to refresh the memory summary.

## Phase 10 — Admin Notifications

- New table `admin_notifications(id, store_id, kind, title, body, meta, read_at, created_at)` + policy for store owners.
- Producers: new order created, low stock, AI escalation, payment issue, "customer requested human". Consumer: bell in admin header (`admin/route.tsx`) with realtime subscription, plus optional email via existing `emails.server.ts`.

## Phase 11 — Fail-safe / Handoff

- New tool `escalateToHuman({ reason })` — flips `messenger_integrations.human_takeover=true` (or per-conversation `ai_conversations.handoff='human'`), inserts an `admin_notifications` row, and posts a friendly holding reply.
- Prompt hardening: "Never invent product name, price, stock, or policy. If not returned by a tool, call `escalateToHuman`."
- Webhook already respects `human_takeover`; extend to also respect per-conversation handoff.
- After a human replies via inbox, AI resumes automatically unless takeover is still on.

## Delivery order

1. Phase 1 (schema + admin editors)
2. Phases 2 + 3 (search tools + Messenger cards)
3. Phase 4 (order flow) + Phase 5 (status notifications)
4. Phases 6–8 (tracking, upsell, inventory)
5. Phases 9–11 (memory, admin notifications, fail-safe)

Each phase ships as one migration + code change and is independently testable via the existing Messenger inbox and Test Message tool. Every AI reply routes through the same live-DB tool layer so guessing is impossible by construction.

## Technical notes

- All new tools live in `src/lib/ai-agent.server.ts` and reuse `supabaseAdmin` (service role) — scoped to `storeId` on every query.
- Messenger Graph calls consolidated in `src/lib/messenger-send.server.ts` (attachments, generic template, quick replies).
- Cron endpoints under `src/routes/api/public/` guarded by an HMAC of `CRON_SECRET` (will call `generate_secret` if missing).
- Model stays `openai/gpt-5.5` default; `stopWhen: stepCountIs(50)` already set, sufficient for multi-tool order flow.
- No changes to `client.ts`, `types.ts`, auth middleware, or subscription code.