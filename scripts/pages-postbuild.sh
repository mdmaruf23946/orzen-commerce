#!/usr/bin/env bash
# Post-build step that reshapes ./dist into the layout Cloudflare Pages expects:
#
#   dist/_worker.js      SSR + server functions, bundled into one file
#   dist/_routes.json    which paths hit the worker vs. the static CDN
#   dist/_headers        immutable caching for hashed assets
#   dist/assets/…        hashed JS/CSS/images and other public files
#
# It runs automatically on the Cloudflare Pages build runner (CF_PAGES=1) and
# can be forced locally with PAGES_BUILD=1 (that is what `build:dist` does).
# On any other builder the untouched `dist/client` + `dist/server` output is
# left exactly as Vite produced it.
#
# Note: this app is server-rendered, so page HTML — including <head> — is
# produced by _worker.js per request. There is no static index.html, and no
# _redirects file is needed (or wanted: it would shadow the API routes).
set -euo pipefail

if [ "${CF_PAGES:-}" != "1" ] && [ "${PAGES_BUILD:-}" != "1" ]; then
  echo "· Skipping Cloudflare Pages packaging (set PAGES_BUILD=1 to force)."
  exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

X="npx"
command -v bunx >/dev/null 2>&1 && X="bunx"

BUILD_DIR=".dist-build"

if [ ! -d "dist/client" ] || [ ! -f "dist/server/index.mjs" ]; then
  echo "✖ Unexpected build output — expected dist/client and dist/server/index.mjs." >&2
  exit 1
fi

rm -rf "$BUILD_DIR"
mv dist "$BUILD_DIR"

echo "▶ Assembling dist/ for Cloudflare Pages…"
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
# sends every other path — deep links and hard refreshes included — through
# the SSR worker, so there are no 404s on refresh.
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

echo "✔ dist/ is ready for Cloudflare Pages — $FILES files, $SIZE total."
