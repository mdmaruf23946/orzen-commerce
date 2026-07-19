
## Goal

Winner Admin fully controls ad codes (Adsterra now, provider-agnostic later). Ads render only in the Store Admin Panel and only for stores on the Free plan. Never on storefront, never on checkout/forms/popups.

## Data model (new migration)

Two tables in `public`:

1. `ad_settings` (singleton, `id = 'global'`)
   - `enabled boolean` (global kill switch)
   - `provider text` default `'adsterra'` (future: `adsense`, `monetag`, …)
   - `show_on_plans text[]` default `'{free}'` (plan_tier list where ads appear)
   - `updated_at timestamptz`

2. `ad_slots`
   - `id uuid pk`
   - `slot_key text unique` — one of a fixed enum: `admin_dashboard_bottom`, `admin_reports_bottom`, `admin_settings_bottom`, `admin_analytics_bottom` (+ room for more)
   - `name text`, `description text`
   - `provider text` default `'adsterra'`
   - `code text` (raw ad HTML/JS snippet, server-controlled → trusted)
   - `format text` (`banner_728x90`, `banner_320x50`, `native`, `responsive`)
   - `is_active boolean`
   - `starts_at`, `ends_at timestamptz null` (schedule, optional)
   - `updated_at`, `created_at`

RLS + GRANTs:
- `ad_settings`, `ad_slots`: `SELECT/INSERT/UPDATE/DELETE` for owner role only; `SELECT` for `authenticated` limited to safe columns via a `SECURITY DEFINER` RPC (see below). Service role: ALL.

RPCs (SECURITY DEFINER):
- `get_my_active_ads()` → returns array of `{ slot_key, code, format }` **only if**
  - `ad_settings.enabled = true`
  - caller's store's `plan_tier` ∈ `show_on_plans`
  - slot `is_active = true` and within schedule window
  Otherwise returns `[]`. This is the only path client code reads ad `code` from, so plan gating is server-enforced.

## Server functions

`src/lib/ads.functions.ts` (owner-gated CRUD, via `requireSupabaseAuth` + `has_role('owner')`):
- `getAdSettings`, `updateAdSettings`
- `listAdSlots`, `upsertAdSlot`, `deleteAdSlot`, `toggleAdSlot`
- `adminStats` → `{ totalSlots, activeSlots, enabledGlobal, lastUpdated }`

`src/lib/ads-public.functions.ts` (any authenticated store admin):
- `getMyActiveAds` → calls RPC above; returns `[]` for paid plans or when disabled.

## UI

**Winner Admin — `/owner/ads` (new sidebar item "Advertisement Management")**
- Header: global Enable/Disable switch, provider selector, plans multi-select (`show_on_plans`).
- Stats cards: Total Active Ads, Active Ad Slots, Global Status, Last Updated.
- Slots table with per-row Active toggle, edit, delete, "Preview" (renders code in a sandboxed `<iframe srcDoc>` inside a modal — never inline in the panel).
- Add/Edit dialog: slot_key (from fixed list), name, format, code (textarea), schedule.

**Store Admin — passive `<AdSlot slotKey="…" />` component**
- Uses `useQuery(['my-ads'], getMyActiveAds, { staleTime: 5m })`.
- Renders only if a matching entry exists in the response.
- Renders inside a sandboxed `<iframe srcDoc={code}>` with fixed height per `format` to prevent layout shift, `loading="lazy"`, `sandbox="allow-scripts allow-popups allow-same-origin"` (Adsterra requires scripts). Uses `IntersectionObserver` to only inject `srcDoc` when within 200px of viewport.
- Placements (edit these 4 pages only): bottom of `admin/index.tsx`, `admin/analytics.tsx`, `admin/settings.tsx`, and reports (nearest analog — reuse analytics page unless a separate reports page is added later). Never in checkout, forms, popups, storefront routes.

## Files to add / edit

Add:
- migration (tables, RPC, policies, grants)
- `src/lib/ads.functions.ts`
- `src/lib/ads-public.functions.ts`
- `src/components/admin/AdSlot.tsx`
- `src/routes/_authenticated/owner/ads.tsx`

Edit:
- `src/routes/_authenticated/owner/route.tsx` — sidebar link "Advertisement Management"
- `src/routes/_authenticated/admin/index.tsx` — mount `<AdSlot slotKey="admin_dashboard_bottom" />` at bottom
- `src/routes/_authenticated/admin/analytics.tsx` — bottom slot
- `src/routes/_authenticated/admin/settings.tsx` — bottom slot

## Security notes

- Ad `code` is trusted content authored by Winner Admin only; render in a **sandboxed iframe** to isolate from the admin app (prevents ad script reading admin cookies/DOM).
- Plan gate is enforced in the RPC, not the client — a paid-plan admin calling `getMyActiveAds` gets `[]`.
- No ads under `/store/*` (storefront), `/checkout`, auth pages, or modals.

## Out of scope (this pass)

- Analytics of ad impressions/clicks (Adsterra dashboard handles this).
- Provider adapters beyond storing `provider` + raw `code` (sufficient for Adsterra/AdSense/Monetag snippets today).
