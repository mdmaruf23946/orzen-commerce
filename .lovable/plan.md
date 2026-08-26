# Employee logins: connect staff accounts to their employer's store

## Confirmed problem

The RBAC layer added `src/lib/store-access.ts` (`resolveStoreAccess`, `storeAccess()`, `ownerOnlyAccess`), but only the employee-management screens use it. Every other Merchant Panel data function resolves the store with its own copy of "find the store whose `owner_user_id` = the signed-in user".

An employee has their own login and is linked only through `store_staff.user_id`, so those lookups find nothing.

Already fixed in this change: `getMyStore` no longer creates a blank store for a staff account — it now returns the employer's store, and refuses (with a clear message) for inactive staff. Stray empty stores stop being created and the panel loads the right store.

Still open: the ~30 other server modules that each resolve the store by owner id, so an employee sees empty orders/products/customers inside that store.

## What to build

1. Add one shared resolver in `src/lib/store-access.ts`:
   - `resolveStoreRef(supabase, userId)` → `{ id }` of the owner's store, or of the active `store_staff` row's store, else `null`.
2. Replace the per-file store lookups with that resolver in the merchant server modules that currently do `.from("stores").eq("owner_user_id", userId)` for a read-scope lookup, e.g.:
   `admin.functions.ts`, `admin-order.server.ts`, `badge-counts.functions.ts`, `business.functions.ts`, `courier-parcels.functions.ts`, `customers-admin.server.ts`, `digital-admin.functions.ts`, `duplicate-protection.functions.ts`, `fraud.functions.ts`, `inventory.functions.ts`, `landing-builder.functions.ts`, `landing-pages.functions.ts`, `marketing.server.ts`, `messenger-inbox.functions.ts`, `whatsapp-inbox.functions.ts`, `whatsapp.functions.ts`, `quick-order.shared.ts`, `returns-admin.functions.ts`, `service-checkout.server.ts`, `store-support.functions.ts`, `subscriptions-admin.functions.ts`, `ai-review.functions.ts`, `invoice-settings.functions.ts`, `invoice-templates.functions.ts`, `legal.functions.ts`, `notify-settings.functions.ts`, `seo.functions.ts`, `themes.functions.ts`, `plan-guard.ts`.
   Where a lookup selects extra columns (e.g. `couriers`, `marketing`, `theme_overrides`), resolve the id first, then select those columns by `id`.
3. Keep owner-only modules owner-scoped: `billing.functions.ts`, `staff.functions.ts`, `employees.functions.ts`, `domains.functions.ts`, `cloudflare-domains.functions.ts`, `store-payments.functions.ts` — employees must not reach billing, team, domains or payment credentials.
4. Enforce section permissions where employees now gain access: call `assertSection(access, "<section>", "view" | "manage")` from the existing `panel-sections` map on write paths (orders, products, inventory, customers, returns, marketing…).

## Notes

- Database policies already allow this: `stores`, `products`, `orders`, `categories` each have an `is_store_employee(...)` policy, so employee reads/writes pass RLS once the server resolves the right `store_id`.
- Verification: sign in as an employee, confirm the panel shows the merchant's store name, orders and products; confirm billing/team/domains still refuse; confirm no new row appears in `stores`.
