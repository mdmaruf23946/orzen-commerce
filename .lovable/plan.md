
# Domain Management System

Adds a full domain layer on top of the existing `stores.slug` subdomain.
Store admins manage their own subdomain and (plan-gated) custom domains.
The Winner Admin controls the root/login domain and wildcard/SSL policy.
Login always happens on a fixed system host, independent of any store domain.

## Concepts

- **System login host** — fixed (default `admin.orzen.top`), stored in
  `platform_settings.login_host`. `/auth` only serves 200 on this host;
  any other host visiting `/auth` is redirected to it. Owner-editable, not
  store-editable.
- **Store subdomain** — `stores.slug` on the platform root (e.g.
  `myshop.orzen.top`). Editable by store admin, uniqueness enforced by
  existing `is_slug_taken` RPC. Always exists, always covered by the
  wildcard cert.
- **Custom domain** — one or more user-owned hostnames (e.g. `shop.acme.com`)
  attached to a store, each with a verification lifecycle. Plan-gated.
- **Primary domain** — per store, either the subdomain or a verified+active
  custom domain. Used for canonical URLs, SEO, and outbound links (emails,
  invoices, share links). Non-primary hostnames 301 to the primary.

## Data model (single migration)

New table `public.store_domains`:
- `store_id uuid` → `stores(id)` on delete cascade
- `hostname text` unique, lowercase, no scheme/port
- `kind text` — `'subdomain' | 'custom'`
- `status text` — `'pending' | 'verified' | 'active' | 'failed'`
- `verification_token text` — random, used for TXT + HTTP challenge
- `verified_at timestamptz`, `last_checked_at timestamptz`
- `ssl_status text` — `'none' | 'issuing' | 'issued' | 'failed'`
- `is_primary bool` — exactly one true per store (partial unique index)
- standard `created_at / updated_at` + touch trigger

`stores` gains: `primary_domain_id uuid null` → `store_domains(id)`
(nullable = subdomain default). `platform_settings` gains:
`login_host text`, `root_domain text`, `wildcard_enabled bool`,
`custom_domains_enabled bool`, `ssl_provider text` (informational).

RLS:
- `store_domains`: store owner full CRUD on their rows (`is_store_owner`),
  owner role full access, `anon` gets narrow SELECT of
  `(hostname, store_id, status, is_primary)` via a SECURITY DEFINER RPC
  `resolve_domain(_host text)` — no direct anon table policy.
- `platform_settings`: owner-only writes; public GET via existing pattern
  for the small subset of fields already exposed (unchanged).

Grants: `authenticated` full CRUD on `store_domains`, `service_role` all,
`anon` execute on `resolve_domain` and `is_slug_taken` only.

## Verification flow

