#!/usr/bin/env bash
# Manual deploy of the app to Cloudflare Workers (with Static Assets).
# No GitHub connection and no custom domain are required.
#
# Prereqs:
#   - dependencies installed  (bun install  |  npm install)
#   - logged in to the target Cloudflare account: `npx wrangler login`
#   - (optional) runtime secrets pushed: scripts/cf-push-secrets.sh
set -euo pipefail

RUN="bunx"
command -v bun >/dev/null 2>&1 || RUN="npx"

echo "▶ Building (Nitro cloudflare_module preset)…"
if command -v bun >/dev/null 2>&1; then
  NITRO_PRESET=cloudflare_module bun run build
else
  NITRO_PRESET=cloudflare_module npm run build
fi

echo "▶ Deploying Worker…"
$RUN wrangler deploy

cat <<'EOF'

✔ Deployed.

Your site is live on the free Cloudflare URL printed just above
(https://orzen-commerce-3ea3838d.<your-subdomain>.workers.dev).

Test it fully there first. Only when everything works, attach your domain:
  Cloudflare dashboard → Workers & Pages → this Worker
    → Settings → Domains & Routes → Add → orzen.top  (then www.orzen.top)

Do NOT add a wildcard route like *.orzen.top/* — see docs/CLOUDFLARE_SETUP.md.
EOF
