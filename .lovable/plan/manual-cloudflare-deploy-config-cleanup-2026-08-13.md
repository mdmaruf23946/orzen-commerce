# Manual Cloudflare Deploy — Config Cleanup

Goal: make the repo deployable by hand (download ZIP → `wrangler deploy`) into a brand-new Cloudflare account, with no domain wired up yet, and no wildcard routes that can break the site.

## One important correction

The request asks for "SPA mode with React Router". This app is **not** a static SPA — it is a TanStack Start server-rendered app. Storefronts, product pages, checkout, admin, webhooks, cron, AI agent, and the Messenger integration all run through server functions and API routes. Converting it to a client-only SPA would delete the entire backend surface.

So the correct target is: **Cloudflare Workers, manual deploy, no wildcard routes, no attached domain until you're ready.** Everything else in the request is applied as written. Cloudflare Pages "drag and drop the dist folder" is not usable for this app; the Worker deploy via Wrangler is the equivalent manual flow, and it needs no GitHub connection.

## What changes

### 1. `wrangler.toml` — strip all domain routing
- Remove the `orzen.top` and `www.orzen.top` custom-domain entries.
- Remove the `*.orzen.top/*` wildcard zone route (this is the record that kept re-creating the locked DNS entry).
- Enable `workers_dev = true` so the free `orzen-commerce-*.workers.dev` URL serves the site immediately after upload.
- Keep the `main`, `[assets]`, `nodejs_compat`, `[vars]` (Supabase URL + publishable key) and observability blocks unchanged, so the new account connects to the existing database with zero setup.
- Add a commented-out routes block with instructions, so re-attaching `orzen.top` later is one uncomment away.

### 2. Multi-tenant host resolution stays safe without wildcards
The store resolver reads the request host to pick a store. With no wildcard route attached, it must fall back cleanly on `*.workers.dev` and on the apex instead of erroring. Verify and, if needed, harden the host-parsing path so an unknown host renders the main site rather than crashing (this is the likely cause of the "host error" crashes).

### 3. Deploy scripts and docs
- `scripts/deploy-cloudflare.sh`: keep the build + `wrangler deploy`, drop the assumption that domains are pre-attached, and print the resulting `workers.dev` URL.
- `scripts/cf-push-secrets.sh`: make `CF_API_TOKEN`/`CF_ZONE_ID`/`CF_ACCOUNT_ID` optional (they're only needed for the customer-custom-domain feature), so a first deploy needs only `SUPABASE_SERVICE_ROLE_KEY` and `LOVABLE_API_KEY`.
- `docs/CLOUDFLARE_SETUP.md`: rewrite the front half as a **manual deploy to a fresh account** guide — download ZIP, `npx wrangler login`, `npx wrangler deploy`, test on `workers.dev`, then attach the domain later. Keep the SSL-for-SaaS section as a clearly-marked "later, optional" chapter.

### 4. Supabase stays untouched
No schema, auth, or key changes. Existing user accounts, orders, and products keep working because they live in the database, not in the hosting account. Both a primary and a backup Cloudflare deployment can point at the same database using the same `[vars]`.

## Technical notes
- Files touched: `wrangler.toml`, `scripts/deploy-cloudflare.sh`, `scripts/cf-push-secrets.sh`, `docs/CLOUDFLARE_SETUP.md`, plus the host-resolution guard if the check shows one is missing.
- `vite.config.ts` keeps `NITRO_PRESET=cloudflare_module` — that preset is what produces the `.output/server/index.mjs` + `.output/public` shape Wrangler uploads. No change needed.
- Nothing in the app code, routes, or database is modified.

## After this lands
1. Download the repo ZIP.
2. `npm i` then `npx wrangler login` in the new account.
3. `npx wrangler deploy` — site goes live on `*.workers.dev`.
4. Test fully; only then add `orzen.top` from the Worker's Domains tab.
