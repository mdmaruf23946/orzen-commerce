# Multi-Tenant Domain System — production hardening

Goal: any store reachable at `myshop.orzen.top` **and** at its own domain
`mystore.com`, with clean root URLs, working verification, automatic SSL where
possible, and correct canonical/asset links on every host.

## What already exists

- `store_domains` table (hostname, kind, status, verification token, DNS target,
  SSL status, primary flag, Cloudflare mirror columns) and a `resolve_domain`
  database function.
- A Domains page in the store admin: add custom domain, DNS instruction card,
  "Check now", make primary, remove.
- Host resolution used by the landing page, and Cloudflare SSL-for-SaaS server
  code that is written but **not connected to any UI**.

## Problems this plan fixes

1. **Verification cannot work in production.** The checks use Node's `dns`
   module, which does not exist in the Cloudflare Workers runtime — every
   "Check now" on the live site fails regardless of correct DNS.
2. **Custom domains show `/store/<slug>` in the URL.** Only `/` is handled;
   deep links, product pages, cart and checkout keep the slug visible.
3. **Subdomain is read-only** on the Domains page.
4. **Hardcoded `orzen.top`** in canonical tags, the www redirect and several
   link builders, so custom-domain pages advertise the wrong URL.
5. **Cloudflare automatic SSL is unreachable** from the UI.

## Plan

### 1. DNS + verification that runs on Workers

- Replace Node `dns` with DNS-over-HTTPS (`https://cloudflare-dns.com/dns-query`,
  JSON) in a new `src/lib/dns-lookup.server.ts` — TXT, CNAME and A lookups.
- Rewrite `checkDomainVerification` and `checkDnsResolution` on top of it.
- Add an HTTP challenge fallback: a public route
  `/.well-known/orzen-domain-verification/$token` that answers with the
  domain's token, so a domain can verify even when TXT is impossible.
- Store the last failure text so the UI can show *why* it failed.

### 2. Clean root URLs on tenant hosts

- Add host→slug resolution in the worker entry (`src/server.ts`) with a short
  in-memory cache, and **internally rewrite** tenant requests: `mystore.com/`
  → store home, `mystore.com/product/abc` → that product. The shopper never
  sees `/store/<slug>`.
- Never rewrite `/api/*`, `/admin/*`, `/auth`, `/_serverFn/*`, assets,
  `sitemap.xml`, `robots.txt`, or the verification path.
- Platform hosts, `*.pages.dev`, `*.workers.dev`, preview and localhost keep
  the current behaviour (landing page).
- `www.<tenant>` and non-primary verified domains 301 to the store's primary
  domain; the platform www redirect becomes root-domain-driven instead of a
  hardcoded `orzen.top`.

### 3. Domains page rebuild (store admin)

- **Subdomain card**: editable slug with live availability check
  (format rules, reserved words, existing-store check), preview of the final
  URL, and a redirect from the old subdomain after a change.
- **Custom domains card**: add domain, per-domain status pill
  (Pending / Verifying / Verified / SSL issuing / Active / Failed) that
  auto-refreshes while a domain is not active.
- **Exact DNS instructions** per domain, each copyable: CNAME → platform
  target (plus the A-record alternative for apex domains), ownership TXT, and
  Cloudflare DCV records when the automatic path is used. Shows the values
  actually returned, not placeholders.
- **Primary domain** selector (subdomain or any active custom domain), used for
  canonical URLs and outbound links.
- Failure reason and last-checked time surfaced inline.
- Fully responsive down to 320px; custom domains stay plan-gated.

### 4. Automatic SSL when available, manual otherwise

- Wire the existing Cloudflare SSL-for-SaaS functions into the add/verify flow:
  when a Cloudflare API token and zone are configured, adding a domain also
  registers the custom hostname and shows Cloudflare's own validation records;
  status syncs from Cloudflare.
- With no token configured, the flow falls back to our own TXT/CNAME
  verification and marks SSL as externally managed — nothing breaks, the UI
  just shows the manual instructions.
- Owner panel keeps a platform-wide list and can force-sync or activate.

### 5. Correct URLs, CORS and headers on every host

- One helper for "the origin to use right now": active request host in a
  request, otherwise the store's primary domain, otherwise the subdomain.
- Use it for canonical tags, Open Graph URLs, sitemap/robots, order and
  invoice links, email links, and Messenger product links, replacing the
  hardcoded `orzen.top` values.
- Storefront asset links keep going through the same-origin `/api/img` proxy,
  so images work on every custom domain with no cross-origin request at all;
  the proxy keeps its permissive CORS headers for crawlers.
- Add baseline security headers on HTML responses (nosniff, referrer policy,
  frame options) applied uniformly across tenant hosts.

### 6. Database

Small migration on `store_domains`:

- unique index on `lower(hostname)` (prevents two stores claiming a domain),
- `last_error text`, `verification_method text` (`dns` | `http` | `cloudflare`),
- update `resolve_domain` to also return the primary hostname of the store so
  the redirect-to-primary logic needs one lookup.

No data is deleted; existing domains keep working.

## Technical notes

- DoH is used because `node:dns` is a non-functional stub on workerd; this is
  the actual reason live verification fails today.
- The rewrite happens in the worker fetch handler before TanStack routing, so
  route files stay unchanged and no route duplication is needed.
- Host→slug lookups use the publishable Supabase key with a 60s cache, so a
  cold custom domain adds one lightweight query per minute per edge location.

## What you will need to do after this ships

1. In Cloudflare, keep `orzen.top` and `*.orzen.top` (via SSL for SaaS or a
   wildcard custom domain) pointing to the Pages project.
2. Optional, for automatic merchant SSL: add `CF_API_TOKEN` and the zone ID as
   secrets in the Pages project — the UI switches to automatic mode on its own.
3. Merchants add the CNAME/TXT records the Domains page shows them.
