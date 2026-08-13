#!/usr/bin/env bash
# Push runtime secrets into the Cloudflare Worker.
# Export them in your shell first, then run this script.
#
# Usage:
#   bash scripts/cf-push-secrets.sh                # primary Worker
#   bash scripts/cf-push-secrets.sh --env backup   # backup/failover Worker
#
# Secrets are per-Worker, so run it once for each environment/account.
#
# Required for a normal deploy:
#   SUPABASE_SERVICE_ROLE_KEY   admin server functions
#   LOVABLE_API_KEY             AI Gateway (AI agent, product builder)
#
# Optional — only needed for the merchant custom-domain (SSL for SaaS) feature:
#   CF_API_TOKEN, CF_ZONE_ID, CF_ACCOUNT_ID
set -euo pipefail

RUN="bunx"
command -v bun >/dev/null 2>&1 || RUN="npx"

ENV_ARGS=()
if [[ "${1:-}" == "--env" && -n "${2:-}" ]]; then
  ENV_ARGS=(--env "$2")
  echo "▶ Target environment: $2"
fi

need() { [[ -n "${!1:-}" ]] || { echo "Missing required env: $1"; exit 1; }; }

push() { printf '%s' "${!1}" | $RUN wrangler secret put "$1" "${ENV_ARGS[@]}"; }

push_optional() {
  if [[ -n "${!1:-}" ]]; then
    push "$1"
  else
    echo "• Skipping optional secret $1 (not set)"
  fi
}

need SUPABASE_SERVICE_ROLE_KEY
need LOVABLE_API_KEY

push SUPABASE_SERVICE_ROLE_KEY
push LOVABLE_API_KEY

push_optional CF_API_TOKEN
push_optional CF_ZONE_ID
push_optional CF_ACCOUNT_ID

echo "✔ Secrets pushed. Run scripts/deploy-cloudflare.sh (or -backup.sh) next."
