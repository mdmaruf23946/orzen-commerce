#!/usr/bin/env bash
# Guarded ORZEN production deployment. Never use Lovable Publish for orzen.top.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

EXPECTED_PROJECT_ID="rljisleyqluoexmtncos"
BLOCKED_PROJECT_ID="dqhfxvhzagitytpvildw"
# Public ORZEN domains point only at this isolated service. Workspace preview
# publishing may update `orzen-commerce`, but cannot replace this service.
WORKER_NAME="orzen-commerce-production"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

for name in CF_API_TOKEN CF_ACCOUNT_ID CF_ZONE_ID PROD_SUPABASE_ACCESS_TOKEN CREDENTIALS_ENCRYPTION_KEY LOVABLE_API_KEY BREVO_API_KEY RESEND_API_KEY MAILJET_API_KEY MAILJET_SECRET_KEY; do
  if [ -z "${!name:-}" ]; then
    echo "Missing required project secret: $name" >&2
    exit 1
  fi
done

export CLOUDFLARE_API_TOKEN="$CF_API_TOKEN"
export ORZEN_EXPECTED_PROJECT_ID="$EXPECTED_PROJECT_ID"
export ORZEN_KEYS_FILE="$TMP_DIR/production.env"

python3 <<'PY'
import json, os, pathlib, urllib.request

project = os.environ["ORZEN_EXPECTED_PROJECT_ID"]
request = urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{project}/api-keys",
    headers={"Authorization": f"Bearer {os.environ['PROD_SUPABASE_ACCESS_TOKEN']}"},
)
with urllib.request.urlopen(request, timeout=30) as response:
    keys = json.load(response)

publishable = next(
    (item.get("api_key") for item in keys if item.get("name") in {"publishable", "anon"}),
    None,
)
service_role = next(
    (item.get("api_key") for item in keys if item.get("name") in {"secret", "service_role"}),
    None,
)
if not publishable or not service_role:
    raise SystemExit("Production API keys were not found.")

url = f"https://{project}.supabase.co"
path = pathlib.Path(os.environ["ORZEN_KEYS_FILE"])
path.write_text(
    "\n".join([
        f"VITE_SUPABASE_URL={url}",
        f"VITE_SUPABASE_PROJECT_ID={project}",
        f"VITE_SUPABASE_PUBLISHABLE_KEY={publishable}",
        f"SUPABASE_URL={url}",
        f"SUPABASE_PROJECT_ID={project}",
        f"SUPABASE_PUBLISHABLE_KEY={publishable}",
        f"SUPABASE_SERVICE_ROLE_KEY={service_role}",
    ]) + "\n",
    encoding="utf-8",
)
path.chmod(0o600)
PY

set -a
# shellcheck disable=SC1090
source "$ORZEN_KEYS_FILE"
set +a

if [ "$VITE_SUPABASE_PROJECT_ID" != "$EXPECTED_PROJECT_ID" ] ||
   [ "$SUPABASE_PROJECT_ID" != "$EXPECTED_PROJECT_ID" ]; then
  echo "Production project identity check failed; deployment stopped." >&2
  exit 1
fi

# The browser bundle inlines import.meta.env.VITE_* at build time. Vite's
# loadEnv gives exported shell variables precedence over the on-disk `.env`
# (which holds the development project), so the `set -a; source` above is what
# makes the bundle compile against production. A `.env.production` file would
# NOT win over those exported variables — do not rely on one here.
if [ -f "$ROOT/.env.production" ]; then
  echo "Unexpected .env.production found; remove it before deploying." >&2
  exit 1
fi

# Cloudflare Turnstile bot shield: the public site key must be inlined into the
# browser bundle at build time, the secret stays server-side only.
if [ -n "${TURNSTILE_SITE_KEY:-}" ]; then
  export VITE_TURNSTILE_SITE_KEY="$TURNSTILE_SITE_KEY"
fi

echo "Building the guarded production candidate…"
NODE_ENV=production bun run build

# Content-hashed JS/CSS never change: let browsers keep them for a year so
# reloads don't re-check dozens of files. HTML stays no-store (src/server.ts).
if [ -d dist/client ]; then
  printf '/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n' > dist/client/_headers
fi

# unenv's CJS interop chunk calls createRequire(import.meta.url) at module
# scope. Some Worker runtimes leave import.meta.url undefined there, which
# crashes every SSR request with ERR_INVALID_ARG_VALUE. Guard it with a fixed
# file URL fallback (the real value is kept when it is defined).
python3 - <<'PY'
import pathlib, re
path = pathlib.Path("dist/server/_runtime.mjs")
if path.is_file():
    s = path.read_text(encoding="utf-8")
    s = re.sub(
        r'(\w+)\(import\.meta\.url\)',
        lambda m: f'{m.group(1)}(typeof import.meta.url!=="undefined"?import.meta.url:"file:///app/")',
        s,
    )
    path.write_text(s, encoding="utf-8")
PY


# Assert on the actual Supabase endpoint compiled into the browser bundle, not
# on a bare project id (guard constants in source contain the expected id and
# would make a naive check pass even on a misbuilt bundle).
if ! rg -q "https://$EXPECTED_PROJECT_ID\.supabase\.co" dist/client; then
  echo "Production database endpoint is missing from the browser bundle; deployment stopped." >&2
  exit 1
fi
if rg -q "$BLOCKED_PROJECT_ID" dist/client; then
  echo "Development database reference was found in the browser bundle; deployment stopped." >&2
  rg -l "$BLOCKED_PROJECT_ID" dist/client >&2 || true
  exit 1
