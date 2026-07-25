## Central Courier Logo Management

Add a centrally-managed logo for each courier provider (Winner Admin) that automatically appears in every Store Admin's Courier Integration card.

### Database
- Migration on `public.courier_providers`: add `logo_url text` column.
- Add public read RPC `get_public_courier_providers()` returning `code, name, logo_url` (SECURITY DEFINER) so all store owners can read logos without exposing API keys.
- Grant EXECUTE to `authenticated`.

### Storage
- Reuse existing `store-assets` bucket under a `courier-logos/` prefix (Owner-only write policy already covered by owner role check performed in the server function using `supabaseAdmin`). Files served via signed/public URL — since bucket is private, we generate a long-lived public read policy for the `courier-logos/` prefix only.
- Add a storage RLS policy: allow anyone (anon+authenticated) SELECT on objects where `bucket_id = 'store-assets' AND name LIKE 'courier-logos/%'`.

### Winner Admin (Owner) — `src/routes/_authenticated/owner/couriers.tsx`
- Extend the edit dialog with a Logo Upload field (drag/click).
- On selection: compress client-side via existing `src/lib/compress-image.ts` (max 512px, WebP, quality 0.9) → upload to `store-assets/courier-logos/{code}-{timestamp}.webp` → save returned URL into `logo_url` via `upsertCourier`.
- Show current logo preview + Remove button.
- Extend `upsertCourier` server function to accept `logo_url` and persist it.
- Extend `listCouriers` to return `logo_url`.

### Store Admin — `src/components/admin/couriers/CourierCard.tsx` + `BrandBadge.tsx`
- Fetch central provider list via new `getPublicCourierProviders()` server function (cached with react-query, key `["courier-providers-public"]`, staleTime 5 min).
- Pass `logoUrl` into `CourierCard` and `BrandBadge`.
- `BrandBadge`: if `logoUrl` present render `<img>` with `object-contain` on a white/neutral rounded tile that works in both light and dark mode (e.g. `bg-white dark:bg-white/90` with subtle border). Fallback to the existing letter avatar when no logo is set.
- Add `loading="lazy"` and `decoding="async"` for performance.

### Sync behavior
- Store Admin queries the public provider list on mount; when the owner uploads a new logo, cache invalidates on next visit (staleTime 5m) and revalidates in background. No manual action needed by store admins.

### Verification
- Typecheck.
- Manual browser flow via Playwright: owner uploads logo → store admin panel `/admin/couriers` shows it in the card header, both light and dark mode.

### Files touched
- `supabase migration` (add column, RPC, storage policy)
- `src/lib/owner-ext.functions.ts` (logo_url in list/upsert)
- `src/lib/admin.functions.ts` or new `src/lib/courier-public.functions.ts` (public list RPC wrapper)
- `src/routes/_authenticated/owner/couriers.tsx` (upload UI)
- `src/components/admin/couriers/providers.ts` (allow dynamic override of `logoUrl`)
- `src/components/admin/couriers/BrandBadge.tsx` (render image)
- `src/components/admin/couriers/CourierCard.tsx` (pass through)
- `src/routes/_authenticated/admin/couriers.tsx` (fetch + merge public logos)
