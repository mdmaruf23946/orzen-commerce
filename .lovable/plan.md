# Merchant & Customer identification + tenant isolation audit

## What the audit found

Checked: table columns, row-level access rules, storage buckets, database helper
functions, and the AI agent's data access code.

**Good already**
- Every store and every customer already has a permanent internal UUID.
- Invoice numbering is completely separate: order invoices come from a per-store
  invoice counter (with its own prefix/format settings) and subscription invoices
  from their own numbering. Neither is reachable by a signed-in user directly.
- Files are split per store folder; private folders (digital, invoices,
  deliverables, returns, secure) are blocked from public reading.
- Merchant AI tools filter every query by the merchant's own store.

**Gaps to fix**
1. There is no human-readable Merchant Code or Customer Code anywhere yet.
2. `get_store_bestsellers` can be called by anyone — including signed-out
   visitors — for *any* store id, returning that store's best-selling products.
   This is a cross-tenant leak (IDOR).
3. `refresh_store_subscription_status` can be called by any signed-in user with
   any store id; it must be restricted to the platform/server only.
4. The AI agent runs with full database rights and relies only on code to filter
   by store. Correct today, but one missed filter would leak data; it needs a
   hard guard.

## What will be built

### 1. Merchant Code
- New permanent column on stores: `merchant_code`, unique, never reused.
- Format: `A000001` … `A999999`, then `B000001` …, after `Z999999` it rolls to
  `AA000001` and keeps going, so it never runs out.
- Generated automatically by the database when a store is created; existing
  stores get codes in creation order (oldest = A000001).
- Read-only everywhere: no screen can edit it.

### 2. Customer Code
- New permanent column on customers: `customer_code`, unique per store,
  formatted `A000001-C000001` (merchant code + customer counter).
- Counter is per merchant, so each merchant's first customer is `C000001`.
- Generated automatically on customer creation; existing customers backfilled.

### 3. Codes stay identification-only
- The codes are never written into invoice numbers, payment references, or
  transaction ids. Existing numbering stays untouched.
- Codes are shown for reference/search only (store profile, customer list and
  customer detail), never used to look data up without an ownership check.

### 4. Isolation fixes
- Lock `get_store_bestsellers` so it only answers for the caller's own store
  (or, for the public storefront path, the store being browsed) instead of any
  store id.
- Restrict `refresh_store_subscription_status` to the platform/server only.
- Add a shared guard in the AI agent layer so every data action is executed
  through one store-scoped helper; any query without a store filter fails
  instead of returning data.
- Re-check the customer, order, payment and AI tables so each one only answers
  for the signed-in merchant or their permitted staff.

### 5. Scale
Codes are generated from database counters, not from counting rows, so they stay
correct and fast with millions of merchants and customers. Lookups use the
internal UUID; the codes get unique indexes for search.

## Technical notes

- Migration adds `stores.merchant_code text unique not null` (backfilled via a
  dedicated `merchant_code_seq` sequence + `format_merchant_code(bigint)`
  base-26-style formatter) and `store_customers.customer_code text` with
  `unique (store_id, customer_code)`, filled by a `before insert` trigger using a
  per-store counter row (`store_customer_counters`) updated inside the trigger so
  concurrent inserts cannot collide.
- Triggers are `security definer`, `set search_path = public`, and ignore any
  client-supplied code value.
- `get_store_bestsellers` gains a `has_store_access(_store_id)` check for
  authenticated callers and keeps public access only through the existing public
  storefront path; `refresh_store_subscription_status` has `execute` revoked from
  `anon`/`authenticated`.
- AI layer: `ActionCtx` keeps using the resolved `storeId` from the verified
  merchant identity; add a `scoped(table)` helper in `merchant-ai/core.server.ts`
  that applies `.eq("store_id", storeId)` centrally, and route every handler in
  `tools.server.ts` through it.
- Verification after the fixes: attempt cross-tenant reads (another store's
  customers, orders, bestsellers, files) with a merchant session and confirm each
  returns nothing; confirm invoice numbers are unchanged and contain no codes.

## Out of scope

No UI redesign, no change to existing features, no change to invoice, payment or
subscription numbering.
