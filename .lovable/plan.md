
## Goal

Give the Winner Admin one place to control the branding (logo, colors, description, status) of every Payment Gateway and Courier. Store admins automatically pick up those brand values everywhere — no per-store logo uploads.

## Current state (verified)

- `platform_payment_gateways` table stores `id, label, enabled, sort_order, logo_url, notes` — no brand color, secondary color, background, or description columns yet. Owner page (`owner/payment-gateways.tsx`) only toggles enabled; there is no upload UI.
- `courier_providers` already has `logo_url`, `is_active`, `is_default`. Owner page (`owner/couriers.tsx`) already uploads logos to `store-assets` under `courier-logos/…`. No brand color fields yet.
- Store side already reads shared logos via `get_public_courier_providers` RPC (couriers) but payment gateway brand is currently hard-coded in `src/components/admin/payments/providers.ts` (`PAYMENT_BRANDS`) — store admin never fetches gateway branding from the DB.
- `BrandMark` (payments) already accepts a `logoUrl` prop; couriers use `BrandBadge` similarly. Both just need to be fed dynamic values.

## What to build

### 1. Database migration — extend both branding tables

Add these columns (nullable, with sensible defaults) to `platform_payment_gateways` and `courier_providers`:

- `brand_color TEXT` (hex)
- `secondary_color TEXT` (hex, optional)
- `icon_bg_color TEXT` (hex, optional)
- `description TEXT` (short tagline)

Also add matching fields to the existing public RPCs so store-side reads get them:

- Extend `get_public_courier_providers()` to return the new columns.
- Add `get_public_payment_gateways()` RPC returning `id, label, logo_url, brand_color, secondary_color, icon_bg_color, description, enabled` (only where `enabled = true`), granted to `anon` + `authenticated`.

### 2. Winner Admin — unified "Brand Assets" page

Create `src/routes/_authenticated/owner/brand-assets.tsx` with two tabbed sections: **Payment Gateways** and **Couriers**. Register it in the Owner sidebar under Platform Settings.

Each row is a professional brand card:

- Logo preview (SVG/PNG/WebP; upload via existing `ImageUploader` → `store-assets` bucket, path `brand-logos/<kind>/<code>-<ts>.<ext>`).
- Brand name (label).
- Brand color, secondary color, icon background — color-picker inputs with hex text fallback and swatch preview.
- Short description (textarea).
- Status toggle (Active/Inactive → maps to existing `enabled` / `is_active`).
- Save button per card; live preview of the resulting brand card at the top of the editor.

The existing owner pages (`owner/payment-gateways.tsx`, `owner/couriers.tsx`) stay as they are for compatibility, but the new page becomes the recommended entry point (add a link/notice).

### 3. Extend server functions

- `store-payments.functions.ts` → extend `upsertPlatformPaymentGateway` input & write to accept the new fields.
- `owner-ext.functions.ts` → extend `upsertCourier` similarly (already handles logo_url).
- Add `listPublicPaymentGateways` server fn wrapping the new RPC for store admin consumption.

### 4. Store Admin — auto-sync branding from DB

- Replace the hard-coded `PAYMENT_BRANDS` lookups on `src/routes/_authenticated/admin/payment-gateway.tsx` with a query to `listPublicPaymentGateways`, then merge DB values over the static registry (DB wins; static acts as a fallback for anything not yet configured). `BrandMark` receives `logoUrl`, and card border/background use `brand_color` / `icon_bg_color` from DB.
- Courier cards on `admin/couriers.tsx` already pull `logo_url` from the public RPC; extend the same query to also read `brand_color` / `description` and forward to `CourierCard` / `BrandBadge`.
- No store-side upload UI for these logos anywhere.

### 5. Future-ready

Because both tables are the source of truth and the store reads via generic RPCs, adding a new gateway or courier is just inserting a row from the Winner Admin (or a migration for a brand-new adapter). No code change is required for branding — only when a new adapter's business logic is added.

## Technical details

- Migration follows the standard 4-step block for altered tables (ALTER + GRANT already exists + policies unchanged). New RPC is `SECURITY DEFINER`, `STABLE`, `search_path = public`, granted to `anon, authenticated`.
- Color inputs: `<input type="color">` + text field, validated as `/^#([0-9a-f]{3}|[0-9a-f]{6})$/i` client-side.
- Logo upload reuses `compressImage({ maxEdge: 512, quality: 0.9 })` and `store-assets` bucket, mirroring the existing courier flow. Rendering uses the existing `/api/img/<path>` proxy so no bucket policy changes are needed.
- Backward compatibility: all new columns nullable; store UI falls back to the static `PAYMENT_BRANDS` registry when DB value is null, so nothing breaks before the owner configures brands.

## Out of scope

- Removing the existing separate owner pages (kept for continuity; new page is additive).
- Any change to actual payment/courier adapter logic — this is branding only.
