#!/usr/bin/env bash
# Produces a single, ready-to-upload ./dist folder for Cloudflare Pages
# (Workers & Pages → Create → Pages → Upload assets → drag the folder in).
#
#   bun run build:dist     (or)     npm run build:dist
#
# Layout produced:
#   dist/index.html      compiled entry HTML
#   dist/_worker.js      SSR + server functions bundle
#   dist/_routes.json    which paths hit the worker vs. static files
#   dist/_headers        immutable caching for hashed assets
#   dist/assets/…        hashed JS/CSS/images + other public files
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if command -v bun >/dev/null 2>&1; then
  RUNNER="bun run"
else
  RUNNER="npm run"
fi

echo "▶ Building (Nitro cloudflare_pages preset)…"
rm -rf .output dist
NITRO_PRESET=cloudflare_pages $RUNNER build

if [ ! -d ".output/public" ]; then
  echo "✖ Build produced no .output/public directory." >&2
  exit 1
fi

echo "▶ Assembling dist/…"
mkdir -p dist
cp -R .output/public/. dist/

# The cloudflare_pages preset already emits dist/_worker.js inside public.
# If a Workers-shaped build was produced instead, copy the server entry over.
if [ ! -e "dist/_worker.js" ]; then
  if [ -f ".output/server/index.mjs" ]; then
    cp .output/server/index.mjs dist/_worker.js
    # Bring along any chunks the entry imports.
    if [ -d ".output/server/chunks" ]; then
      cp -R .output/server/chunks dist/chunks
    fi
  else
    echo "✖ No worker bundle found (.output/public/_worker.js or .output/server/index.mjs)." >&2
    exit 1
  fi
fi

# Static-first routing: let Pages serve hashed assets straight from the CDN and
# send everything else through the SSR worker.
cat > dist/_routes.json <<'JSON'
{
  "version": 1,
  "include": ["/*"],
  "exclude": [
    "/assets/*",
    "/_build/*",
    "/favicon.ico",
    "/favicon.png",
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

/_build/*
  Cache-Control: public, max-age=31536000, immutable
HEADERS
fi

FILES=$(find dist -type f | wc -l | tr -d ' ')
SIZE=$(du -sh dist | awk '{print $1}')

cat <<EOF

✔ dist/ is ready — $FILES files, $SIZE total.

Upload it:
  1. Cloudflare dashboard → Workers & Pages → Create → Pages → Upload assets
  2. Drag the whole "dist" folder in and deploy
  3. Project → Settings → Variables and Secrets, add:
       VITE_SUPABASE_URL, VITE_SUPABASE_PROJECT_ID, VITE_SUPABASE_PUBLISHABLE_KEY,
       SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY        (values are in wrangler.toml)
       SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY    (secrets — never commit these)
  4. Re-deploy once so the variables apply, then test on the *.pages.dev URL.

Your existing accounts, products and orders are in the database, so they show up
immediately — nothing needs migrating.
EOF
