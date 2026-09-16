#!/usr/bin/env bash
# Guarded ORZEN production deployment. Never use Lovable Publish for orzen.top.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

EXPECTED_PROJECT_ID="rljisleyqluoexmtncos"
BLOCKED_PROJECT_ID="dqhfxvhzagitytpvildw"
WORKER_NAME="orzen-commerce"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

for name in CF_API_TOKEN CF_ACCOUNT_ID PROD_SUPABASE_ACCESS_TOKEN; do
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
if not publishable:
    raise SystemExit("Production publishable key was not found.")

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

echo "Building the guarded production candidate…"
bun run build

if ! rg -q "$EXPECTED_PROJECT_ID" dist/client; then
  echo "Production database reference is missing from the browser bundle; deployment stopped." >&2
  exit 1
fi
if rg -q "$BLOCKED_PROJECT_ID" dist/client; then
  echo "Development database reference was found in the browser bundle; deployment stopped." >&2
  exit 1
fi

CONFIG="dist/server/wrangler.json"
if [ ! -f "$CONFIG" ]; then
  echo "Cloudflare Worker configuration was not generated; deployment stopped." >&2
  exit 1
fi

python3 - "$CONFIG" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
config = json.loads(path.read_text(encoding="utf-8"))
config["name"] = "orzen-commerce"
flags = set(config.get("compatibility_flags", []))
flags.add("nodejs_compat")
config["compatibility_flags"] = sorted(flags)
path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
PY

echo "Uploading a non-live production candidate…"
UPLOAD_LOG="$TMP_DIR/upload.log"
bunx wrangler versions upload \
  --config "$CONFIG" \
  --keep-vars \
  --preview-alias orzen-candidate \
  --message "Guarded ORZEN production candidate" | tee "$UPLOAD_LOG"

VERSION_ID="$(grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "$UPLOAD_LOG" | tail -1)"
PREVIEW_URL="$(grep -Eo 'https://[^ ]+workers\.dev' "$UPLOAD_LOG" | tail -1)"
if [ -z "$VERSION_ID" ] || [ -z "$PREVIEW_URL" ]; then
  echo "Could not identify the candidate version or preview address; live deployment stopped." >&2
  exit 1
fi

export ORZEN_PREVIEW_URL="$PREVIEW_URL"
python3 <<'PY'
import os, re, urllib.parse, urllib.request

base = os.environ["ORZEN_PREVIEW_URL"].rstrip("/")
expected = os.environ["ORZEN_EXPECTED_PROJECT_ID"]
with urllib.request.urlopen(base + "/auth", timeout=30) as response:
    html = response.read().decode("utf-8", "replace")
    if response.status != 200:
        raise SystemExit("Candidate auth page did not return 200.")

assets = set(re.findall(r'(?:src|href)=["\']([^"\']+\.js[^"\']*)', html))
matched = False
for asset in assets:
    with urllib.request.urlopen(urllib.parse.urljoin(base, asset), timeout=30) as response:
        body = response.read().decode("utf-8", "replace")
    matched = matched or expected in body
if not matched:
    raise SystemExit("Candidate browser bundle does not point at production; live deployment stopped.")
PY

echo "Candidate checks passed. Deploying version to 100%…"
bunx wrangler versions deploy "$VERSION_ID@100%" --name "$WORKER_NAME" --yes \
  --message "Verified ORZEN production deployment"

export ORZEN_LIVE_URL="https://orzen.top"
python3 <<'PY'
import os, re, time, urllib.parse, urllib.request

base = os.environ["ORZEN_LIVE_URL"]
expected = os.environ["ORZEN_EXPECTED_PROJECT_ID"]
blocked = "dqhfxvhzagitytpvildw"
for attempt in range(12):
    with urllib.request.urlopen(base + "/auth", timeout=30) as response:
        html = response.read().decode("utf-8", "replace")
    assets = set(re.findall(r'(?:src|href)=["\']([^"\']+\.js[^"\']*)', html))
    bodies = []
    for asset in assets:
        with urllib.request.urlopen(urllib.parse.urljoin(base, asset), timeout=30) as response:
            bodies.append(response.read().decode("utf-8", "replace"))
    if any(expected in body for body in bodies) and not any(blocked in body for body in bodies):
        print("Live production identity check passed.")
        break
    if attempt == 11:
        raise SystemExit("Live identity check failed after deployment.")
    time.sleep(5)
PY

echo "ORZEN production deployment completed safely."
