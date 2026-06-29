
## Goal

Rebuild the store admin's Subscription experience so every plan (Free Trial, Basic, Business, Custom) is shown as a detailed card with limits, features and a clear upgrade path, plus a side-by-side comparison table and a live trial countdown.

## Scope

Frontend-only redesign of the existing billing page. No schema or business-logic changes — we reuse `myBillingStatus`, `listPublicPlans`, the existing `subscription_packages` columns (`product_limit`, `order_limit`, `storage_mb`, `staff_limit`, `is_trial`, `trial_days`, `features` JSON, `billing_cycle`, `price`) and `features.ts` flags. New-user trial auto-start already runs via the `start_trial_for_store` DB trigger and the status banner already shows expiry — we'll add a richer countdown on the page itself.

One small data tweak: `listPublicPlans` currently filters out trial plans (`is_trial = false`). We'll include trial plans too so the Free Trial card can render from the same source of truth.

## Page layout (`src/routes/_authenticated/admin/billing.tsx`)

1. **Header / current status strip**
   - Current plan name + price + billing cycle.
   - Status pill (Trialing / Active / Expired / Suspended).
   - Trial countdown block when `subscription_status === "trialing"`: large "X days Y hours remaining", progress bar (days_left / trial_days), short note "After the trial ends, your store moves to the Free plan automatically."

2. **Plan cards grid** (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`)
   - One card per plan returned from `listPublicPlans` (now includes the trial).
   - Card shows:
     - Plan name, short description, price (`৳X / cycle`, "Free" for trial).
     - "Current Plan" badge when `store.package_id === plan.id`.
     - "Most Popular" highlight ring on the Business plan (detected by name match, fallback to middle paid plan).
     - Limits block: Products, Orders, Storage (MB → GB if ≥1024), Staff. "Unlimited" when value is 0/null.
     - Feature list with check/cross icons for: AI Agent, Messenger AI, Courier, Facebook Pixel, Analytics, Inventory, Invoice, Coupons. Trial plan shows all-enabled with a "Full access during trial" note.
     - Support type line derived from `plan.features.support` or a fixed map (Trial → Community, Basic → Email, Business → Priority, Custom → Dedicated).
     - CTA: "Current Plan" (disabled) / "Upgrade" (paid) / "Trial Active" (disabled on trial card while trialing) / "Contact Sales" link for Custom plan (mailto or `/contact`).

3. **Compare Plans section** (collapsible, default open on desktop, accordion on mobile)
   - Responsive table with sticky first column listing every feature/limit row from the requirements.
   - One column per plan, ✓ / ✕ / value cells.
   - On mobile (<640px) the table becomes a stacked per-plan summary inside `<details>` blocks to avoid horizontal scroll while keeping it lightweight.

4. **Payment history** — keep the existing table unchanged below the comparison section.

## Small supporting changes

- `src/lib/billing.functions.ts`: drop `.eq("is_trial", false)` in `listPublicPlans` and order by `is_trial DESC` then `sort_order` so the trial card appears first. No new fields needed.
- `src/lib/features.ts`: add a small `PLAN_FEATURE_ROWS` constant (label + key + render type: bool | limit | text) used by both the card feature list and the comparison table to avoid duplication.
- No changes to `SubscriptionStatusBanner`, routing, or DB.

## Out of scope

- Owner-side package editing UI.
- Implementing a separate "Free (post-trial)" package row — the DB already flips `subscription_status` to `expired` after the trial; surfacing a dedicated Free tier in marketing copy only would require a new package row, which the user can add from the Owner → Packages page. We'll display the Free Trial card and clearly state the post-trial behavior; if the user wants a literal "Free plan" package shown, that's a follow-up (one DB seed).

## Technical notes

- All data already comes from two existing server functions — no new round trips.
- Page stays SSR-friendly under `_authenticated`; uses `useQuery` with the existing `staleTime`.
- Pure Tailwind + existing shadcn `Button`, `Badge`, `Progress`, `Card`; no new dependencies, keeping bundle size flat.
