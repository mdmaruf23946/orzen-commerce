## Goal

Replace per-page mobile ad placements with a single sticky-bottom 320×50 banner that renders once for the whole Store Admin Panel, is mobile-only, and is fully controlled from the Winner Admin's Advertisement Management.

## Approach

Reuse the existing ad stack (`ad_settings`, `ad_slots`, `get_my_active_ads` RPC, `AdSlot` sandboxed iframe). No schema changes, no new RPCs — just a new reserved `slot_key` and a new presentation component.

### 1. Reserved slot key

Add `admin_mobile_sticky_bottom` to the fixed slot-key list used by the Winner Admin form in `src/routes/_authenticated/owner/ads.tsx` so the owner can create/edit/toggle it like any other slot. Recommended format for this slot: `banner_320x50`. Nothing else needs to change server-side — plan gating, global enable/disable, provider swap, code replace, schedule, active toggle all already flow through `get_my_active_ads` + `updateAdSettings` / `upsertAdSlot` / `toggleAdSlot`.

### 2. New component `StickyMobileAdBar`

New file `src/components/admin/StickyMobileAdBar.tsx`. Behavior:

- Uses `useIsMobile()` (existing hook, `<768px`). Returns `null` on desktop/tablet.
- Calls `getMyActiveAds` via the same `useQuery(['my-ads'])` key `AdSlot` already uses, so the request is shared and cached (5 min stale). No duplicate fetch.
- Finds the entry with `slot_key === 'admin_mobile_sticky_bottom'`. If missing / no `code` / query errored → renders `null` (container fully collapses, zero empty space).
- When present, renders a `position: fixed; bottom: 0; left: 0; right: 0; height: 50px; z-index: 50` wrapper with a sandboxed `<iframe srcDoc>` (same sandbox flags + `loading="lazy"` + `referrerPolicy="no-referrer"` as `AdSlot`) sized 320×50 and horizontally centered. Wrapper gets `pointer-events-auto` and a subtle top border so it reads as a bar; safe-area inset padding via `env(safe-area-inset-bottom)` for iOS.
- Plan/global gating is enforced by the RPC — no client-side plan check needed.

### 3. Mount once in the admin layout

Edit `src/routes/_authenticated/admin/route.tsx` only:

- Import and render `<StickyMobileAdBar />` once, as a sibling of the layout's `<Outlet />`, inside the root layout container. It survives client-side navigation between admin pages (no remount, no refetch), satisfying "load once and reuse".
- Add a mobile-only bottom spacer so page content is never hidden behind the bar: apply `pb-[70px] md:pb-0` (or equivalent) to the main content wrapper in the same file. Uses safe-area inset so iOS home indicator is respected.

### 4. Remove now-redundant inline mobile ad usage

The three previously-added `<AdSlot slotKey="admin_*_bottom" />` mounts in `admin/index.tsx`, `admin/analytics.tsx`, `admin/settings.tsx` stay as-is for desktop/tablet responsive/728×90 formats (that was the previous scope). The sticky bar is additive and independent. No files besides the two below are edited.

## Files

Add:
- `src/components/admin/StickyMobileAdBar.tsx`

Edit:
- `src/routes/_authenticated/admin/route.tsx` — mount the bar once; add mobile bottom padding to the content wrapper.
- `src/routes/_authenticated/owner/ads.tsx` — add `admin_mobile_sticky_bottom` to the slot-key options list so Winner Admin can manage it.

## Notes / non-goals

- No DB migration, no new server function, no changes to `AdSlot`, no changes to storefront/checkout/auth (already excluded from the ad system).
- Winner Admin already has: enable/disable global, provider swap, code replace, format change, per-slot active toggle, schedule — all reused unchanged.
- Performance: single shared React Query cache entry, lazy-mounted iframe, 50px fixed height → no layout shift.