Server function `startDomainVerification({ storeId, hostname })`:
- validates hostname (RFC-1123, no wildcards, not the root/login host,
  not another store's domain), plan-checks via `assertPlan(..., 'custom_domain')`
  (new feature key), inserts `store_domains` row with `status='pending'` and
  a fresh `verification_token`.
- Returns the two DNS records the user must add:
  - `TXT _orzen-verify.<host>` = `<token>`
  - `CNAME <host>` → `stores.orzen.top` (platform apex CNAME target)

Server function `checkDomainVerification({ domainId })`:
- Server-side DNS lookup (Node `dns/promises`, available in Worker runtime)
  for TXT + CNAME. On success: `status='verified'`, `verified_at=now()`,
  kicks off `ssl_status='issuing'` (informational — actual cert issuance
  is handled by platform infra; UI just reflects state).
- Owner cron/server fn `sweepDomainStatuses()` re-checks pending/verified
  rows hourly and flips `verified→active` once `ssl_status='issued'` is
  set by the owner (manual flip for now; documented as the extension point
  for automated ACME).

Rate limiting: at most one check per domain per 30s (enforced by
`last_checked_at`).

## Plan gate

Add `custom_domain` to `FEATURE_KEYS` in `src/lib/features.ts` with label
"Custom Domain". Server functions that create custom domains call
`assertPlan(supabase, userId, 'custom_domain')`. The UI wraps the custom
domain panel in `<FeatureGate feature="custom_domain">`. Subdomain editing
is available on every plan.

## Primary domain selection

Server function `setPrimaryDomain({ domainId | null })`:
- `null` → primary is the subdomain (clears `stores.primary_domain_id`).
- Otherwise requires the domain to be `status='active'` and owned by the
  caller's store. Updates `stores.primary_domain_id`, flips `is_primary`
  atomically inside a transaction (single-row partial unique index).

## Request routing

New helper `src/lib/domain-router.ts` (used by `src/routes/__root.tsx` head
+ a lightweight server route middleware):
- Resolves the incoming host via `resolve_domain` RPC (cached in-memory per
  worker for 60s).
- If host is the login host → serve normally, allow `/auth`.
- If host matches a store domain →
  - non-primary → 301 to primary + same path
  - `/auth` → 302 to `https://<login_host>/auth?next=<original>`
- Unknown host → falls back to platform landing.

Canonical `<link rel="canonical">` and `og:url` in route `head()` are
derived from the store's primary domain, not `window.location`.

## Store admin UI

New route `src/routes/_authenticated/admin/domains.tsx`:
- **Subdomain card** — edit `stores.slug` with live availability
  (reuses `is_slug_taken`), shows full URL `https://<slug>.<root>`.
- **Custom domains card** (gated) — list existing rows with status pill
  (Pending / Verified / Active / Failed), "Add domain" dialog showing the
  two DNS records + copy buttons, "Check now" button per row, "Remove".
- **Primary domain card** — radio list: subdomain + each `active` custom
  domain. Saving calls `setPrimaryDomain`.
- Sidebar entry "Domains" under admin nav.

## Winner Admin UI

New route `src/routes/_authenticated/owner/domains.tsx`:
- Root domain, login host, wildcard toggle, custom domains master switch,
  SSL provider label, apex CNAME target — all persisted in
  `platform_settings`.
- Table of all `store_domains` across stores with status + last-checked,
  filter by status, force-recheck, force-activate (sets `ssl_status`),
  revoke.

## Server functions (new file `src/lib/domains.functions.ts`)

Store-scoped, all `.middleware([requireSupabaseAuth])`:
`listMyDomains`, `addCustomDomain`, `checkDomainVerification`,
`removeDomain`, `setPrimaryDomain`.

Owner-scoped, guarded with `has_role('owner')`:
`listAllDomains`, `forceRecheckDomain`, `setDomainSslStatus`,
`revokeDomain`, `getPlatformDomainSettings`, `updatePlatformDomainSettings`.

Public (no auth) helper via existing publishable-key server client:
`resolvePublicDomain({ host })` for SSR head/canonical.

## Files touched / added

- migration: `store_domains` table + grants + RLS + `resolve_domain` RPC +
  `stores.primary_domain_id` + `platform_settings` columns.
- `src/lib/features.ts` — add `custom_domain` key + label.
- `src/lib/domains.functions.ts` — new.
- `src/lib/domain-router.ts` — new, used by root route.
- `src/routes/__root.tsx` — canonical/og URL from primary domain, host-based
  `/auth` redirect wiring.
- `src/routes/_authenticated/admin/domains.tsx` — new store-admin page.
- `src/routes/_authenticated/admin/route.tsx` — add sidebar entry.
- `src/routes/_authenticated/owner/domains.tsx` — new owner page.
- `src/routes/_authenticated/owner/route.tsx` — add sidebar entry.
- `src/routes/auth.tsx` — reject render when host ≠ login host; redirect.
- `src/lib/store-ui.tsx` — use primary domain when building store URLs.

## Out of scope

- Automated ACME/Let's Encrypt issuance — `ssl_status` is a status field
  the platform flips; the UI and data are ready for automation later.
- Email DNS (MX/DKIM/DMARC) on custom domains.
- Multi-region domain routing.
