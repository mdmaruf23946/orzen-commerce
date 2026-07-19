## Duplicate Order Protection System (per-store)

Add a store-scoped duplicate-order guard that runs inside `placeOrder`, with a full admin UI to configure rules, review blocks, whitelist customers, and exclude products.

---

### 1. Database (single migration)

**`store_duplicate_protection`** — one row per store (settings):
- `store_id uuid pk → stores(id) on delete cascade`
- `enabled bool default false`
- `mode text check in ('block','warn','off') default 'block'`
- `period_days int check in (1,3,7,15,30) default 7`
- `rule_phone bool default true`
- `rule_product bool default true`
- `rule_fingerprint bool default false`
- `rule_device bool default false`
- `rule_customer bool default true`
- `match_logic text check in ('any','all') default 'any'` — how rules combine
- `created_at`, `updated_at`

**`store_duplicate_whitelist_customers`** — `(store_id, customer_id | phone)`, unique per store.

**`store_duplicate_excluded_products`** — `(store_id, product_id)`, unique per store.

**`store_duplicate_blocks`** — audit + review queue:
- `id`, `store_id`, `matched_rules text[]`, `matched_order_id uuid` (the earlier order), `phone`, `customer_id`, `fingerprint`, `device_id`, `product_ids uuid[]`, `payload jsonb` (full attempted order snapshot for manual approval), `status text check in ('blocked','approved','dismissed') default 'blocked'`, `created_at`, `resolved_at`, `resolved_by uuid`.

**Add to `orders`**: `fingerprint text null`, `device_id text null` (already has `customer_id`, `phone`).

**Indexes**: `orders(store_id, phone, created_at desc)`, `orders(store_id, customer_id, created_at desc)`, `orders(store_id, fingerprint, created_at desc)`, `order_items(product_id)` for the recent-window lookup.

**RLS + GRANTs**: standard `is_store_owner(store_id)` for all four tables (SELECT/INSERT/UPDATE/DELETE). `authenticated` grants only; no `anon`. `service_role` full. Storefront never reads these directly — all checks go through the `placeOrder` server function using `supabaseAdmin`.

---

### 2. Server layer

**`src/lib/duplicate-guard.server.ts`** — pure server helper:
- `checkDuplicate({ storeId, phone, customerId, fingerprint, deviceId, productIds })` → `{ blocked, warn, matchedRules[], matchedOrderId }`.
- Loads settings; short-circuits when `enabled=false` or `mode='off'`.
- Applies whitelist (customer_id or phone) and excluded products first.
- Queries `orders` within `period_days` filtered by `store_id` + each enabled rule; joins `order_items` for product rule. `match_logic='any'` = OR, `'all'` = AND.

**`src/lib/storefront.functions.ts` — `placeOrder`**:
- Accept new optional inputs `fingerprint`, `deviceId` (already accepts `customerToken`).
- After validation, before insert: call `checkDuplicate`.
- On `block`: insert a `store_duplicate_blocks` row with the full payload, throw a typed error the client shows as the friendly message.
- On `warn`: insert block row with `status='dismissed'` (informational), proceed, and return `{ warning: true, message }` so UI can toast.
- Stamp `fingerprint`/`device_id` on the created order.

**`src/lib/duplicate-protection.functions.ts`** — admin-only (`requireSupabaseAuth` + `is_store_owner`):
- `getDuplicateSettings`, `updateDuplicateSettings`
- `listDuplicateBlocks({ status?, search? })`, `approveBlockedOrder(blockId)` (creates the real order from `payload`), `dismissBlockedOrder(blockId)`
- `listWhitelist`, `addWhitelist`, `removeWhitelist`
- `listExcludedProducts`, `addExcludedProduct`, `removeExcludedProduct`

---

### 3. Storefront

**`src/lib/fingerprint.ts`** — lightweight client fingerprint (canvas + UA + screen + timezone hash via SubtleCrypto). No third-party lib. Persist a random `deviceId` in `localStorage` under `orzen_device_id`.

**`checkout.tsx`**: compute fingerprint + read deviceId, pass into `placeOrder`. On thrown "duplicate blocked" error, render the friendly message in a modal with a "Contact store" button (uses store phone/whatsapp). On `warning`, show a toast but continue to order success.

---

### 4. Store Admin UI

New route `src/routes/_authenticated/admin/duplicate-protection.tsx` with three tabs (mobile-first, matches existing admin patterns via `SettingsPage`-style layout):

1. **Settings** — enable toggle, mode radio (Block / Warn / Off), period select (1/3/7/15/30), rules checkboxes, `any/all` logic toggle.
2. **Blocked orders** — table (cards on mobile): date, phone, matched rules, earlier order link, actions: Approve (creates order) / Dismiss / View payload drawer.
3. **Whitelist & Exclusions** — add/remove customers (by phone or account search) and products (search picker).

Sidebar link "Duplicate Protection" added under Orders group in `src/routes/_authenticated/admin/route.tsx`.

---

### 5. Security & performance

- All settings/whitelist/exclusion reads and writes go through `is_store_owner` policies; `store_id` re-verified server-side on every mutation.
- Duplicate check runs with `supabaseAdmin` inside `placeOrder` only after resolving `store_id` from slug — a token/fingerprint from Store A can never query Store B.
- Recent-window queries hit the new composite indexes; each rule = one indexed lookup, capped to the block payload write.
- No cross-store fingerprint linkage — every query is `WHERE store_id = _store_id`.

---

### Technical details

```text
placeOrder flow:
  validate → resolve store → resolve customer (if token)
  → checkDuplicate(storeId, phone, customerId, fp, deviceId, productIds)
      ├─ settings.enabled=false            → skip
      ├─ whitelist match                   → skip
      ├─ all productIds excluded           → skip
      └─ run enabled rule queries (window=period_days)
          ├─ mode=block + match            → insert block row, throw
          ├─ mode=warn  + match            → insert dismissed block row, flag warning
          └─ no match                      → proceed
  → insert order (with fingerprint, device_id)
```

### Open questions before I build

1. **Approve action** — should "Approve" from the blocked queue create a real order using the saved payload (my default), or just mark it approved and expect the customer to re-checkout?
2. **Match logic default** — I'm defaulting to `any` (any enabled rule triggers a block). Do you want `all` (every enabled rule must match) instead, or keep both as an admin toggle?
3. **Fingerprint scope** — OK to compute a lightweight canvas+UA fingerprint client-side (no external SDK)? Accuracy is ~good, not forensic. Say if you want to skip that rule for now.
