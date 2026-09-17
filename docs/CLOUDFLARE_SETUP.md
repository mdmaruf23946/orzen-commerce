# Deploy the ORZEN Cloudflare Worker safely

The live `orzen.top` site is served only by the Cloudflare Worker named
`orzen-commerce-production`. The workspace's automatic publisher may update
`orzen-commerce`, but that preview service must never have an `orzen.top`
custom domain. The live service uses the separate production database.
Lovable Cloud is development/test/backup only.

Never use Lovable Publish for `orzen.top`: its build-time defaults point at the
development database. A mixed deployment lets the browser sign in against one
database while the server validates that token against another, producing
`Unauthorized: Invalid token`.

## Production deployment

Run only:

```bash
bun run deploy:production
```

The guarded command fetches the current production publishable key, builds the
client with the pinned production project identity, rejects any bundle that
contains the development project identity, uploads a non-live Worker version,
checks its preview, deploys that exact version, then verifies `orzen.top` again.
It never prints credentials.

Required project secrets: `PROD_SUPABASE_ACCESS_TOKEN`, `CF_API_TOKEN`, and
`CF_ACCOUNT_ID`. Runtime Worker secrets remain managed on the Worker.

The expected non-secret production project identity is deliberately pinned in
`scripts/deploy-production.sh` and `src/lib/deployment-target.ts`. Changing the
production database requires an explicit change to both files and a reviewed
deployment.

The production command also synchronizes the Worker's server database values
from the same verified source used for the browser build. It then checks
`/api/public/deployment-health`, so a browser/server mismatch cannot pass.

Do not use Cloudflare dashboard uploads, Git-based Pages deployment, or Lovable
Publish for `orzen.top`. They bypass these checks and can restore development
database values. Keep root and wildcard custom domains attached exclusively to
`orzen-commerce-production`; `orzen-commerce` is an unattached preview target.

## Runtime requirements

> **This app is server-rendered.** Checkout, orders, admin, webhooks, cron, the
> AI agent and the Messenger integration all run as server code. The build
> still produces one plain `dist` folder, but that folder also contains a
> `_worker.js` that runs the backend. Deep links and hard refreshes are served
> by that worker — no `_redirects` file is needed, and adding one would shadow
> the API routes.

---

The Worker requires these runtime values. The guarded command sets the database
values itself and preserves the remaining project secrets:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | the target environment's database URL |
| `VITE_SUPABASE_PROJECT_ID` | the same target environment's project ID |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the same target environment's publishable key |
| `SUPABASE_URL` | same as `VITE_SUPABASE_URL` |
| `SUPABASE_PUBLISHABLE_KEY` | same as `VITE_SUPABASE_PUBLISHABLE_KEY` |

Optional, also as a plain variable:

| Variable | Value |
|---|---|
| `PUBLIC_SITE_ORIGIN` | `https://orzen.top` (origin used for Messenger image/product links) |

And these as **secrets** (never commit them):

| Secret | Purpose |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | **required** — admin panel, Winner Admin, all agent reads/writes |
| `CREDENTIALS_ENCRYPTION_KEY` | **required** — decrypts saved WhatsApp/Messenger/payment credentials |
| `LOVABLE_API_KEY` | **required** — AI Gateway only (AI agents, product builder); it is not an auth or database key |

> Without these three, the site still renders, but every Agent connection
> (Messenger, WhatsApp, Winner Admin) fails with a server error on this host
> while continuing to work on the Lovable URL. `CREDENTIALS_ENCRYPTION_KEY`
> must be the **same value** as on the Lovable deployment, or already-saved
> Page tokens cannot be decrypted.
>
> Secrets are read per request from the worker binding as well as
> `process.env`, so no compatibility-flag tweak is needed for them to be
> picked up. Owner → AI Admin Control shows a **Deployment health** panel that
> reports, for the host you are on, whether database access, credential
> decryption and the AI key are available (names only, never values).

`SUPABASE_SERVICE_ROLE_KEY` is **not required for images**. The `/api/img`
proxy now reads store media with the publishable key, backed by a storage rule
that exposes image files only — paid digital files, invoices and return
evidence stay private. Features that genuinely need admin access (some
webhooks and maintenance jobs) still use the key when it is present.

The `VITE_*` values are read at build time and must exist before the build
runs. The unprefixed ones are read per request by the worker. Nothing is
hardcoded in the repository, so a rebuild always picks up whatever the Pages
project provides.

The compatibility flag is `nodejs_compat`. Never retry an old dashboard build;
run the guarded command to create a fresh verified version.

## 4b. If images do not load on the live domain

Symptom: pages render but every image is broken, and
`https://<your-domain>/api/img/<some-path>.png` returns **500**.

Checklist, in order:

1. `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` exist in the Pages project
   (Production **and** Preview) — the proxy needs them at request time.
