# Production-ready GitHub → Cloudflare Pages auto-build

Goal: connect the GitHub repo to Cloudflare Pages, hit Save & Deploy, and have every push build and go live with working deep links, no 404s on refresh, and no hardcoded keys.

## One correction before the details

This app cannot be a pure static SPA. Checkout, orders, admin, webhooks, cron, the AI agent and the Messenger integration all run as server code. A static-only `dist` with `_redirects` would ship a shell that cannot log in or take an order.

Cloudflare Pages handles this natively: the build still produces one `dist` folder you point Pages at, but that folder also carries a `_worker.js` which runs the backend. Deep links and refreshes are served by that worker, so no `_redirects` file is needed — and adding one would actually break the API routes. Everything else in the request is applied exactly as written.

## What changes

### 1. `npm run build` produces a clean, self-contained `dist/`
- Switch the default build preset to `cloudflare_pages` so the build emits the Pages layout directly.
- Set the build output directory to `dist/` so Cloudflare's default "Build output directory: dist" works with no extra configuration.
- Resulting folder: `_worker.js` (SSR + server functions), `_routes.json` (static assets straight from the CDN, everything else through the worker), `_headers` (immutable caching for hashed assets), `assets/…`, plus `robots.txt`/favicon and other public files.
- `build:dist` stays as an alias so the existing manual drag-and-drop flow keeps working; it no longer duplicates build logic.

### 2. Routing fallback
`_routes.json` sends every non-asset path — including deep links like `/store/foo/product/123` and hard refreshes — to the worker, which renders the correct page. No `_redirects`, no `index.html` fallback, no 404 on refresh.

### 3. Environment variables and backend decoupling
- Verified: the Supabase client already reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` with a server-side fallback, and no key is hardcoded in app code.
- Remove the committed `[vars]` blocks from `wrangler.toml` so nothing baked into the repo can shadow what Cloudflare provides.
- Document the exact variables to set in the Pages project (build-time + runtime): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and as secrets `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`.
- Guard the build so a missing variable at build time does not crash the Pages runner; values are read at request time.

### 4. Cleanup of conflicting configuration
- Delete `wrangler.toml` entirely, along with `scripts/deploy-cloudflare.sh`, `scripts/deploy-cloudflare-backup.sh` and `scripts/cf-push-secrets.sh`. Those describe the manual Workers deploy and the backup Worker; keeping them alongside a Pages GitHub build is the main source of conflicting routes and confusing build logs.
- Remove the commented wildcard/apex route notes with them.
- Keep `dist/` git-ignored.

### 5. Docs
Rewrite `docs/CLOUDFLARE_SETUP.md` as a single Pages-via-GitHub guide: connect repo, framework preset "None", build command `npm run build`, output directory `dist`, set the variables and secrets, add compatibility date `2025-09-01` + flag `nodejs_compat`, deploy, test on `*.pages.dev`, attach `orzen.top` from the project's Custom domains tab afterwards.

## Technical notes
- Files touched: `vite.config.ts` (preset + output dir), `package.json` (scripts), `scripts/build-dist.sh` (simplified), `docs/CLOUDFLARE_SETUP.md`, `.gitignore`.
- Files deleted: `wrangler.toml`, the three Cloudflare shell scripts.
- No app code, route, schema or auth changes. Existing accounts, products and orders are in the database and appear on the new deployment immediately.

## Trade-off to confirm
Deleting `wrangler.toml` removes the manual `wrangler deploy` path and the `orzen-commerce-backup` failover Worker. If you want to keep the backup Worker as a fallback, say so and it stays — but then the Pages build must be the only thing attached to the domain.
