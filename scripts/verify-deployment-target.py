#!/usr/bin/env python3
"""Verify that a deployed ORZEN origin serves browser code and a server runtime
that both point at the production database.

The browser entry module only references a handful of chunks directly, so a
naive scan of the HTML's <script> tags misses the chunk that actually creates
the database client. This walks the whole chunk graph reachable from the auth
page before deciding.

Usage: verify-deployment-target.py <base-url> <expected-project-id> <blocked-project-id>
"""

from __future__ import annotations

import json
import re
import sys
import urllib.parse
import urllib.request

CHUNK_PATTERN = re.compile(r"assets/[A-Za-z0-9_\-]+\.js")
HTML_ASSET_PATTERN = re.compile(r'(?:src|href)=["\']([^"\']+\.js)["\']')
USER_AGENT = "Mozilla/5.0 ORZEN-Deployment-Check/1.0"


def fetch(url: str) -> tuple[int, str]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.status, response.read().decode("utf-8", "replace")


def crawl_chunks(base: str, html: str) -> dict[str, str]:
    """Return every reachable JS chunk body keyed by path."""
    pending = {asset.lstrip("/") for asset in HTML_ASSET_PATTERN.findall(html)}
    pending |= set(CHUNK_PATTERN.findall(html))
    seen: dict[str, str] = {}
    while pending:
        path = pending.pop()
        if path in seen:
            continue
        try:
            _, body = fetch(urllib.parse.urljoin(base + "/", path))
        except Exception:  # a referenced-but-absent chunk is not an identity failure
            seen[path] = ""
            continue
        seen[path] = body
        pending |= {ref for ref in CHUNK_PATTERN.findall(body) if ref not in seen}
    return seen


def main() -> int:
    base, expected, blocked = sys.argv[1].rstrip("/"), sys.argv[2], sys.argv[3]

    status, html = fetch(base + "/auth")
    if status != 200:
        print(f"Sign-in page returned HTTP {status}.", file=sys.stderr)
        return 1

    chunks = crawl_chunks(base, html)
    if not chunks:
        print("No browser code was found on the sign-in page.", file=sys.stderr)
        return 1

    endpoint = f"https://{expected}.supabase.co"
    production_chunks = [path for path, body in chunks.items() if endpoint in body]
    blocked_chunks = [path for path, body in chunks.items() if blocked in body]

    if blocked_chunks:
        print(
            "Development database reference found in browser code: "
            + ", ".join(sorted(blocked_chunks)),
            file=sys.stderr,
        )
        return 1
    if not production_chunks:
        print(
            f"Production database endpoint {endpoint} was not found in any of "
            f"{len(chunks)} browser chunks.",
            file=sys.stderr,
        )
        return 1

    status, body = fetch(base + "/api/public/deployment-health")
    health = json.loads(body)
    if health.get("ok") is not True or health.get("serverProjectId") != expected:
        print(f"Server runtime identity check failed: {health}", file=sys.stderr)
        return 1

    print(
        f"Identity check passed: {len(chunks)} browser chunks scanned, "
        f"production endpoint found in {len(production_chunks)}, server runtime matches."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
