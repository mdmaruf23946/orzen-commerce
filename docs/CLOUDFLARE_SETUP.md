# Cloudflare Workers + SSL for SaaS — Setup Guide

This deploys the app to **Cloudflare Workers** (using the Nitro `cloudflare`
preset that Lovable already builds with), points a **wildcard DNS record**
at it for unlimited store subdomains, and uses **SSL for SaaS** to attach
unlimited **customer custom domains** with auto-issued TLS certificates —
all while keeping the database, auth, storage, edge functions, and secrets
inside **Lovable Cloud** (no migration).

---

## 1. Prerequisites

- Cloudflare account (Workers Paid plan — required for SSL for SaaS)
- `orzen.top` (or your apex) on Cloudflare as a full zone
- Local Bun + Wrangler (`bun add -g wrangler`)
- `wrangler login` once

---

## 2. Enable SSL for SaaS on the zone

1. Cloudflare dashboard → **orzen.top** → **SSL/TLS → Custom Hostnames**
2. Set the **Fallback Origin** to: `stores.orzen.top`
3. Create the fallback origin CNAME (see step 4)
4. Turn on **SSL for SaaS** (Workers Paid → $0.10/hostname/mo after the first 100)

---

## 3. Create the Cloudflare API token

Cloudflare dashboard → **My Profile → API Tokens → Create Token → Custom token**:

| Permission | Scope |
|---|---|
| Zone → SSL and Certificates → Edit | `orzen.top` |
| Zone → Zone → Read | `orzen.top` |
| Account → Workers Scripts → Edit | your account |

Copy the token — you'll paste it into `CF_API_TOKEN` in step 6.

Also grab from the dashboard:
- **Zone ID** → orzen.top → Overview (right sidebar) → `CF_ZONE_ID`
- **Account ID** → same sidebar → `CF_ACCOUNT_ID`

---

## 4. DNS records on orzen.top

Add these on your Cloudflare zone (all **Proxied — orange cloud**):

| Type  | Name            | Target                     | Purpose                       |
|-------|-----------------|----------------------------|-------------------------------|
| A/AAAA| `@`             | `192.0.2.1` (dummy)        | Apex — Worker route handles it|
| CNAME | `www`           | `orzen.top`                | Redirect / same Worker        |
| CNAME | `*`             | `orzen.top`                | **Wildcard store subdomains** |
| CNAME | `stores`        | `orzen.top`                | **SSL-for-SaaS fallback origin** — merchants CNAME to this |

> Cloudflare treats the Worker route (`orzen.top/*` + `*.orzen.top/*` in
> `wrangler.toml`) as the real origin, so the A/AAAA/CNAME targets are
> placeholders — the orange-cloud proxy short-circuits to the Worker.

Merchants add a **single CNAME** at their registrar:

```
shop.merchant.com  CNAME  stores.orzen.top
```

Cloudflare will then match `shop.merchant.com` against the Custom Hostnames
API entry we create in step 8 and route it to the Worker with a valid cert.

---

## 5. Vite / Nitro config

Nothing to change. `@lovable.dev/vite-tanstack-config` already targets
Nitro's `cloudflare` preset, which produces the exact shape
`.output/server/index.mjs` + `.output/public/` that `wrangler.toml`
consumes. `wrangler.toml` in the repo root wires it all together:

- `main = ".output/server/index.mjs"` — the SSR Worker
- `[assets] directory = ".output/public"` — served straight from the edge
- `[[routes]]` for `orzen.top/*` and `*.orzen.top/*`
- `nodejs_compat` flag so Supabase + our server fns run

---

## 6. Push runtime secrets to the Worker

Export them in your shell (once) and run the script:

```bash
export CF_API_TOKEN=...           # from step 3
export CF_ZONE_ID=...             # from step 3
export CF_ACCOUNT_ID=...          # from step 3
export SUPABASE_SERVICE_ROLE_KEY=...   # Lovable Cloud → Backend → API keys
export LOVABLE_API_KEY=...        # Lovable AI Gateway key

chmod +x scripts/*.sh
./scripts/cf-push-secrets.sh
```

