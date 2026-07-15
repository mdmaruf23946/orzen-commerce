#!/usr/bin/env bash
# One-time push of runtime secrets into the Cloudflare Pages project.
# Reads from your local shell env — export them first, then run this.
set -euo pipefail

PROJECT_NAME="${CF_PAGES_PROJECT:-orzen-commerce-3ea3838d}"

need() { [[ -n "${!1:-}" ]] || { echo "Missing env: $1"; exit 1; }; }

need CF_API_TOKEN         # Cloudflare API token with "SSL and Certificates: Edit" on the zone
need CF_ZONE_ID           # Zone ID of orzen.top (Cloudflare dashboard → domain → Overview)
need CF_ACCOUNT_ID        # Cloudflare account ID
need SUPABASE_SERVICE_ROLE_KEY   # Lovable Cloud service role — for admin server fns
need LOVABLE_API_KEY             # AI Gateway key

push() {
  printf '%s' "${!1}" | bunx wrangler pages secret put "$1" \
    --project-name "$PROJECT_NAME"
}

push CF_API_TOKEN
push CF_ZONE_ID
push CF_ACCOUNT_ID
push SUPABASE_SERVICE_ROLE_KEY
push LOVABLE_API_KEY

echo "✔ Secrets pushed to Pages project $PROJECT_NAME. Run scripts/deploy-cloudflare.sh next."
