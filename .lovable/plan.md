
# Fraud Checker Management System

A centralized fraud-checking module driven from the Owner panel, with per-store consumption from the Orders page. Store admins never see provider credentials.

## 1. Database (new migration)

**`public.fraud_settings`** (single global row, `id = 'global'`)
- enabled (bool), provider (text, default `bd_courier`)
- api_key, api_secret (text, nullable — owner-only read)
- enable_manual_check, enable_auto_check_before_courier, show_in_order_details, enable_analytics (bool)
- thresholds jsonb: `{ safe_max: 10, medium_max: 30 }` (% return-rate cutoffs)
- Grants: `service_role` full; `authenticated` — no direct read.
- RLS: owner-only via `has_role(auth.uid(),'owner')`.

**`public.fraud_checks`** (cache + history)
- id, store_id (fk stores), order_id (fk orders, nullable for manual lookups)
- phone (text, indexed), risk (enum: safe/medium/high), score numeric
- total_orders, successful, returned, cancelled, cod_success_rate numeric, last_delivery timestamptz
- raw jsonb (full provider response), courier_history jsonb
- checked_by uuid, checked_at timestamptz
- Unique index on (store_id, phone) with upsert on re-check within TTL.
- RLS: store owners can `SELECT` where `is_store_owner(store_id)`; inserts via server fn only (service_role).

**`platform_feature_flags`**: add `fraud_checker` flag so owner can gate per package. **`features.ts`**: add `"fraud_checker"` FeatureKey + label.

## 2. Server functions

**`src/lib/fraud.server.ts`** — BD Courier adapter
- `callBdCourier(phone, creds)` → normalized `{ total, success, cancelled, returned, cod_rate, last_delivery, courier_history[] }`.
- `computeRisk(stats, thresholds)` → `safe | medium | high`.

**`src/lib/fraud.functions.ts`** (createServerFn, all `requireSupabaseAuth`)
- `getFraudSettingsPublic()` — returns `{ enabled, show_in_order_details, enable_manual_check, enable_auto_check_before_courier }` only (no keys). Any authenticated user.
- `getFraudSettingsAdmin()` — owner-only, returns full config incl. masked key.
- `updateFraudSettings({...})` — owner-only.
- `testFraudConnection()` — owner-only, pings BD Courier with a sample phone.
- `runFraudCheck({ order_id?, phone })` — store owner scoped; uses `supabaseAdmin` inside handler to read credentials + write cache; enforces `assertPlan('fraud_checker')`; returns cached row if fresh (<24h) else calls provider.
- `fraudAnalytics({ range })` — owner-only aggregate counts across `fraud_checks`.

## 3. Owner panel — new route

**`src/routes/_authenticated/owner/fraud.tsx`** with tabs:
1. **Provider Settings** — enable toggle, provider select (BD Courier), API key + secret (password field, "reveal" masked), Test Connection button, live status pill.
2. **Global Configuration** — 4 switches (manual, auto pre-courier, show in details, analytics) + Save.
3. **Risk Rules** — sliders for safe_max / medium_max return-rate %, color-coded preview.
4. **Analytics** — cards (Total Checks, Safe, Medium, High, Prevented Orders) + simple daily/weekly/monthly bar (reuse existing chart util).
5. **Store Access** — link to plan-features page pre-scrolled to `fraud_checker` toggle across packages.

Add sidebar entry in owner nav (`ShieldCheck` icon).

## 4. Store admin — Orders page enhancement

**Do not redesign** `src/routes/_authenticated/admin/orders.tsx`. Only add two icon-buttons per row (next to existing Invoice link):
- **Fraud Check** (ShieldCheck icon) — opens a shadcn `Dialog` (`FraudCheckModal`) that lazy-loads `runFraudCheck({ order_id, phone })`.
- **Order Details** (Eye icon) — opens a shadcn `Sheet` from the right on desktop / full-screen on mobile (`OrderDetailsDrawer`) that lazy-loads full order via existing `getOrderDetails` + product join.

Both are gated by `useFeature('fraud_checker')` for the fraud button; details is always available. Feature-off users see the button disabled with tooltip "আপগ্রেড প্রয়োজন" linking to `/admin/billing`.

### `FraudCheckModal` contents
- Risk badge (colored), stat grid: Total / Success / Returned / Cancelled / COD % / Last delivery.
- Collapsible "Courier History" list.
- "Re-check" button (invalidates cache).
- Cached indicator + timestamp.

### `OrderDetailsDrawer` contents (collapsible sections)
- **Product** — thumb, name, SKU, qty, price, discount, delivery charge, total.
- **Customer** — name, phone (tap-to-call), full address.
- **Order** — id, invoice_no, datetime, payment, status, courier status, tracking no.
- **Courier** — history + inline fraud result (if already cached; button to check).
- **Admin** — internal notes (reuse existing add/delete), timeline (reuse).

Mobile-first: `Sheet side="bottom"` on `<sm`, `side="right"` w/ 480px on `≥sm`. Uses `@/components/ui/{sheet,dialog,collapsible,badge}`.

## 5. Files touched

**New**
- `supabase/migrations/…_fraud_checker.sql`
- `src/lib/fraud.server.ts`
- `src/lib/fraud.functions.ts`
- `src/routes/_authenticated/owner/fraud.tsx`
- `src/components/admin/FraudCheckModal.tsx`
- `src/components/admin/OrderDetailsDrawer.tsx`

**Edited**
- `src/lib/features.ts` — add `fraud_checker`.
- `src/routes/_authenticated/admin/orders.tsx` — add 2 action buttons per row.
- `src/routes/_authenticated/owner/route.tsx` — sidebar link.
- `src/routes/_authenticated/owner/plan-features.tsx` — expose fraud_checker toggle (auto since it reads FEATURE_KEYS).

## 6. Performance & safety

- 24h cache on fraud lookups; unique (store_id, phone) upsert.
- Lazy queries via `useQuery(..., { enabled: open })` — nothing loads until modal/drawer opens.
- Credentials only accessed inside `runFraudCheck` handler with `supabaseAdmin`; never sent to client.
- `assertPlan('fraud_checker')` server-side gate.
- Rate-limit re-check button (60s cooldown per phone).

## Open confirmations
- **BD Courier endpoint**: I'll implement against the public `https://bdcourier.com/api/courier-check` endpoint (POST `{ phone }`, header `Authorization: Bearer <API_KEY>`). Confirm if you use a different provider URL/auth scheme.
- Cache TTL default **24h** — OK?
