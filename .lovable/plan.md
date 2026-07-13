# Global Default Store Template

Winner Admin (owner) maintains a single global template. New stores auto-inherit it on first creation. Existing stores are untouched unless their admin clicks "Reset to Default Template".

## Data model

New table `public.store_template` — singleton row (id fixed = `'global'`):

- `id text primary key check (id = 'global')`
- `theme jsonb`, `seo jsonb`, `marketing jsonb`, `delivery jsonb`, `payments_config jsonb`, `product_defaults jsonb`
- `primary_color`, `header_color`, `title_bar_color`, `footer_color`, `button_color` (text)
- `description text`
- `banners jsonb` — array of `{ image_url, link_url, sort_order, is_active }`
- `categories jsonb` — array of `{ name, sort_order }`
- `products jsonb` — array of `{ name, description, price, image_url, images, stock, sku, is_active, category_name }` (category_name resolves to created category by name)
- `pages jsonb` — array of `{ slug, title, content }` (reserved; pages table not yet in schema — stored for future use)
- `updated_at timestamptz`, `updated_by uuid`

Grants: `SELECT` to `authenticated` (owners need to preview/reset), `ALL` to `service_role`. RLS: SELECT allowed to authenticated; UPDATE restricted via `has_role(auth.uid(),'admin')`.

A migration seeds one row with sensible defaults derived from current placeholder theme values.

## Owner (Winner Admin) UI

New route `src/routes/_authenticated/owner/store-template.tsx` — a single tabbed editor:

1. **Design & Theme** — colors, radius, header/footer/button colors
2. **Header / Footer** — description, contact defaults
3. **Banners** — reuse existing banner uploader pattern (edits JSON array)
4. **Categories** — add/remove names
5. **Products** — add starter product entries (image, price, stock, category)
6. **Pages** — slug/title/content editor (stored for future pages feature)
7. **Defaults** — product_defaults, seo, marketing, delivery, payments_config

Server fns in `src/lib/owner.functions.ts`:
- `getStoreTemplate` — admin-only, returns the single row
- `updateStoreTemplate` — admin-only, patches provided sections

Add nav entry in owner sidebar.

## Applying template to NEW stores only

In `getMyStore` (auto-create branch) and any explicit create path:
1. Fetch template row via `supabaseAdmin` (loaded inside handler).
2. Insert `stores` row copying scalar fields + jsonb blobs (theme, seo, marketing, delivery, payments_config, product_defaults, colors, description).
3. After insert, seed child rows in the same transaction-style sequence:
   - `categories` — insert each with `store_id`
   - `products` — insert each, mapping `category_name` → created category id
   - `banners` — insert each with `store_id`
4. Stamp `stores.template_version = template.updated_at` for traceability.

Add column `stores.template_version timestamptz null` via migration.

Existing stores keep `template_version = null` and are never auto-touched.

## Reset to Default Template (store admin)

New server fn `resetStoreToTemplate` in `src/lib/admin.functions.ts` (auth: store owner only, confirmed via `is_store_owner`):

- Wipes current `banners`, `categories`, `products` for the store (soft: delete rows where `store_id = ...`).
- Rewrites store scalar/jsonb fields from template.
- Re-seeds children exactly like new-store flow.
- Stamps `template_version = template.updated_at`.

UI: button on `src/routes/_authenticated/admin/settings.tsx` in a "Danger zone" card with a confirmation dialog ("This replaces your current design, banners, categories and products with the latest default template. This cannot be undone.").

## Performance & scalability notes

- Template stored as JSONB blobs so reads/writes are O(1) and one query hydrates the entire template.
- Seeding uses batched `.insert(array)` calls (one per child table), not per-row loops.
- Existing stores are never scanned on template update — zero write amplification.
- Template read only happens at store creation / manual reset, so no hot-path cost for storefront traffic.

## Files touched

- Migration: create `store_template`, seed row, add `stores.template_version`, RLS + grants.
- `src/lib/owner.functions.ts` — `getStoreTemplate`, `updateStoreTemplate`.
- `src/lib/admin.functions.ts` — extend `getMyStore` seeding; add `resetStoreToTemplate`.
- `src/routes/_authenticated/owner/store-template.tsx` — new editor page.
- `src/routes/_authenticated/owner/route.tsx` — add sidebar link.
- `src/routes/_authenticated/admin/settings.tsx` — add "Reset to Default Template" action.

## Out of scope

- No retroactive updates to existing stores (by requirement).
- No versioned template history (single latest row); can be added later if needed.
- `pages` table not created yet — stored in template JSON for when a pages feature ships.