2. Compatibility flag `nodejs_compat` is set with a compatibility date of
   `2025-04-01` or later, so `process.env` is populated inside the worker.
3. Redeploy after adding variables.
4. Zone → **SSL/TLS** mode **Full (strict)**, **Always Use HTTPS** on,
   **Automatic HTTPS Rewrites** on (removes any mixed-content blocking).
5. Speed → **Optimization**: keep **Polish** and **Mirage** off while
   testing — they rewrite image responses.
6. Rules → make sure no Cache Rule / Page Rule bypasses, caches, or redirects
   `/api/*`. The image proxy must reach the worker.
7. Test directly: `curl -I https://<your-domain>/api/img/<path>.png` should
   return `200` with `content-type: image/...`.


## Required for merchant stores (subdomains + custom domains)

The application code is complete, but two Cloudflare-side pieces must exist or
merchant domains will never work:

1. **Wildcard for store subdomains.** Every store advertises
   `<slug>.orzen.top`. Add `*.orzen.top` as a **custom hostname on the Pages
   project** (Custom domains → Set up a domain → `*.orzen.top`). Cloudflare
   manages the record itself — do **not** hand-create a wildcard DNS record in
   the zone, which is what previously produced locked, uneditable records.
   Without this, every subdomain link handed to merchants fails to resolve.
2. **SSL for SaaS for custom domains.** Enable Custom Hostnames with fallback
   origin `stores.orzen.top`, create the proxied `CNAME stores → orzen.top`
   record, and add `CF_API_TOKEN`, `CF_ZONE_ID`, `CF_ACCOUNT_ID` as secrets
   (see the section below). Without the token the merchant flow still verifies
   DNS and shows "Verified (DNS OK)", but nothing issues a certificate, so the
   domain shows a TLS warning in the browser and never becomes Active.

Owner → **Domains & Routing** shows a live "Platform routing health" panel with
exactly these checks (root, wildcard, fallback origin, automatic SSL), so the
platform owner can confirm the setup instead of guessing.

Reserved subdomains (`www`, `admin`, `stores`, `api`, `auth`, …) always render
the platform site and can never be claimed by a store.



## Updating later

Code changes do not automatically update `orzen.top`. Run
`bun run deploy:production`; source control and Lovable preview remain separate
from the production-only Worker. User data is unaffected by a deployment.

---

# Optional, later: customer custom domains (SSL for SaaS)

Skip this until the main site is live and stable. It only powers the
**Admin → Domains** feature, where merchants attach their own domains.

## Requirements

- `orzen.top` as a full zone on Cloudflare
- SSL/TLS → **Custom Hostnames**, fallback origin `stores.orzen.top`
- A proxied `CNAME stores → orzen.top` record (fallback origin only — still no
  wildcard record)

## API token

**My Profile → API Tokens → Create Token → Custom token**

| Permission | Scope |
|---|---|
| Zone → SSL and Certificates → Edit | `orzen.top` |
| Zone → Zone → Read | `orzen.top` |

Add `CF_API_TOKEN`, `CF_ZONE_ID` and `CF_ACCOUNT_ID` as secrets in the Pages
project.

## How it works

When a merchant enters `shop.merchant.com` in **Admin → Domains**,
`provisionCustomHostname` (`src/lib/cloudflare-domains.functions.ts`):

1. Validates the hostname
2. Calls Cloudflare `POST /zones/{zone}/custom_hostnames` with HTTP-01 DCV
3. Stores `cf_hostname_id`, `cf_status`, `cf_ssl_status`, `cf_ownership`,
   `cf_ssl_validation` on the `store_domains` row
4. Returns the DNS instructions: `CNAME shop.merchant.com → stores.orzen.top`

`syncCustomHostname` polls Cloudflare until the hostname and its certificate go
active, then flips `store_domains.status → active`.

| Function | Purpose |
|---|---|
| `provisionCustomHostname({ hostname })` | Create CF hostname + local row |
| `syncCustomHostname({ domainId })` | Poll CF, mirror status |
| `revalidateCustomHostnameFn({ domainId })` | Re-run DCV after a DNS fix |
| `releaseCustomHostname({ domainId })` | Detach from CF + delete row |

The DNS-only flow in `src/lib/domains.functions.ts` still works without any
Cloudflare API credentials.

---

## Independent production runtime

The production-only Worker must hold its own `SUPABASE_SERVICE_ROLE_KEY`,
`CREDENTIALS_ENCRYPTION_KEY`, and `LOVABLE_API_KEY`. Server requests are never
forwarded to a Lovable deployment. This keeps authentication, tenant checks,
webhooks, and AI work on the same verified production runtime.

Verify from the custom domain: Winner Admin → AI Admin Control → Overview →
**Deployment health** shows all required production capabilities as available.
rows for database, credential decryption and the AI key.
