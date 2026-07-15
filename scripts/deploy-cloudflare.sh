#!/usr/bin/env bash
# Build and deploy the app to Cloudflare Pages.
# Prereqs:
#   - `bun install` has been run
#   - `wrangler login` (or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID env vars)
#   - Environment variables + secrets configured in Cloudflare dashboard →
#     Pages → orzen-commerce-3ea3838d → Settings → Environment variables
set -euo pipefail

PROJECT_NAME="${CF_PAGES_PROJECT:-orzen-commerce-3ea3838d}"

echo "▶ Building (Nitro cloudflare-pages preset)…"
NITRO_PRESET=cloudflare-pages bun run build

echo "▶ Deploying to Cloudflare Pages ($PROJECT_NAME)…"
bunx wrangler pages deploy .output/public --project-name "$PROJECT_NAME"

echo "✔ Deployed. Configure DNS + custom hostnames per docs/CLOUDFLARE_SETUP.md."
