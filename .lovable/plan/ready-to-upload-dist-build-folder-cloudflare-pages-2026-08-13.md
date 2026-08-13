# Ready-to-upload `dist/` build folder (Cloudflare Pages)

Goal: run one command and get a single `dist/` folder you can drag into Cloudflare Pages, with `index.html`, all compiled assets, and the server bundle in the exact layout Pages expects.

## Important note on "static"

This app is not a static site — orders, checkout, admin, webhooks, cron and the AI agent all run server-side. A pure HTML-only export would leave a shell that cannot log in or take orders. Cloudflare Pages solves this: the folder is still a plain drag-and-drop upload, but it also carries a `_worker.js` that runs the backend. Nothing in the app changes; only the packaging.

## What gets built

Target layout of `dist/`:

```text
dist/
  index.html            compiled entry HTML
  _worker.js            SSR + server functions bundle
  _routes.json          tells Pages which paths hit the worker vs. static files
  _headers              long-cache for hashed assets
  assets/…              hashed JS/CSS/images
  favicon, robots.txt, other public files
```

## Changes

1. **`scripts/build-dist.sh`** (new) — one command that:
   - runs the production build with the Cloudflare preset,
   - clears and recreates `dist/`,
   - copies the built static output (`.output/public/*`) into `dist/`,
   - copies the server bundle in as `dist/_worker.js`,
   - writes `_routes.json` so static assets are served directly and everything else goes to the worker,
   - writes `_headers` with immutable caching for `/assets/*`,
   - prints the resulting file count and total size, plus upload instructions.
2. **`package.json`** — add a `build:dist` script that calls it, so `bun run build:dist` (or `npm run build:dist`) is all that is needed.
3. **`.gitignore`** — ignore `dist/` so the generated folder is never committed.
4. **`docs/CLOUDFLARE_SETUP.md`** — add a short "Option B: drag-and-drop `dist/` to Cloudflare Pages" section: build, open Workers & Pages → Create → Pages → Upload assets, drop the folder, then set the environment variables (Supabase URL + publishable key) and the two secrets (`SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`) in the Pages project settings.

## Technical notes

- Build uses `NITRO_PRESET=cloudflare_pages` for this script so Nitro emits the Pages `_worker.js` shape; the existing `wrangler.toml` Workers flow (`cloudflare_module`) stays untouched and keeps working.
- The database stays the same — the Supabase URL and publishable key are already public runtime vars, so existing accounts, products and orders appear immediately on the new deployment.
- No app code, routes, schema or auth changes.

## After this lands

1. `bun run build:dist` (or `npm run build:dist`)
2. Upload the `dist/` folder to Cloudflare Pages
3. Add env vars + secrets in the Pages project, redeploy once, test on the `*.pages.dev` URL
