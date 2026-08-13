#!/usr/bin/env bash
# Produces a single, ready-to-upload ./dist folder for Cloudflare Pages
# (Workers & Pages → Create → Pages → Upload assets → drag the folder in).
#
#   bun run build:dist     (or)     npm run build:dist
#
# Layout produced:
#   dist/_worker.js      SSR + server functions, bundled into one file
#   dist/_routes.json    which paths hit the worker vs. static files
#   dist/_headers        immutable caching for hashed assets
#   dist/assets/…        hashed JS/CSS/images and other public files
#
# Note: this app is server-rendered, so page HTML is produced by _worker.js at
# request time — there is no pre-rendered index.html to upload.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if command -v bun >/dev/null 2>&1; then
  RUN="bun run"
  X="bunx"
else
  RUN="npm run"
  X="npx"
fi

BUILD_DIR=".dist-build"

echo "▶ Building…"
rm -rf dist "$BUILD_DIR"
$RUN build

if [ ! -d "dist/client" ] || [ ! -f "dist/server/index.mjs" ]; then
  echo "✖ Unexpected build output — expected dist/client and dist/server/index.mjs." >&2
  exit 1
fi

mv dist "$BUILD_DIR"

echo "▶ Assembling dist/…"
mkdir -p dist
cp -R "$BUILD_DIR/client/." dist/

echo "▶ Bundling the server into dist/_worker.js…"
$X esbuild "$BUILD_DIR/server/index.mjs" \
  --bundle \
  --format=esm \
  --platform=browser \
  --target=es2022 \
  --external:node:* \
  --external:cloudflare:* \
  --log-level=warning \
  --outfile=dist/_worker.js

# Static-first routing: Pages serves hashed assets straight from the CDN and
# sends everything else through the SSR worker.
cat > dist/_routes.json <<'JSON'
{
  "version": 1,
  "include": ["/*"],
  "exclude": [
    "/assets/*",
    "/_build/*",
    "/favicon.ico",
    "/favicon.png",
    "/favicon.svg",
    "/robots.txt",
    "/manifest.webmanifest"
  ]
}
JSON

# Long-lived caching for content-hashed assets only.
if [ ! -f "dist/_headers" ]; then
  cat > dist/_headers <<'HEADERS'
/assets/*
  Cache-Control: public, max-age=31536000, immutable
HEADERS
fi

rm -rf "$BUILD_DIR"

FILES=$(find dist -type f | wc -l | tr -d ' ')
SIZE=$(du -sh dist | awk '{print $1}')

cat <<EOF

✔ dist/ is ready — $FILES files, $SIZE total.

Upload it:
  1. Cloudflare dashboard → Workers & Pages → Create → Pages → Upload assets
  2. Drag the whole "dist" folder in and deploy
  3. Project → Settings → Runtime: add compatibility flag  nodejs_compat
     (compatibility date 2025-09-01 or later)
  4. Project → Settings → Variables and Secrets, add:
       VITE_SUPABASE_URL, VITE_SUPABASE_PROJECT_ID, VITE_SUPABASE_PUBLISHABLE_KEY,
       SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY        (values are in wrangler.toml)
       SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY    (secrets — never commit these)
  5. Re-deploy once so the flag and variables apply, then test on *.pages.dev

Your existing accounts, products and orders live in the database, so they show
up immediately — nothing needs migrating.
EOF
