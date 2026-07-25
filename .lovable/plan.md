
# Zone-Based Delivery System

Replace the two-field `delivery` JSON (`inside_city` / `outside_city` / `free_min` / `cod_enabled`) with a scalable per-store delivery zones table, while keeping the existing `delivery.free_min` and `delivery.cod_enabled` toggles (no regression in checkout/order behavior).

## Database

New migration adds `public.delivery_zones`:

- `id uuid pk`
- `store_id uuid` → `stores(id)`
- `name text` (e.g. "Dhaka City")
- `charge numeric(10,2)` (delivery fee)
- `eta text` (free-form, e.g. "1–2 Days")
- `is_active bool default true`
- `is_default bool default false`
- `sort_order int default 0`
- `courier_code text null` — future courier mapping (steadfast/pathao/redx/paperfly/sundarban)
- `courier_config jsonb default '{}'` — future per-zone courier settings (area codes, IDs)
- `created_at`, `updated_at` timestamps + trigger

Constraints:
- Partial unique index: only one default per store where `is_default = true`.
- GRANT: `authenticated` SELECT/INSERT/UPDATE/DELETE, `service_role` ALL, `anon` SELECT (needed by public storefront checkout).
- RLS: owner full manage via `is_store_owner(store_id)`; public SELECT when the parent store is active AND zone `is_active = true`.
- Backfill trigger: seed two zones from the current `stores.delivery` JSON for existing stores (`Inside City` default + `Outside City`) on first read is not viable — handled instead by a one-time migration `INSERT ... SELECT` over `stores` that reads `delivery->>inside_city` / `outside_city`. Missing values → skip. Ensures no store is left with zero zones.

Keep `stores.delivery` JSON as-is for `free_min` and `cod_enabled` (already read in checkout).

## Server functions (`src/lib/admin.functions.ts`)

New protected fns (owner scoped via `requireSupabaseAuth` + `is_store_owner` check):
- `listDeliveryZones()` — returns all zones for the owner's store, ordered by `sort_order, name`.
- `createDeliveryZone({ name, charge, eta, is_active, is_default })`.
- `updateDeliveryZone({ id, ...fields })`.
- `deleteDeliveryZone({ id })`.
- `setDefaultDeliveryZone({ id })` — atomic: clears any other default, sets this one.
- `reorderDeliveryZones({ ids: string[] })`.

Setting/creating a zone with `is_default = true` unsets others in the same transaction.

Keep the existing `updateDelivery` fn but narrow its schema to `{ free_min, cod_enabled }` — inside/outside fields are removed from the settings form.

## Public/storefront

`src/lib/storefront.functions.ts`:
- `getStoreDeliveryZones({ storeId })` — public SECURITY DEFINER-safe read (via RLS `anon` SELECT) returning only active zones with `id, name, charge, eta, is_default`.
- `placeOrder` — replace `insideCity` with `deliveryZoneId`. Look up zone by id AND store_id AND `is_active`; use its `charge` for `delivery_amount`. Keep the free-shipping coupon + `free_min` logic.

`orders` table already stores `delivery_amount` as a numeric — no schema change needed. Add nullable `delivery_zone_id uuid` column to `orders` in the same migration for reporting (FK, on delete set null).

## Admin UI

Replace `src/routes/_authenticated/admin/delivery.tsx` with a zone manager:

- Top card: general settings — `Free delivery minimum (৳)` + `Cash on Delivery` switch (calls existing `updateDelivery`).
- Zones card:
  - Header with "Add zone" primary button.
  - Table (desktop) / stacked cards (mobile) listing zones with columns: Name, Charge, ETA, Default (radio), Enabled (switch), actions (Edit, Delete).
  - Inline dialog for add/edit with fields Name, Charge (৳), ETA (text), Active switch, Default switch.
  - Drag handle for reorder (optional; simple up/down arrows to stay lightweight — no dnd-kit dep needed).
- Mutations use `useMutation` + `queryClient.invalidateQueries(['admin','delivery-zones'])` — no full page reloads.
- Empty state: "No zones yet — add your first delivery zone" with CTA.
- Reuse existing `Button`, `Input`, `Label`, `Switch`, `Dialog`, `Card` shadcn primitives to match admin design.

## Checkout UI (`src/routes/store/$slug/checkout.tsx`)

- Replace the two hard-coded radio buttons ("Inside city / Outside city") with a dynamic zone selector fed by `getStoreDeliveryZones`.
  - If ≥1 zones: render as radio cards (name + ETA + charge) — pre-select `is_default` (or first).
  - If 0 zones: hide the selector; `delivery_amount = 0`.
- Compute `shipping` from selected zone's `charge` (respecting `free_min` and coupon `free_shipping`).
- Pass `deliveryZoneId` to `placeOrder` instead of `insideCity`.
- Fully client-side, one query on mount, no reloads.

## Courier future-proofing

`courier_code` + `courier_config` on `delivery_zones` let a future courier module map a zone to a provider (e.g. `{ courier_code: 'steadfast', courier_config: { area_id: 'dhaka-1' } }`) without further schema changes. The order confirmation flow can later read the selected zone's courier config to auto-create a shipment.

## Out of scope

- Actual courier API integrations (SteadFast, Pathao, etc.) — only schema hooks.
- District/thana pre-seeded lookup — owners define zones freely.
- Weight/volume-based pricing tiers.

## Files touched

- New migration (delivery_zones table + orders.delivery_zone_id + backfill).
- `src/lib/admin.functions.ts` — zone CRUD fns + narrowed `updateDelivery`.
- `src/lib/storefront.functions.ts` — `getStoreDeliveryZones` + `placeOrder` zone lookup.
- `src/routes/_authenticated/admin/delivery.tsx` — full rewrite.
- `src/routes/store/$slug/checkout.tsx` — dynamic zone selector, remove `insideCity` state.
