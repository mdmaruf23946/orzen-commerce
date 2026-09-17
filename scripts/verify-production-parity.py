#!/usr/bin/env python3
"""Guard production against privilege drift and domain drift.

Checks, against the live ORZEN production Supabase project and Cloudflare account:
  1. every public database function is executable by the trusted server role;
  2. the anonymous-facing functions the public site calls are executable by anon;
  3. every ORZEN custom domain is attached to the production-only Worker service.

Exits non-zero with a plain explanation when anything drifts.
Requires: PROD_SUPABASE_ACCESS_TOKEN, and (for the domain check) CF_API_TOKEN.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

PROD_PROJECT_ID = "rljisleyqluoexmtncos"
CF_ACCOUNT_ID = "255163c031583675dc487ea8a981dc38"
CF_ZONE_NAME = "orzen.top"
PRODUCTION_SERVICE = "orzen-commerce-production"

# Functions the public site calls with the anonymous (publishable) key.
ANON_REQUIRED = [
    "is_slug_taken",
    "resolve_domain",
    "resolve_host_kind",
    "platform_routing_hosts",
    "get_public_store_by_slug",
    "get_public_order",
    "get_public_delivery_zones",
    "get_public_landing_page",
    "get_store_page",
    "get_store_legal_page",
    "list_store_pages_public",
    "get_product_reviews",
    "submit_product_review",
    "validate_coupon",
    "get_platform_branding",
    "get_platform_footer",
]


def _request(url: str, token: str, payload: dict | None = None) -> object:
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST" if data else "GET",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def check_database(failures: list[str]) -> None:
    token = os.environ.get("PROD_SUPABASE_ACCESS_TOKEN")
    if not token:
        failures.append("PROD_SUPABASE_ACCESS_TOKEN is not available; database checks were skipped.")
        return

    anon_list = ", ".join(f"'{name}'" for name in ANON_REQUIRED)
    query = f"""
        select
          coalesce(string_agg(distinct p.proname, ', ')
            filter (where not has_function_privilege('service_role', p.oid, 'execute')), '') as server_missing,
          coalesce(string_agg(distinct p.proname, ', ')
            filter (where p.proname in ({anon_list})
              and not has_function_privilege('anon', p.oid, 'execute')), '') as anon_missing
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prokind = 'f';
    """
    try:
        rows = _request(
            f"https://api.supabase.com/v1/projects/{PROD_PROJECT_ID}/database/query",
            token,
            {"query": query},
        )
    except urllib.error.URLError as exc:  # pragma: no cover - network failure path
        failures.append(f"Could not query the production database: {exc}")
        return

    row = rows[0] if isinstance(rows, list) and rows else {}
    if row.get("server_missing"):
        failures.append(f"Server role cannot run these functions: {row['server_missing']}")
    if row.get("anon_missing"):
        failures.append(f"Public visitors cannot run these functions: {row['anon_missing']}")


def check_domains(failures: list[str]) -> None:
    token = os.environ.get("CF_API_TOKEN")
    if not token:
        print("Cloudflare token not available; domain attachment check skipped.")
        return
    try:
        result = _request(
            f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/workers/domains",
            token,
        )
    except urllib.error.URLError as exc:  # pragma: no cover - network failure path
        failures.append(f"Could not read Cloudflare custom domains: {exc}")
        return

    stray = [
        entry["hostname"]
        for entry in result.get("result", [])
        if entry.get("zone_name") == CF_ZONE_NAME
        and entry.get("service") != PRODUCTION_SERVICE
    ]
    if stray:
        failures.append(
            "These addresses are served by another Worker instead of "
            f"{PRODUCTION_SERVICE}: {', '.join(sorted(stray))}"
        )


def main() -> int:
    failures: list[str] = []
    check_database(failures)
    check_domains(failures)
    if failures:
        print("Production parity check FAILED:")
        for item in failures:
            print(f"  - {item}")
        return 1
    print("Production parity check passed: database privileges and custom domains are correct.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
