## Goal
Redesign the Store Admin **Billing & Subscription** page into a clean SaaS experience that cleanly separates the temporary Free Trial from the four real plans (Free, Basic, Business, Custom), adds a billing-cycle selector with owner-controlled discounts, and adds a downloadable payment history — without breaking existing checkout/payment logic.

## 1. Database (one migration)

Add owner-configurable settings (no breaking changes):

- `subscription_packages.plan_tier` enum `'free' | 'basic' | 'business' | 'custom'` (nullable; used to identify the 4 canonical plans in the UI).
- `subscription_packages.feature_summary` (text[]) — optional bullet list shown on the card.
- New table `platform_billing_settings` (single row, id='global'):
  - `discount_3m numeric default 5`
  - `discount_6m numeric default 10`
  - `discount_yearly numeric default 20`
  - RLS: read = anon+authenticated, write = owner role only.
- Ensure the trial trigger (`start_trial_for_store`) also assigns the **Free** plan tier after trial expiry. Add helper SQL function `expire_trials()` (called by existing refresh routine) that, when `trial_ends_at < now()` and status was `trialing`, moves the store to the Free plan and sets `subscription_status='active'`.
- Seed the four canonical plans (Free, Basic, Business, Custom) if missing, using existing `lunex` row mapped to Business.

## 2. Server functions (`src/lib/billing.functions.ts`)

- `listPublicPlans`: exclude trial plans (`is_trial=false`), return ordered by `plan_tier` (free→basic→business→custom). Include `feature_summary` and `plan_tier`.
- `getBillingSettings` (public GET): returns the 3 discount percentages.
- `submitManualPayment`: accept `billing_cycle` ('monthly' | '3m' | '6m' | 'yearly') and compute `amount` server-side using `price * cycle_months * (1 - discount)`.
- Owner side (`src/lib/owner.functions.ts`): `updateBillingSettings({discount_3m, discount_6m, discount_yearly})` — owner-only.

## 3. Store Admin Billing page (`src/routes/_authenticated/admin/billing.tsx`)

Rewrite the page with these sections (top to bottom):

1. **Trial Banner** — only when `subscription_status==='trialing'`. Compact amber/gradient banner with 🎉 title, "X Days Remaining", short copy, `Upgrade Now` button. Auto-hides after expiry.
2. **Current Plan Card** — plan name, status badge, billing cycle, expiry/renewal date, Upgrade button. If trialing, shows "Free Plan · Trial Active · X days remaining".
3. **Billing Cycle Selector** — segmented control: Monthly | 3 Months (-5%) | 6 Months (-10%) | Yearly (-20%). Labels read from `getBillingSettings`. Selection lives in component state; recomputes prices instantly.
4. **Plan Cards Grid** (4 cards: Free, Basic, Business⭐, Custom):
   - Free: ৳0, "Current Plan" if applicable, limited features.
   - Basic / Business: monthly price → discounted total for chosen cycle, per-month equivalent under it, savings badge.
   - Business gets "⭐ Most Popular".
   - Custom: no price, "Contact Sales" button (mailto).
   - Each card lists: limits (products/orders/storage/staff) + feature check/cross list using `FEATURE_KEYS`.
   - Upgrade button passes `packageId` + `cycle` to checkout.
5. **Compare Plans Table** — sticky header, 4 plan columns, rows from `PLAN_ROWS` (limits + every feature). Mobile: accordion per plan.
6. **Payment History** — invoice no, package, billing period (cycle_start → cycle_end), method, txn id, amount, paid date, expiry, status, "Download" link → opens existing `/admin/invoice/$orderId` style printable view (new lightweight `subscription-invoice` route or reuse). Lazy-load this section via `React.lazy` so it doesn't block first paint.

Performance: single `useQuery` for `myBillingStatus`, one for `listPublicPlans`, one for `getBillingSettings`. No animations beyond CSS transitions. All sections render from already-fetched data — no extra requests when switching billing cycle.

## 4. Checkout route (`billing.checkout.$packageId.tsx`)

- Read `cycle` from search params (default `monthly`).
- Show selected plan + cycle + computed total (with discount line).
- Payment method picker (existing bkash/nagad/rocket flow).
- Submit calls updated `submitManualPayment({packageId, cycle, method, txn_id, sender_number})`.

## 5. Owner Panel — Discount settings

Extend `src/routes/_authenticated/owner/packages.tsx` (or a small new card) with a "Billing Discounts" form: three percentage inputs (3m, 6m, yearly) wired to `updateBillingSettings`.

## 6. Feature gating

No changes to `src/lib/features.ts` runtime behavior. After trial expiry, the store's package becomes Free → existing `hasFeature()` already returns false for unselected features. Trial banner disappears automatically because `subscription_status` flips off `trialing`.

## What is NOT changing
- `src/routes/_authenticated/admin/subscription.tsx` legacy view stays untouched (still linked from older nav, harmless).
- AI, products, orders, storefront, RLS for unrelated tables.
- The existing `payments` and `subscription_notifications` schemas (only reads/writes adjust).

## Technical notes
- Trial detection: `store.subscription_status === 'trialing'` AND `trial_ends_at > now()`.
- Discount math: `total = monthlyPrice * months * (1 - discountPct/100)`; show both total and effective per-month.
- Canonical plans resolved by `plan_tier`; if a tier is missing the card renders a "Coming soon" placeholder so layout stays stable.
- Invoice download: client-side print of a minimal HTML invoice route (`/admin/billing/invoice/$paymentId`) — no PDF lib added (keeps bundle small).