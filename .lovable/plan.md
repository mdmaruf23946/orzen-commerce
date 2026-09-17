# ORZEN login, signup subdomain, and production isolation fix

## Confirmed causes

1. **Login fails after initially working:** the verified production Worker version was replaced four minutes later by another Wrangler deployment. Its browser bundle points to the development Supabase project while its server secrets point to production, so successful login tokens are rejected as “Invalid token.” Cloudflare DNS and the merchant account are not the cause.
2. **New-account subdomain is always rejected:** anonymous signup calls `is_slug_taken(text)`, but the latest security-hardening migration removed `anon` execution permission. Production returns `42501 permission denied` for every valid slug.
3. **Stale Lovable records are present but are not causing authentication:** `ad.orzen.top` and `_lovable.ad.orzen.top` still point to/verify Lovable. The application also retains an old optional server-forwarding fallback to `orzen-commerce.lovable.app`.

## Changes

### 1. Restore safe public slug checking
- Add one migration granting `anon` and `authenticated` execute access only to `public.is_slug_taken(text)`.
- Keep the function `SECURITY DEFINER`, boolean-only, and preserve its fixed search path so no tenant or merchant data is exposed.
- Apply the migration to production and verify both available and already-used slugs through the same anonymous RPC used by signup.

### 2. Isolate production from the overwrite path
- Create/use a production-only Worker service name that the current automatic Wrangler publisher does not target.
- Update the guarded production script to deploy only to that production-only service, still pinning `rljisleyqluoexmtncos`, scanning every browser chunk, checking the candidate, and checking the live domain after promotion.
- Copy the existing required runtime secrets by name/value without printing them, then move `orzen.top` and `*.orzen.top` Worker custom domains to the production-only service.
- Leave the automatically published `orzen-commerce` service detached from all public ORZEN domains, so a later development build cannot replace the live site.

### 3. Remove obsolete Lovable routing without breaking AI
- Remove the unused server fallback that forwards private API traffic to `orzen-commerce.lovable.app`; production must execute against its own Supabase/runtime secrets.
- Delete the stale `ad.orzen.top` and `_lovable.ad.orzen.top` DNS records after confirming no active ORZEN route uses them.
- Keep `LOVABLE_API_KEY` only if it is still the configured AI Gateway credential; it is not a Supabase/auth credential. Do not delete active `@lovable.dev` libraries or AI access merely because of their name.
- Update deployment documentation to describe the isolated production service and prohibit attaching public domains to the automatic preview service.

### 4. End-to-end verification
- Confirm the live browser bundle and server health both identify production Supabase and contain no development project reference.
- Test password login for the existing merchant through the production URL and verify the account-kind request succeeds with the same token issuer.
- Test signup subdomain availability for one free slug and one existing slug.
- Verify root, wildcard merchant subdomain, owner routes, and required server functions remain on the production-only Worker.
- Recheck Cloudflare after a subsequent normal project build; public domains must remain on the verified production service and must not change versions.

## Technical scope

Expected code/config changes: one Supabase migration, guarded deployment configuration/script, obsolete origin-forwarding code, and Cloudflare setup documentation. Cloudflare custom-domain and stale DNS changes will be applied through the API. No merchant/customer data, billing logic, or tenant-isolation policy will be changed.
