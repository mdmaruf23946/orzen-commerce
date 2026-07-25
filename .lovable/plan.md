## Goal

Create a dedicated **Courier Brand Assets** management page in Winner Admin with an expanded field set (dark logo, favicon, official URLs, display order, etc.), a live preview matching how the courier card renders in Store Admin, and automatic sync — Store Admins can only edit credentials, never branding.

## Current state (verified)

- `courier_providers` already has: `name, code, logo_url, brand_color, secondary_color, icon_bg_color, description, is_active, is_default, config (jsonb)`. Unique constraint on `code`.
- Owner policy `couriers owner all` scopes writes to owners; public read is via `get_public_courier_providers()` RPC.
- The unified `owner/brand-assets.tsx` tab covers couriers today with only the shared fields. `owner/couriers.tsx` handles credentials/config.
- Store Admin `admin/couriers.tsx` already pulls `logo_url + brand_color + description` from the public RPC — new fields just need to be added to the RPC to flow through.

Missing fields from the request that need to be added: `dark_logo_url`, `favicon_url`, `website_url`, `docs_url`, `support_url`, `sort_order`.

## What to build

### 1. Migration — extend `courier_providers`

Add nullable columns: `dark_logo_url text`, `favicon_url text`, `website_url text`, `docs_url text`, `support_url text`, `sort_order int default 100`. Extend `get_public_courier_providers()` to return them (ordered by `sort_order, name`). Keep the unique constraint on `code`; also enforce case-insensitive unique on `name` via a unique index on `lower(name)` so duplicates are prevented server-side.

### 2. Dedicated page: `owner/courier-brand-assets.tsx`

New route registered in the Owner sidebar under **Platform** (next to the existing Brand Assets entry, labeled "Courier Brand Assets"). The old couriers tab inside `brand-assets.tsx` stays but links to this page for the richer editor.

Each courier renders as an expandable brand card with:

- **Live preview** at the top mirroring the exact Store Admin `CourierCard` header (logo chip using `icon_bg_color`, name in `brand_color`, secondary color accent, active/inactive status badge, description line).
- **Identity**: Name (with duplicate-name check on blur), Code (read-only for existing rows, editable when creating).
- **Logos**: Primary logo, Dark/Monochrome logo, Small icon/favicon — each uses `ImageUploader` writing to `store-assets` under `brand-logos/courier/<code>/<kind>-<ts>.<ext>`. Client-side validation: max 2 MB, min 64px on the shortest edge for logos / min 32px for favicon, formats limited to SVG/PNG/WebP, transparent PNG/SVG allowed. PNG/WebP auto-compressed via existing `compressImage({ maxEdge: 512 })`; SVG uploaded as-is.
- **Colors**: Brand color, Secondary color, Icon background — reuse the `ColorInput` component with hex validation (`/^#([0-9a-f]{3}|[0-9a-f]{6})$/i`).
- **Content**: Description (textarea).
- **Links**: Website URL, Documentation URL, Support URL — validated as `https?://` URLs.
- **Ordering & status**: Display order (number) and Active toggle.
- **Actions**: "Save branding" (per card) and "Add new courier" button at the top for future providers (prompts for Name + Code).

Every field is disabled if the current user isn't an owner (defense in depth — RLS already blocks writes).

### 3. Server functions

- Extend `upsertCourier` in `src/lib/owner-ext.functions.ts` to accept the new columns and enforce duplicate name check (case-insensitive) on the server before write.
- Add a small `createCourierProvider` fn for the "Add new courier" flow (Name + Code + optional starter branding); reuses `upsertCourier` under the hood.
- Extend `listCouriers` to return the new fields so the editor can hydrate.

### 4. Store Admin propagation (no editing)

- `admin/couriers.tsx` continues to read via `get_public_courier_providers()`. Forward the new fields (`dark_logo_url`, `favicon_url`, `website_url`, `docs_url`, `support_url`, `sort_order`) to `CourierCard`. Card automatically picks the dark logo when the app is in dark mode; favicon shows in compact/mini views; website/docs/support show as small helper links inside the courier config sheet.
- Store Admin UI: no upload controls, no color inputs — those are removed/hidden if they exist for these branding fields. Credential/config editing stays exactly as-is.

### 5. Future ready

Because everything is a DB row, adding "Sundarban", "eCourier" or any new provider is done from this page (or a migration inserting the row). The RPC returns whatever exists, and both Winner Admin editor and Store Admin cards render the new provider automatically with no code changes. Adapter/business logic for a brand-new courier still needs code — this plan is branding-only.

## Technical details

- Migration follows the required order for altered tables (ALTER COLUMN + REPLACE FUNCTION). Existing GRANTs are preserved.
- Image upload uses the existing `/api/img/<path>` proxy — no new storage policies.
- Duplicate name enforcement: DB unique index on `lower(name)` + friendly client-side check calling a lightweight `checkCourierName` server fn.
- Sort order defaults to 100; RPC orders `ASC NULLS LAST, name ASC`.
- `courier_providers` remains the single source of truth; the static `COURIERS` registry in `src/components/admin/couriers/providers.ts` stays only for `supports` capability flags (sandbox, pickup, etc.) which are not part of branding.

## Out of scope

- Store Admin credential/config UI changes beyond forwarding new display fields.
- Courier adapter/business logic for new providers.
- Removing the couriers tab from the existing `brand-assets.tsx` (kept as a shortcut).
