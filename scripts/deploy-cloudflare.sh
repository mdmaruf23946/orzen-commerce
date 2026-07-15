#!/usr/bin/env bash
# Build and deploy the app to Cloudflare Workers (with Static Assets).
# Prereqs:
#   - `bun install` has been run
#   - `wrangler login` (or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID env vars)
#   - Secrets pushed via scripts/cf-push-secrets.sh
set -euo pipefail

echo "▶ Building (Nitro cloudflare_module preset)…"
NITRO_PRESET=cloudflare_module bun run build

echo "▶ Deploying Worker…"
bunx wrangler deploy

echo "✔ Deployed. Configure DNS + custom hostnames per docs/CLOUDFLARE_SETUP.md."
