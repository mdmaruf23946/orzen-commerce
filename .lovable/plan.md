## Goal
Make the Subscription & Billing page display the four canonical plans (Free / Basic / Business / Custom) with correct data, fix the mobile layout, and enforce feature access across the Store Admin panel so locked modules show an "Upgrade Required" screen linking to `/admin/billing`.

## 1. Database — fix seeded plans (one migration)

The `subscription_packages` row currently tagged as Business is literally named `lunex` (that's the store-derived name leaking into the UI) and Basic is missing courier + pixel. One migration to normalize:

- `UPDATE subscription_packages SET name='Business' WHERE plan_tier='business'` (renames the "lunex" row).
- `UPDATE` Basic → add `courier: true, pixel: true` to `features` (keep existing keys).
- `UPDATE` Business → ensure full feature set: `ai_agent, ai_messenger, courier, pixel, analytics, inventory, invoice, coupons, import_export, bulk_actions, staff, customer_notes, returns`.
- `UPDATE` Free → keep minimal (`invoice` only; explicit `false` isn't needed, missing key === off).
- `UPDATE` Custom → all feature keys `true`, limits stay `0` (rendered as "Unlimited" by `formatLimit`).
- Set `feature_summary` (text[]) for each so cards can show a short bullet list above the checklist.

No schema changes; data-only via the migration tool.

## 2. Billing page UI (`src/routes/_authenticated/admin/billing.tsx`)

Change display + mobile layout only (no logic changes to queries):

- **Force canonical name**: render `TIER_NAME[tier]` + " Plan" instead of `p.name` on plan cards, comparison table headers, and mobile accordion. `p.name` is only used to resolve the tier fallback.
- **Current Plan card**: show `TIER_NAME[currentTier] + " Plan"` (never the raw DB name), so "lunex" can never appear even if a legacy row survives.
- **Mobile-first grid**:
  - Cards: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`, `gap-3 sm:gap-4`.
  - Cycle selector: `grid-cols-2 gap-2` on mobile (already), tighten padding to `p-2.5` so 4 labels fit ≤360px.
  - Every card row uses `grid-cols-[minmax(0,1fr)_auto]` with `min-w-0` + `truncate` on the label and `shrink-0` on the value, so long numbers never push the Upgrade button outside.
  - Card container: `p-4`, `rounded-xl`, `overflow-hidden`; Upgrade `<Button className="w-full">` stays inside.
  - Comparison table: keep desktop table, but drop `overflow-x-auto` on mobile (mobile uses the accordion already; ensures no horizontal scroll on the page itself).
  - Wrap the whole page in `max-w-full overflow-x-hidden` guard to catch any stray overflow from child sections.
- **Show real limits** (already wired via `formatLimit`) — confirm with seeded values after migration:
  - Free: 20 products / 50 orders / 100 MB / 0 staff
  - Basic: 200 / 500 / 1 GB / 2
  - Business: e.g. 1000 / 5000 / 5 GB / 5 (updated in migration)
  - Custom: Unlimited across the board.
- **Feature summary bullets** (new small block above the checklist) — read `p.feature_summary` if present.

## 3. Backend feature gating

Add real gating so a store on Free can't reach Business-only pages.

### 3a. Reusable component `src/components/admin/FeatureGate.tsx`
- Props: `feature: FeatureKey`, `children`.
- Reads `myBillingStatus` via TanStack Query (cached; same key as the billing page — no extra request).
- If `hasFeature(store, feature)` → render children.
- Else → render a compact "Upgrade Required" card: lock icon, feature label, "Available on Business plan" (looked up from `PLAN_ROWS`), and a `Link to="/admin/billing"` "View Plans" button. Also disables the sidebar link visual state via a `data-locked` attribute (optional polish).

### 3b. Server-side guards
Extend the existing server functions that write feature-gated data to reject when the store lacks the feature. Central helper `assertFeature(context, key)` in `src/lib/admin.functions.ts`:
- Fetches `stores` row + package for `context.userId`, throws `Error("Feature not available on your plan")` when `hasFeature` is false.
- Wire into the mutating fns for: coupons, expenses/finance, returns, inventory stock movements, import/export, bulk product ops, customer notes, staff invites, courier/pixel settings save, AI agent config, messenger config.
  Read-only lookups stay open (UI already hides them).

### 3c. Route-level wrap
Wrap the page component in each feature-owning route with `<FeatureGate feature="…">`:
- `admin/ai-agent.tsx` → `ai_agent`
- `admin/messenger.tsx` → `ai_messenger`
- `admin/couriers.tsx` → `courier`
- `admin/analytics.tsx` → `analytics`
- `admin/inventory.tsx` → `inventory`
- `admin/invoice.$orderId.tsx` → `invoice`
- `admin/coupons.tsx` → `coupons`
- `admin/import-export.tsx` → `import_export`
- `admin/returns.tsx` → `returns`
- `admin/customers.tsx` (notes tab only) → `customer_notes`
- `admin/marketing.tsx` (pixel section) → `pixel`
- Bulk-action toolbar in `admin/products.tsx` → hide when `!hasFeature('bulk_actions')`.

Trial (`is_trial`) still unlocks everything via existing `hasFeature`.

### 3d. Sidebar lock icons
In `src/routes/_authenticated/admin/route.tsx`, add a small 🔒 icon next to nav items whose feature is off. Click still navigates — the FeatureGate on the target page shows the upgrade CTA. No behavioral redirects (keeps things fast, avoids loops during trial→free transition).

## 4. Performance

- No new queries: `FeatureGate` shares the `["admin","billing"]` cache with the billing page (5-minute staleTime).
- No animations added; existing CSS transitions untouched.
- Card grid uses static Tailwind utilities — no runtime style computation.

## What is NOT changing
- Billing server functions signatures, checkout flow, payment history, discount math.
- Router, auth gate, or storefront.
- Feature key list in `src/lib/features.ts` (only additive: `assertFeature` helper).

## Technical notes
- Migration is data-only; no `CREATE TABLE`, no new GRANTs needed.
- `TIER_NAME` map already exists in `billing.tsx`; just render it wherever `pkg?.name`/`p.name` is currently shown as the plan title.
- `assertFeature` throws a friendly `Error` — client mutations already show `error.message` via toast, so no extra UI wiring needed.
- Mobile test target: 360×640 (smallest common Android) and 320×568 (iPhone SE 1). Grid + `min-w-0` pattern is the standard fix from the responsive-layout rules.
