## Goal
Standardize the platform root domain on **`orzen.com`** everywhere subdomains are generated, displayed, verified, or stored. Remove every reference to `orzen.top`.

## Changes

1. **`src/routes/auth.tsx`** — In `rootDomain` memo, drop the SSR fallback `"orzen.top"` and hard-code `"orzen.com"` as the canonical fallback. This is what powers the live `<slug>.orzen.com` preview beside the subdomain input during registration (already shown, already updates as the user types).

2. **`src/routes/_authenticated/admin/domains.tsx`** (line 67) — Replace `const rootDomain = "orzen.top"` with `"orzen.com"` so the store admin sees `https://<slug>.orzen.com` as its subdomain URL.

3. **`src/routes/_authenticated/owner/domains.tsx`** — Update the four defaults / placeholders:
   - `root_domain` default → `orzen.com`
   - `login_host` default → `admin.orzen.com`
   - `dns_target` default → `stores.orzen.com`
   - Matching `placeholder=` values

4. **`src/lib/domains.functions.ts`** (line 65) — Fallback `dnsTarget` becomes `stores.orzen.com`.

5. **`src/routes/index.tsx`** — Already uses `app.orzen.com` (correct); leave as-is. Verify no `orzen.top` remains.

6. **Platform settings row (DB)** — After code lands, run a one-line data update to fix any stored `platform_settings` rows that already contain `orzen.top` values (`root_domain`, `login_host`, `dns_target`). Existing UI immediately re-reads and re-renders once updated. No schema/migration required — `platform_settings` already exists.

## Persistence & correctness
- Signup path already stores the raw slug in `stores.slug`; the full URL `https://<slug>.orzen.com` is derived at read-time from `root_domain` in platform settings + the slug, so no schema change is required and no domain string needs to be duplicated.
- The `store_domains.hostname` row that represents each store's subdomain is inserted by `createMyStoreWithSlug` (existing) — that hostname is composed from `root_domain`, so once the platform setting is `orzen.com` new signups store `<slug>.orzen.com` correctly.
- Existing stores keep working: `resolve_domain(host)` already looks up by exact hostname; the DB update above rewrites those rows.

## Out of scope
- Wildcard DNS / SSL provisioning at the registrar (infra, not app code).
- Retroactively rewriting existing `stores` or historical `store_domains` for legacy accounts is a one-off data task; noted but not part of this change.

## Verification
- Sign-up page renders `<slug>.orzen.com` as the live preview.
- Store admin → Domains shows `https://<slug>.orzen.com` as the subdomain URL.
- Owner → Domains loads with `orzen.com` / `admin.orzen.com` / `stores.orzen.com` defaults.
- `rg "orzen\.top" .` returns no matches.