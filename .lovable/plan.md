## Goal

Fix the Store Admin sidebar/header so the top branding area shows the **ORZEN platform icon + wordmark** together (from Winner Admin defaults), with "Store Admin" as a small subtitle underneath. Remove the duplicate hard-coded ShoppingBag icon. Add a Store Branding section in Store Settings so each store can either use platform defaults or override with its own logo/wordmark/name.

## Changes

### 1. `src/routes/_authenticated/admin/route.tsx` — sidebar + mobile header
- Remove the hard-coded `ShoppingBag` icon block (currently rendered on the far left of the brand row).
- Replace the brand row with a single `<StoreBrandMark />` component (new, see #2) that renders either:
  - ORZEN platform icon + wordmark (`primaryLogo` + `primaryWordmark` from `platform_branding`, theme-aware), or
  - The store's custom logo/wordmark/name when the store opted into custom branding.
- Below it, keep the small `Store Admin` subtitle in `text-[11px] text-muted-foreground` (unchanged hierarchy — platform brand dominant, subtitle subdued).
- Mobile top bar (`md:hidden`): replace the current `BrandMark placement="mobile_header"` with the same `<StoreBrandMark compact />` (icon + short wordmark), no duplicated icon.
- Collapsed sidebar state: show icon only (no wordmark, no subtitle).

### 2. New component `src/components/admin/StoreBrandMark.tsx`
- Reads:
  - `usePlatformBranding()` for ORZEN defaults (already exists in `src/lib/platform-branding.tsx`).
  - Current store via existing `["admin","store"]` query (`getMyStore`) to read the new `branding` JSONB column.
- Logic:
  - If `store.branding.source === "custom"`: render according to `store.branding.mode` (`logo` | `wordmark` | `both`) using `store.branding.logo_url`, `store.branding.wordmark_url`, `store.branding.name` (text fallback when no wordmark image).
  - Else: render ORZEN platform `primaryLogo` + `primaryWordmark` (dark/light variant based on `documentElement.classList.contains('dark')`). Falls back to text "ORZEN" if assets missing.
- Props: `compact?: boolean` (smaller sizes for mobile), `iconOnly?: boolean` (collapsed sidebar).

### 3. Database — add `branding` JSONB to `stores`
Migration:
```sql
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS branding jsonb NOT NULL DEFAULT '{"source":"platform"}'::jsonb;
```
Shape:
```json
{
  "source": "platform" | "custom",
  "mode": "logo" | "wordmark" | "both",
  "logo_url": "…",
  "wordmark_url": "…",
  "name": "…"
}
```
No new RLS needed — `stores` policies already cover owner read/write.

### 4. `src/lib/admin.functions.ts` — extend `updateStore` validator
- Add `branding` to the store update Zod schema (optional object matching the shape above).
- Add `branding` to the returned store shape (already returned via `select *`).

### 5. `src/routes/_authenticated/admin/settings.tsx` — new "Store Branding" section
- Add a card titled **Store Branding** with:
  - Radio: `Use Default Platform Branding` / `Use Custom Store Branding`.
  - When custom: show `Display mode` select (Logo only / Wordmark only / Logo + Wordmark), plus `ImageUploader` for custom logo, `ImageUploader` for custom wordmark, and a text input for `Store brand name` (used as wordmark text fallback).
  - When default: show a small preview of the current ORZEN platform branding.
- Saves through existing `updateStore` server fn using the new `branding` field.
- Keeps the existing (legacy) `logo_url` field untouched to avoid regressions elsewhere.

### 6. Winner Admin controls
No changes required. `updatePlatformBranding` in `src/lib/platform-branding.functions.ts` already supports `primaryLogo`, `primaryWordmark`, `lightLogo`, `darkLogo`, `lightWordmark`, `darkWordmark` assets — this covers requirement #5 (light/dark variants). Winner Admin UI already exposes these upload slots.

## Out of scope
- Navigation, permissions, menu items, badge counts — untouched.
- Global platform branding management UI — already exists, no change.
- `platform_branding` schema — unchanged.

## Verification
- Load Store Admin: sidebar shows ORZEN icon+wordmark (from platform defaults) with "Store Admin" small underneath; no duplicate ShoppingBag icon.
- Toggle dark mode: platform brand swaps to dark asset when configured.
- Settings → Store Branding → switch to Custom, upload assets, save → sidebar updates to custom branding for that store only.
- Switch back to Default → ORZEN branding returns.
- Confirm another store (different owner) is unaffected.
