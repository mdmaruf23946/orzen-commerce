#!/usr/bin/env bash
# Manual deploy of the BACKUP (failover) Worker.
# Same code, same database — a second Worker you can switch traffic to.
#
# Run it in the backup Cloudflare account (or the same account; the Worker
# name differs, so they never collide):
#   npx wrangler login
#   bash scripts/cf-push-secrets.sh --env backup     # once per account
#   bash scripts/deploy-cloudflare-backup.sh
set -euo pipefail

RUN="bunx"
command -v bun >/dev/null 2>&1 || RUN="npx"

echo "▶ Building (Nitro cloudflare_module preset)…"
if command -v bun >/dev/null 2>&1; then
  NITRO_PRESET=cloudflare_module bun run build
else
  NITRO_PRESET=cloudflare_module npm run build
fi

echo "▶ Deploying BACKUP Worker (env: backup)…"
$RUN wrangler deploy --env backup

cat <<'EOF'

✔ Backup deployed.

It is live on its own free URL:
  https://orzen-commerce-backup.<your-subdomain>.workers.dev

It reads the SAME database as the primary, so accounts, products and orders
are identical on both. Test it there.

Failover (when the primary is down):
  Cloudflare dashboard → Workers & Pages → orzen-commerce-3ea3838d
    → Settings → Domains & Routes → remove orzen.top / www.orzen.top
  then add the same two hostnames to orzen-commerce-backup.

Switching back is the same steps in reverse. DNS is managed by Cloudflare, so
propagation is near-instant. Never add a wildcard route.
EOF
