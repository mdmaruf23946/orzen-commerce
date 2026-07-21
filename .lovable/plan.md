## AI Commerce Engine — Phase 2 (Admin & Customer UX)

Five connected features building on the existing AI Commerce Engine. All work is scoped to admin panel + storefront order page + one small schema addition. No changes to the AI agent's core reasoning.

---

### 1. Product editor: full AI knowledge fields

**File:** `src/routes/_authenticated/admin/products.tsx` (extend `ProductDialog`)

Add sections to the existing dialog (already handles image + gallery):
- **Basic AI meta**: `brand`, `product_code`, `short_description`
- **Features**: dynamic list of bullet strings → `features jsonb`
- **Specifications**: key/value rows → `specifications jsonb`
- **Variants**: rows of `{name, price, stock, sku}` → `variants jsonb`
- **Delivery**: `delivery_time_days`, `delivery_zones` (multi-tag)
- **Rating**: `rating_avg`, `rating_count` (read-only if reviews exist, else editable seed)
- **Related products**: multi-select from existing products → `related_product_ids uuid[]`

All fields already exist in schema from Phase 1 migration. Just wire the UI.

---

### 2. AI recommendation review panel

**New table:** `ai_product_recommendations` — logs every product the AI surfaces in a conversation (conversation_id, product_id, tool_name, created_at).

**New table:** `ai_product_blacklist` — per-store (product_id, reason, created_at). AI agent's `searchProducts` tool filters these out.

**New route:** `src/routes/_authenticated/admin/ai-recommendations.tsx`
- List conversations with grouped recommendation history
- Per-product row: "Blacklist", "Boost" (adds to `is_featured`), notes field
- Filter by date range, conversation, product

**Wire logging:** in `src/lib/ai-agent.server.ts`, insert to `ai_product_recommendations` inside `searchProducts` / `getProduct` / `compareProducts` tools.

---

### 3. Order tracking timeline UI

Data already exists (`order_timeline`, courier fields on `orders`).

**Customer:** enhance `src/routes/store/$slug/order.$orderId.tsx`
- Vertical stepper: Placed → Confirmed → Packed → Shipped → Delivered
- Courier card: name, tracking number (click → provider URL), estimated delivery date
- Auto-refresh every 30s while status ≠ delivered/cancelled

**Admin:** enhance `src/components/admin/OrderDetailsDrawer.tsx`
- Same stepper + courier edit form (name, tracking no, estimated date)
- Save writes to `orders` and appends `order_timeline` entry

---

### 4. Low-stock detection + AI awareness

**Existing:** `products.low_stock_threshold` and `products.stock` exist.

**New table:** `low_stock_alerts` (product_id, current_stock, threshold, resolved_at) — trigger on `products` UPDATE inserts when stock crosses below threshold.

**Admin inbox tile:** on `src/routes/_authenticated/admin/messenger-inbox.tsx` — top-of-list banner "3 products low stock" → link to inventory filtered view.

**AI awareness:** in `src/lib/ai-agent.server.ts` `searchProducts` tool, when a matched product's stock ≤ threshold, also return `suggested_alternatives` (same category, in-stock, ordered by similarity). Agent prompt updated to mention low stock + suggest alternatives.

---

### 5. Human takeover queue

**Existing:** `ai_conversations.handoff_mode`, `handoff_reason` fields.

**New route:** `src/routes/_authenticated/admin/handoff-queue.tsx`
- List all conversations where `handoff_mode = 'human'`
- Show: customer name/PSID, last message preview, escalation reason, escalated_at, wait time
- Actions per row: **Open** (→ messenger-inbox with that conversation), **Return to AI** (sets `handoff_mode='ai'`, clears reason, logs event)
- Badge count on sidebar link
- Filters: by reason, by wait time (>1h highlighted)

Wire escalation logging: when AI agent calls the (existing) `escalateToHuman` tool, save the reason string to `handoff_reason` — already partially there, needs completion.

---

### Technical details

**Migration** (one file, contains):
- `ai_product_recommendations` + GRANTs + RLS (owner-scope)
- `ai_product_blacklist` + GRANTs + RLS
- `low_stock_alerts` + GRANTs + RLS + trigger function on `products`
- Adds `handoff_reason text` to `ai_conversations` if missing
- Publication add for `low_stock_alerts` (realtime tile updates)

**Sidebar:** add "AI Recommendations" and "Handoff Queue" links to `src/routes/_authenticated/admin/route.tsx` in the AI section, with realtime unread badge for handoff.

**No new deps.** No AI-agent rewrite — only tool-body edits for logging + low-stock alternatives.

---

Estimated: 1 migration + ~8 file edits + 2 new route files. I'll implement top-to-bottom in one batch after your approval.
