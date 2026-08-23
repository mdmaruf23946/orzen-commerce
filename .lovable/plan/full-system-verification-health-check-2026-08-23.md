# Full System Verification & Health Check

## What I already verified (read-only, this session)

- **Build/type safety**: full TypeScript check passes with zero errors.
- **Public site**: `/`, `/auth`, `/about`, `/contact`, `/privacy-policy` all return 200, render, and produce **no console or page errors**. Titles and OG tags are present on each.
- **Codebase**: no leftover TODO/FIXME/"Coming Soon" stubs remain.
- **Database security linter**: 58 findings — 22 SECURITY DEFINER functions callable by signed-out visitors, 34 callable by any signed-in user, and 2 tables with RLS on but no policies (`store_customer_credentials`, `store_customer_sessions` — that is intentional; they are only reached through security-definer login functions).
- **Grants**: the `anon` role holds SELECT on 133 of 141 public tables, so row protection rests entirely on RLS policies for those tables.
- **Plan gating**: gate coverage is uneven — the Landing Pages *list* page is gated but the landing page **detail/builder** pages (`landing-pages.$id`, `landing-builder.*`) are not, and Customers has no UI gate for the notes feature.

Not yet verified: the signed-in Store Admin and Owner Admin panels. That needs a real login session, which I'll create at the start of the work.

## Plan

### Step 1 — Authenticated sweep (verification, no code changes)
Sign in as a store owner and walk all 58 Store Admin routes plus the Owner Admin routes at both 390px (mobile) and 1280px (desktop), recording per page: HTTP status, console/network errors, failed database calls, empty-state vs. broken-state, and layout overflow. Same for the customer storefront (product, cart, checkout, account, order tracking, returns).

### Step 2 — Triage
Group everything found into: (a) actually broken, (b) permission/data-exposure risk, (c) cosmetic/responsive, (d) works but fragile. Only (a) and (b) get fixed automatically; (c) and (d) get fixed if low risk, otherwise reported.

### Step 3 — Fixes I already expect to make
1. **Lock down SECURITY DEFINER functions.** Revoke EXECUTE from `anon`/`authenticated` on every definer function that is not part of a public flow (storefront resolution, customer login, public order lookup stay open). This is the single largest security item.
2. **Close the plan-gating holes.** Add the missing `FeatureGate` to the landing page detail/builder routes and the Customers notes area so the premium UI matches the server-side checks instead of failing with a raw error on save.
3. Fix whatever Step 1 turns up in the broken/permission buckets.

### Step 4 — Regression check
Re-run the type check, re-walk the public pages and a representative slice of admin pages, and confirm nothing that worked before Step 3 broke.

### Step 5 — Report
A summary with four sections: problems found, problems fixed, remaining risks, and items that need your decision (e.g. anything that would change how an existing feature behaves).

## Ground rules

- No redesigns. No refactors of working features. Every change is scoped to a defect found in Step 1 or an item listed in Step 3.
- Database changes limited to permission grants and RLS policies; no schema or data changes without telling you first.
- If a fix would alter existing behaviour users depend on, I report it instead of shipping it.

## Technical notes

- Definer-function lockdown ships as one migration of `REVOKE EXECUTE ... FROM anon, authenticated`, with an explicit allow-list for the public storefront/customer functions (`get_public_store_by_slug`, `resolve_domain`, `customer_login`, `customer_signup`, `get_public_order`, etc.), so storefronts keep working.
- Gating uses `hasFeature()` for the UI and `assertPlan()` server-side; each new gate adds the UI side only where the server check already exists.
- The authenticated sweep runs through Playwright against the local dev server with a real Supabase session.
