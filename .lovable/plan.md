## Goal

Give every store its own configurable invoice numbering scheme, generated automatically at order confirmation, unique per store, never reused on cancellation/deletion, and always sequential.

## Current state (verified)

- `public.orders.invoice_no text` exists (nullable, no unique index).
- `public.generate_invoice_no(_store_id)` currently hardcodes format `INV-YYYYMM-0001` scoped per store, called inside the `on_order_status_change` trigger only when status becomes `confirmed`. Cancellations already skip the branch, so no reuse occurs today.
- No invoice settings exist on `stores` and no per-store sequence table exists.

## Design

### 1. Data model (migration)

New table `public.store_invoice_settings` (one row per store):

- `store_id uuid PK REFERENCES stores(id) ON DELETE CASCADE`
- `prefix text NOT NULL` — 1–10 chars, uppercase letters/digits
- `separator text NOT NULL DEFAULT '-'` — one of `-`, `/`, `_`, `` (empty = none)
- `padding smallint NOT NULL DEFAULT 6 CHECK (padding BETWEEN 4 AND 8)`
- `start_number bigint NOT NULL DEFAULT 1` — owner-editable floor; only applied if higher than current sequence
- `include_year boolean NOT NULL DEFAULT false`
- `include_month boolean NOT NULL DEFAULT false`
- `next_number bigint NOT NULL DEFAULT 1` — monotonically increasing counter (never decremented)
- timestamps + `updated_at` trigger

Grants: `authenticated` SELECT/INSERT/UPDATE via RLS `is_store_owner(store_id)`; `service_role` ALL. Also readable by winner admin via `has_role('admin')`.

Add: `CREATE UNIQUE INDEX orders_store_invoice_no_uniq ON public.orders (store_id, invoice_no) WHERE invoice_no IS NOT NULL;` to enforce per-store uniqueness even under concurrency.

### 2. Auto-provision defaults

Trigger `AFTER INSERT ON public.stores`: insert a settings row with:
- `prefix` = first two A–Z letters of `stores.name` uppercased (fallback `ST` when nothing usable)
- other columns = defaults

Backfill migration: insert a row for every existing store using the same rule.

### 3. Number generator (replace existing)

Rewrite `public.generate_invoice_no(_store_id)` as SECURITY DEFINER:

1. `SELECT ... FOR UPDATE` the settings row (row-level lock → sequential per store, race-safe).
2. `seq := GREATEST(next_number, start_number)`.
3. Compose:
   - Optional `YYYY` / `YYYYMM` segment when `include_year` / `include_month` set.
   - `lpad(seq::text, padding, '0')`.
   - Join `prefix`, optional date, number with `separator` (skip separator when empty).
4. `UPDATE ... SET next_number = seq + 1`.
5. Return the string.

Called from the existing `on_order_status_change` trigger's confirm branch — unchanged call site. Cancellations still skip assignment, so numbers never reuse. Deleting an order does not decrement `next_number` either.

### 4. Winner admin visibility

The existing admin orders query already selects `invoice_no`; no change. Admins do not mutate invoice numbers directly — uniqueness is enforced structurally.

### 5. UI — Store admin

Add an "Invoice numbering" card to `src/routes/_authenticated/admin/settings.tsx` (existing settings page):

- Fields: prefix (uppercase, live-sanitized), separator (segmented `-` `/` `_` `None`), padding (4–8 slider), start number, include year, include month.
- Live preview label rendering the composed sample invoice using current form state.
- Server function `updateInvoiceSettings` (`requireSupabaseAuth` + `is_store_owner`) validates and upserts the row.
- Server function `getInvoiceSettings` returns the row + a computed preview.

No changes to the storefront or checkout — invoice numbers are assigned only on confirmation as today.

## Files touched

- `supabase/migrations/<new>.sql` — table, grants, RLS, index, trigger, backfill, rewritten `generate_invoice_no`.
- `src/lib/admin.functions.ts` (or new `src/lib/invoice-settings.functions.ts`) — `getInvoiceSettings`, `updateInvoiceSettings`.
- `src/routes/_authenticated/admin/settings.tsx` — new card + form.

## Guarantees mapping

- Unique per store → composite unique index + row-locked counter.
- No reuse on cancel/delete → generator only runs on confirm; deletes don't touch `next_number`.
- Sequential → `FOR UPDATE` serializes increments.
- Independent per store → per-store row in `store_invoice_settings`.
- Owner-editable prefix / format → settings row with owner-only RLS.
- Auto default prefix from name → insert trigger on `stores`.
- Admin can view but cannot dup → read-only for admin role; index prevents duplicates by construction.