fi

CONFIG="dist/server/wrangler.json"
if [ ! -f "$CONFIG" ]; then
  # Some Nitro builds skip emitting the deploy config. Write the same file the
  # cloudflare-module preset would produce, so deployments never depend on it.
  if [ ! -f "dist/server/index.mjs" ] || [ ! -d "dist/client" ]; then
    echo "Build output is incomplete; deployment stopped." >&2
    exit 1
  fi
  cat > "$CONFIG" <<'JSON'
{
  "main": "index.mjs",
  "compatibility_date": "2026-09-01",
  "compatibility_flags": ["nodejs_compat"],
  "no_bundle": true,
  "rules": [{ "type": "ESModule", "globs": ["**/*.mjs", "**/*.js"] }],
  "assets": { "binding": "ASSETS", "directory": "../client" }
}
JSON
  echo "· Generated the Cloudflare Worker configuration."
fi

python3 - "$CONFIG" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
config = json.loads(path.read_text(encoding="utf-8"))
config["name"] = "orzen-commerce-production"
flags = set(config.get("compatibility_flags", []))
flags.add("nodejs_compat")
config["compatibility_flags"] = sorted(flags)
path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
PY

RUNTIME_SECRETS="$TMP_DIR/runtime-secrets.env"
cat > "$RUNTIME_SECRETS" <<EOF
SUPABASE_URL=$SUPABASE_URL
SUPABASE_PROJECT_ID=$SUPABASE_PROJECT_ID
SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
VITE_SUPABASE_URL=$VITE_SUPABASE_URL
VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
CREDENTIALS_ENCRYPTION_KEY=$CREDENTIALS_ENCRYPTION_KEY
LOVABLE_API_KEY=$LOVABLE_API_KEY
PUBLIC_SITE_ORIGIN=https://orzen.top
CF_API_TOKEN=$CF_API_TOKEN
CF_ACCOUNT_ID=$CF_ACCOUNT_ID
CF_ZONE_ID=$CF_ZONE_ID
CF_WORKER_NAME=$WORKER_NAME
BREVO_API_KEY=$BREVO_API_KEY
RESEND_API_KEY=$RESEND_API_KEY
MAILJET_API_KEY=$MAILJET_API_KEY
MAILJET_SECRET_KEY=$MAILJET_SECRET_KEY
TURNSTILE_SECRET_KEY=${TURNSTILE_SECRET_KEY:-}
VITE_TURNSTILE_SITE_KEY=${TURNSTILE_SITE_KEY:-}
META_APP_ID=${META_APP_ID:-}
META_APP_SECRET=${META_APP_SECRET:-}

EOF

chmod 600 "$RUNTIME_SECRETS"

SERVICE_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/services/$WORKER_NAME")"
if [ "$SERVICE_STATUS" = "404" ]; then
  echo "Creating the isolated production service with the verified build…"
  bunx wrangler deploy \
    --config "$CONFIG" \
    --keep-vars \
    --secrets-file "$RUNTIME_SECRETS" \
    --message "Initial guarded ORZEN production deployment"
elif [ "$SERVICE_STATUS" != "200" ]; then
  echo "Could not verify the isolated production service (HTTP $SERVICE_STATUS); deployment stopped." >&2
  exit 1
fi

echo "Uploading a non-live production candidate with synchronized runtime…"
UPLOAD_LOG="$TMP_DIR/upload.log"
bunx wrangler versions upload \
  --config "$CONFIG" \
  --keep-vars \
  --secrets-file "$RUNTIME_SECRETS" \
  --preview-alias orzen-candidate \
  --message "Guarded ORZEN production candidate" | tee "$UPLOAD_LOG"

VERSION_ID="$(grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "$UPLOAD_LOG" | tail -1)"
PREVIEW_URL="$(sed -n 's/^Version Preview URL: //p' "$UPLOAD_LOG" | tail -1)"
if [ -z "$PREVIEW_URL" ]; then
  PREVIEW_URL="$(sed -n 's/^Version Preview Alias URL: //p' "$UPLOAD_LOG" | tail -1)"
fi
if [ -z "$VERSION_ID" ] || [ -z "$PREVIEW_URL" ]; then
  echo "Could not identify the candidate version or preview address; live deployment stopped." >&2
  exit 1
fi

echo "Checking the candidate before any live traffic reaches it…"
if ! python3 "$ROOT/scripts/verify-deployment-target.py" \
  "$PREVIEW_URL" "$EXPECTED_PROJECT_ID" "$BLOCKED_PROJECT_ID"; then
  echo "Candidate does not point at production; live deployment stopped." >&2
  exit 1
fi

echo "Candidate checks passed. Deploying verified version to 100%…"
bunx wrangler versions deploy "$VERSION_ID@100%" --name "$WORKER_NAME" --yes \
  --message "Verified ORZEN production deployment"

echo "Confirming the live site…"
for attempt in $(seq 1 12); do
  if python3 "$ROOT/scripts/verify-deployment-target.py" \
    "https://orzen.top" "$EXPECTED_PROJECT_ID" "$BLOCKED_PROJECT_ID"; then
    break
  fi
  if [ "$attempt" -eq 12 ]; then
    echo "Live identity check failed after deployment." >&2
    exit 1
  fi
  sleep 5
done

echo "Checking production database privileges and domain attachment…"
if ! python3 "$ROOT/scripts/verify-production-parity.py"; then
  echo "Production parity check failed after deployment; investigate before announcing the release." >&2
  exit 1
fi

echo "ORZEN production deployment completed safely."