Every secret is written with `wrangler secret put` — nothing is committed
to the repo. The publishable Supabase URL/anon key live in `wrangler.toml`
`[vars]` because they're safe to ship in the client bundle.

---

## 7. Deploy

```bash
./scripts/deploy-cloudflare.sh
```

That runs `bun run build` (Nitro → cloudflare preset) then
`wrangler deploy`. First deploy takes 30–60 s; subsequent deploys are
faster. The Worker immediately serves:

- `orzen.top` and `www.orzen.top` — marketing / login
- `<slug>.orzen.top` — every store subdomain (wildcard, no per-store config)
- every attached customer custom domain (see step 8)

---

## 8. Customer custom domains (SSL for SaaS)

The integration is already wired. When a merchant enters
`shop.merchant.com` in **Admin → Domains**, the UI calls
`provisionCustomHostname` (in `src/lib/cloudflare-domains.functions.ts`),
which:

1. Validates the hostname
2. Calls Cloudflare `POST /zones/{zone}/custom_hostnames` with HTTP-01 DCV
3. Stores `cf_hostname_id`, `cf_status`, `cf_ssl_status`, `cf_ownership`,
   `cf_ssl_validation` on the `store_domains` row
4. Returns the DNS instructions to show the merchant:
   - **CNAME** `shop.merchant.com → stores.orzen.top`
   - optional **TXT** ownership records if pre-validation is needed

The merchant adds the CNAME at their registrar. `syncCustomHostname`
polls Cloudflare until `status = active` and `ssl.status = active`, then
flips `store_domains.status → active` and TLS is live — usually within
1–2 minutes. No manual cert work, no per-domain deploy, no rate limits at
your scale.

Available server functions:

| Function | Purpose |
|---|---|
| `provisionCustomHostname({ hostname })` | Create CF hostname + local row |
| `syncCustomHostname({ domainId })`      | Poll CF, mirror status         |
| `revalidateCustomHostnameFn({ domainId })` | Re-run DCV after DNS fix    |
| `releaseCustomHostname({ domainId })`   | Detach from CF + delete row    |

The existing `addCustomDomain` / `checkDomainVerification` flow in
`src/lib/domains.functions.ts` still works for anyone who wants to run
DNS-only verification without CF (e.g. self-hosted regional deploys) —
the two paths coexist because they write to the same `store_domains`
table.

---

## 9. Database migration

Apply `supabase/migrations/20260715120000_cf_ssl_for_saas.sql` (Lovable
Cloud will pick it up automatically on next deploy). It adds five nullable
columns to `store_domains`:

```
cf_hostname_id     text
cf_status          text
cf_ssl_status      text
cf_ownership       jsonb
cf_ssl_validation  jsonb
```

Existing rows are unaffected.

---

## 10. Verifying it works

```bash
# Wildcard subdomain
curl -I https://any-random-slug.orzen.top
# → 200 with a valid cert (Cloudflare Universal SSL covers *.orzen.top)

# After provisioning shop.example.com:
dig +short shop.example.com CNAME       # → stores.orzen.top.
curl -I https://shop.example.com        # → 200 with cert issued for shop.example.com
```

Cloudflare Analytics → **SSL/TLS → Custom Hostnames** shows every attached
hostname with its live status.

---

## 11. Costs (rough)

| Item | Cost |
|---|---|
| Workers Paid | $5 / mo (includes 10M requests) |
| SSL for SaaS | First 100 hostnames free, then $0.10 / hostname / mo |
| DNS + Wildcard cert | included |
| Lovable Cloud (backend) | unchanged — you keep the current plan |

---

## 12. Rollback

If you want to revert to Lovable-hosted deploys, do nothing — Lovable
publishing is independent of Cloudflare. `wrangler.toml`, `docs/`, the
new `src/lib/cloudflare-*.ts` files, and the migration can stay in place
without side effects; the CF Worker simply won't be reached until DNS is
pointed at it.
