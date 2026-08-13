# Manual deploy to Cloudflare Workers

This project deploys **manually** — you upload the code yourself when you are
ready. There is no GitHub auto-deploy, no webhook, and nothing goes live
because of an in-progress edit in Lovable.

The database, auth, storage and secrets stay in **Lovable Cloud**. Changing or
recreating the Cloudflare account does not touch user accounts, products or
orders — those live in the database, not in the hosting account.

> This app is server-rendered (TanStack Start). It cannot be deployed by
> drag-and-dropping a `dist` folder into Cloudflare Pages. The equivalent
> manual flow is `wrangler deploy`, which uploads straight from your computer
> and needs no GitHub connection.

---

## 1. Get the code

1. Open the GitHub repository → **Code → Download ZIP**.
2. Unzip it on your computer.
3. Open a terminal in that folder.

## 2. Install and log in to the new Cloudflare account

```bash
npm install          # or: bun install
npx wrangler login   # log in to the NEW Cloudflare account
```

## 3. Push the runtime secrets (once per account)

```bash
export SUPABASE_SERVICE_ROLE_KEY=...   # Lovable Cloud service role key
export LOVABLE_API_KEY=...             # Lovable AI Gateway key

bash scripts/cf-push-secrets.sh
```

The Supabase URL and publishable key are already in `wrangler.toml` under
`[vars]`, so the Worker connects to the existing database automatically.

## 4. Deploy

```bash
bash scripts/deploy-cloudflare.sh
```

or, equivalently:

```bash
NITRO_PRESET=cloudflare_module npm run build
npx wrangler deploy
```

Wrangler prints a free URL such as:

```
https://orzen-commerce-3ea3838d.<your-subdomain>.workers.dev
```

## 5. Test on the free URL first

Open the `workers.dev` URL and check: home page, login/registration, a store
page, a product page, cart and checkout, and the admin panel. Unknown hosts
(including `workers.dev`) always render the main platform site, so nothing
depends on a domain being attached.

## 6. Attach the domain — only after step 5 passes

1. Add `orzen.top` to the Cloudflare account (**Websites → Add a site**) and set
   the registrar's nameservers to the two Cloudflare gives you.
2. Cloudflare dashboard → **Workers & Pages → this Worker → Settings →
   Domains & Routes → Add** → `orzen.top`.
3. Repeat for `www.orzen.top`.

Cloudflare creates and manages the DNS records for those two hostnames itself.

**Never add a wildcard route** (`*.orzen.top/*`) or a manual `A`/`CNAME` record
for `*`. That is what produced the locked, uneditable DNS records and the host
errors. `wrangler.toml` intentionally ships with no routes at all; a
commented-out apex + www block is in the file if you prefer to declare them
there instead of in the dashboard.

## 7. Updating later

Finish your changes in Lovable, download the ZIP again, then re-run:

```bash
bash scripts/deploy-cloudflare.sh
```

Nothing goes live until you run that command. User accounts and data are
unaffected by a redeploy; users may just need to sign in again once.

## 8. Optional: a second backup deployment

You can deploy the exact same code to a second Cloudflare account/Worker. Both
read the same `[vars]`, so they share one database — a user who registers on
one can sign in on the other and see everything. Keep the tested version on the
primary and try new builds on the backup first.

---

# Optional, later: customer custom domains (SSL for SaaS)

Skip this entirely until the main site is live and stable. It only powers the
**Admin → Domains** feature, where merchants attach their own domains.

## Requirements

- Workers Paid plan, `orzen.top` as a full zone on Cloudflare
- SSL/TLS → **Custom Hostnames**, fallback origin `stores.orzen.top`
- A proxied `CNAME stores → orzen.top` record (fallback origin only — still no
  wildcard record)

## API token

**My Profile → API Tokens → Create Token → Custom token**

| Permission | Scope |
|---|---|
| Zone → SSL and Certificates → Edit | `orzen.top` |
| Zone → Zone → Read | `orzen.top` |
| Account → Workers Scripts → Edit | your account |

Then export `CF_API_TOKEN`, `CF_ZONE_ID`, `CF_ACCOUNT_ID` and re-run
`scripts/cf-push-secrets.sh` (it pushes them only when they are set).

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

## Costs

| Item | Cost |
|---|---|
| Workers Paid | $5 / mo (10M requests) |
| SSL for SaaS | first 100 hostnames free, then $0.10 / hostname / mo |
| Lovable Cloud (backend) | unchanged |
