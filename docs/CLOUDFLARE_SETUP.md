# Deploy the ORZEN Cloudflare Worker safely

The live `orzen.top` site is served by the Cloudflare Worker named
`orzen-commerce`. It uses the separate production database. Lovable Cloud is
development/test/backup only.

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

The historical Cloudflare Pages instructions below are retained only as legacy
reference. They are not the live ORZEN deployment procedure.

---

# Legacy Cloudflare Pages reference

> **This app is server-rendered.** Checkout, orders, admin, webhooks, cron, the
> AI agent and the Messenger integration all run as server code. The build
> still produces one plain `dist` folder, but that folder also contains a
> `_worker.js` that runs the backend. Deep links and hard refreshes are served
> by that worker — no `_redirects` file is needed, and adding one would shadow
> the API routes.

---

## 1. Connect the repository

Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** →
pick the repository and branch.

## 2. Build settings

| Setting | Value |
|---|---|
| Framework preset | **None** |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | *(leave empty)* |

`npm run build` detects the Cloudflare build runner (`CF_PAGES=1`) and packages
the output automatically:

```
dist/
  _worker.js      SSR + server functions, bundled into a single file
  _routes.json    static assets from the CDN, everything else through the worker
  _headers        immutable caching for hashed assets
  assets/...      hashed JS/CSS/images, robots.txt, favicon, other public files
```

On any other builder the command leaves the normal `dist/client` +
`dist/server` output untouched. To reproduce the Pages folder locally, run
`npm run build:dist` (or `bun run build:dist`).

## 3. Runtime settings

Project → **Settings → Runtime**:

- Compatibility date: `2025-09-01` or later
- Compatibility flag: `nodejs_compat`

## 4. Environment variables

Project → **Settings → Variables and Secrets**. Add these to **both**
Production and Preview, as plain variables:

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
| `LOVABLE_API_KEY` | **required** — AI Gateway (AI agents, product builder) |

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

> Changing a variable does **not** rebuild by itself — trigger a new
> deployment (Deployments → Retry/redeploy) afterwards.

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


## 5. Deploy and test

Save & Deploy. When it finishes, open the `*.pages.dev` URL and check: home
page, login/registration, a store page, a product page (refresh it — no 404),
cart, checkout, and the admin panel. Unknown hosts (including `pages.dev`)
render the main platform site, so nothing depends on a domain being attached.

## 6. Attach the domain — only after step 5 passes

Project → **Custom domains → Set up a domain** → `orzen.top`, then repeat for
`www.orzen.top`. Cloudflare creates and manages the DNS records itself.

## 6b. Required for merchant stores (subdomains + custom domains)

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



## 7. Updating later

Push to the connected branch. Cloudflare rebuilds and deploys automatically;
every push to another branch gets its own preview URL. User data is unaffected
by a redeploy.

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

## Secure internal forwarding (no secrets on Cloudflare)

The Cloudflare deployment does not need the private server keys
(`SUPABASE_SERVICE_ROLE_KEY`, `CREDENTIALS_ENCRYPTION_KEY`, `LOVABLE_API_KEY`).

When those keys are not present, the worker forwards server-only requests
(`/api/*`, `/_serverFn*`, `/_server*`, `/lovable/*`) server-to-server to the
Lovable deployment, which already holds them. The browser sees no redirect and
no second domain; cookies, sessions and status codes pass through unchanged.

- Upstream default: `https://orzen-commerce.lovable.app`
- Override with the optional variable `LOVABLE_UPSTREAM_ORIGIN`
- A loop guard header (`x-orzen-forwarded`) prevents double forwarding
- If the keys *are* present on Cloudflare, nothing is forwarded

Verify from the custom domain: Winner Admin → AI Admin Control → Overview →
**Deployment health** shows "Secure internal forwarding is active" plus green
rows for database, credential decryption and the AI key.
