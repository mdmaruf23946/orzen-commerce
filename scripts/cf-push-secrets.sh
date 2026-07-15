#!/usr/bin/env bash
# One-time push of runtime secrets into the Cloudflare Worker.
# Reads from your local shell env — export them first, then run this.
set -euo pipefail

need() { [[ -n "${!1:-}" ]] || { echo "Missing env: $1"; exit 1; }; }

need CF_API_TOKEN         # Cloudflare API token with "SSL and Certificates: Edit" on the zone
need CF_ZONE_ID           # Zone ID of orzen.top
need CF_ACCOUNT_ID        # Cloudflare account ID
need SUPABASE_SERVICE_ROLE_KEY   # Lovable Cloud service role — for admin server fns
need LOVABLE_API_KEY             # AI Gateway key

push() {
  printf '%s' "${!1}" | bunx wrangler secret put "$1"
}

push CF_API_TOKEN
push CF_ZONE_ID
push CF_ACCOUNT_ID
push SUPABASE_SERVICE_ROLE_KEY
push LOVABLE_API_KEY

echo "✔ Secrets pushed. Run scripts/deploy-cloudflare.sh next."
