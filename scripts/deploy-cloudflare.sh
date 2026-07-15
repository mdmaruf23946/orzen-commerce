#!/usr/bin/env bash
# Build and deploy the app to Cloudflare Workers.
# Prereqs:
#   - `bun install` has been run
#   - `wrangler login` (or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID env vars)
#   - Runtime secrets pushed once with `bun run cf:secrets` (see below)
set -euo pipefail

echo "▶ Building (Nitro cloudflare preset)…"
bun run build

echo "▶ Deploying to Cloudflare Workers…"
bunx wrangler deploy

echo "✔ Deployed. Configure DNS per docs/CLOUDFLARE_SETUP.md if you haven't."
