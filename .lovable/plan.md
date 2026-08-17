# Domain system audit — what works, what will break, and the fixes

I checked the live database, the domain server functions, the Worker host
resolver, and the admin Domains page. The core plumbing is sound (verification
works on Workers via DNS-over-HTTPS, host→store lookup is granted to anonymous
callers, hostnames are unique). But there are real problems that will hit store
admins the moment they connect a domain.

## Confirmed problems

**1. Platform hosts are treated as stores.**
Platform settings store `login_host = admin.orzen.top` and
`dns_target = stores.orzen.top`. The Worker's host resolver only knows
`orzen.top` / `www.orzen.top`, so a request to `admin.orzen.top` is rewritten to
the storefront of a store named "admin", and `stores.orzen.top` (the
SSL-for-SaaS fallback origin) becomes store "stores". Reserved subdomain names
are enforced when a merchant picks a slug, but not at routing time.

**2. Store customers cannot log in on a subdomain or custom domain.**
The rewrite skips `/auth`, `/login`, `/signup` (correct for the platform), but
the storefront's own customer pages live at `/store/<slug>/auth/login`,
`/auth/signup`, `/auth/forgot`. On `mystore.com/auth/login` the shopper lands on
the *platform* merchant login instead of the store's customer login. Same for
`/sitemap.xml` and `/robots.txt`, which never reach the store-specific versions.

**3. A subdomain only resolves if `*.orzen.top` exists in Cloudflare.**
The deployment doc explicitly says never to add a wildcard record, and no
wildcard is configured. So every `mystore.orzen.top` — the free address shown to
every merchant in the admin UI as "always reachable" — currently fails to
resolve. The application code is correct; the DNS/Cloudflare side is not set up.

**4. Custom domains can never reach "Active" today.**
`CF_API_TOKEN` and `CF_ZONE_ID` are not configured, so automatic SSL is off. In
manual mode a domain stops at "Verified" with `ssl_status = external`; nothing
issues the certificate and nothing flips it to Active, because Cloudflare has no
custom hostname for it. Merchants will see a verified domain that shows an SSL
error in the browser.

**5. Non-primary domains do not redirect to the primary.**
`resolve_domain` already returns `primary_hostname`, but the Worker ignores it,
so a store stays reachable on several hosts at once (duplicate content, split
sessions, wrong canonical URLs).

**6. Smaller issues.**
- Status pills have no label for `verified` vs SSL "issuing", so a merchant sees
  "Verified" and assumes it is live.
- No auto-refresh while a domain is pending; the merchant must keep clicking
  "Check now" (which is rate-limited to one call per 15s and shows an error
  toast for the rate limit).
- Removing a custom domain that is the current primary clears `primary_domain_id`
  but the merchant is not told the store fell back to the subdomain.

## Fix plan

### A. Routing correctness (Worker + host resolver)
- Load reserved/platform hostnames into the resolver: root domain, `www`,
  `login_host`, `dns_target`, and the reserved subdomain list, so those hosts
  always render the platform site and are never rewritten.
- Allow storefront paths that are currently blocked when the host is a tenant:
  rewrite `/auth/*`, `/sitemap.xml`, `/robots.txt` into `/store/<slug>/...`.
  Keep them untouched on platform hosts.
- Use `primary_hostname` from `resolve_domain`: when a request arrives on a
  verified non-primary host, 301 to the primary host with path and query kept.
- Keep the existing 60s cache and the "any failure falls back to the platform
  site" behaviour so a database hiccup can never take the site down.

### B. Honest domain status in the admin UI
- Distinguish DNS-verified from live: statuses become
  Pending DNS → Verified (DNS OK) → Issuing SSL → Active, with an explicit
  "waiting for certificate" note and what the merchant should expect.
- Poll status automatically every 20s while a domain is not Active, and disable
  "Check now" during the cooldown instead of raising an error toast.
- Only allow "Make primary" for domains that are actually Active when automatic
  SSL is on; explain why the button is disabled otherwise.
- On removing the primary domain, state clearly that the store falls back to its
  subdomain.
- Show the subdomain card with a warning when the platform wildcard is not
  configured, so nobody hands out a URL that does not resolve.

### C. Cloudflare setup, made explicit
- Add an owner-side status panel (Owner → Domains) showing whether
  `CF_API_TOKEN` / `CF_ZONE_ID` are present, whether the wildcard resolves, and
  whether the fallback origin resolves — using the existing DNS diagnostics
  function, so the platform owner sees the real state instead of guessing.
- Update `docs/CLOUDFLARE_SETUP.md` with the two things that are actually
  required for merchant domains to work end to end:
  1. a wildcard custom hostname / `*.orzen.top` entry for store subdomains,
  2. SSL for SaaS with fallback origin `stores.orzen.top` plus the API token,
  and note exactly what breaks when each is missing.

### D. No database changes
Schema, RLS and the resolver functions are already correct: hostname uniqueness,
owner-scoped policies, and anonymous EXECUTE on `resolve_domain`,
`is_slug_taken` and `domain_token_exists` are all in place. Nothing to migrate.

## What you will still need to do in Cloudflare

1. Add `*.orzen.top` (wildcard custom hostname) to the Pages project — without
   it no store subdomain resolves.
2. Enable SSL for SaaS with fallback origin `stores.orzen.top` and add
   `CF_API_TOKEN` + `CF_ZONE_ID` as secrets — without them merchant domains
   verify but never get a certificate.

Once both exist, the admin flow works unattended: merchant adds a domain, copies
the shown records, and the page flips to Active by itself.
