# Feature Access Manager for Subscription Plans

## Goal

Give the Owner one place to manage which features every subscription plan unlocks. Toggles are stored in the database (not hard-coded), apply immediately to every store on that plan, and adding a new feature never requires editing core gating logic.

## Current state

- `platform_feature_flags` table already exists (Owner → Features page) as a global on/off registry of features.
- Each plan stores its own `features` JSON on `subscription_packages`, edited inside the package dialog's "Features" tab.
- `FeatureGate` / `hasFeature` read a hard-coded `FEATURE_KEYS` array in `src/lib/features.ts`. Adding a feature today means editing that constant + the package dialog.

The two systems don't talk to each other, and the feature list isn't scalable.

## What changes

### 1. Feature registry becomes the source of truth
- `platform_feature_flags` is promoted to the master catalog of features (key, label, description, category, default_enabled, sort_order).
- `FEATURE_KEYS` / `FEATURE_LABELS` in `src/lib/features.ts` are replaced by a runtime-loaded list fetched from the registry (still typed as `string` keys). Existing hard-coded keys are seeded into the table via a migration so nothing breaks.

### 2. New Feature Access Manager UI (Owner)
New page: **Owner → Plans → Feature Access** (added as a tab on `owner/packages.tsx`, or a dedicated route `owner/plan-features.tsx`).

Layout:

```text
                    Starter   Basic   Pro   Business   Trial
AI Sales Agent        ☐        ☐      ☑       ☑         ☑
AI Messenger          ☐        ☐      ☑       ☑         ☑
Coupons               ☐        ☑      ☑       ☑         ☑
Inventory             ☐        ☑      ☑       ☑         ☑
...
[+ Add feature]                                     [Save all]
```

- Rows = features from the registry (grouped by category).
- Columns = every active subscription package.
- Each cell is an independent toggle; changes are batched and saved with one "Save" action (or auto-saved per toggle with optimistic UI + toast).
- "Add feature" opens a dialog to register a brand-new feature (key + label + category); it appears as a new row instantly and can then be toggled per plan — no code change needed.
- Trial packages keep the existing "unlocks everything" behaviour; row is shown as read-only ☑ for trial columns.

The existing per-package Features tab inside the package dialog stays and reads from the same registry so both flows edit the same data.

### 3. Runtime enforcement
- `hasFeature(store, key)` keeps its signature but reads `store.subscription_packages.features[key]`, which is what the manager writes. No consumer changes required.
- `FeatureGate` and every gated admin page (ai-agent, analytics, coupons, couriers, inventory, messenger, returns, import-export) already funnel through `hasFeature` — they pick up new toggles automatically.
- Because the store's plan row is queried live (with a short React Query staleTime), owner toggles propagate to all users of that plan on their next page/query refresh.

### 4. Scalability
- Adding a feature = insert one row in `platform_feature_flags` via the UI. Every plan gets it as "disabled" by default until the owner toggles it on.
- To gate a new UI section in code, developers just call `<FeatureGate feature="new_key">` — no enum edits.

## Technical details

### Migration
- `platform_feature_flags`: add `label text`, `sort_order int default 0` if missing; keep `flag_key`, `enabled` (used as `default_enabled`), `description`, `category`.
- Seed rows for every existing key in `FEATURE_KEYS` with their current labels (idempotent `ON CONFLICT (flag_key) DO NOTHING`).
- RLS: already owner-only writes, authenticated read.

### Server functions (new / extended in `src/lib/owner.functions.ts`)
- `listFeatureCatalog()` — returns registry rows, ordered by category + sort_order. Authenticated read.
- `listPlanFeatureMatrix()` — returns `{ packages: [{id,name,is_trial}], features: [{key,label,category}], matrix: { [packageId]: { [featureKey]: boolean } } }`.
- `setPlanFeature({ packageId, featureKey, enabled })` — owner-only, updates the package's `features` JSON with a JSONB merge.
- `bulkSetPlanFeatures({ updates: [{packageId, featureKey, enabled}] })` — for "Save all" batch mode.
- `registerFeature({ flag_key, label, category, description })` — owner-only insert into registry.

### Client changes
- `src/lib/features.ts`: keep `hasFeature` / `isReadOnly`; deprecate the const `FEATURE_KEYS`/`FEATURE_LABELS` (kept as fallback but no longer the source of truth for the UI).
- New route `src/routes/_authenticated/owner/plan-features.tsx` with the matrix grid, using shadcn `Table` + `Switch`.
- Update `packages.tsx` Features tab to render checkboxes from `listFeatureCatalog()` instead of the constant.
- Add a link to the new page from the packages page header.

### Immediate propagation
- On save, invalidate `["owner","packages"]`, `["admin","billing"]`, and broadcast via existing React Query staleTime (5 min). For faster propagation, drop `admin/billing` staleTime to 60 s so users see toggles within a minute without a manual reload.

## Out of scope

- Per-store feature overrides (only per-plan for now).
- Feature usage analytics / audit log for toggles (can be added later using the existing `role_audit_log` pattern).
- Removing a feature key from the registry when it's still referenced in code (soft-delete only).

## Deliverables

1. Migration seeding the feature registry and ensuring schema.
2. New/extended server functions listed above.
3. New Owner "Feature Access" page with per-plan matrix + add-feature dialog.
4. Updated package dialog Features tab reading from the registry.
5. `hasFeature` unchanged externally, so all existing gates keep working.
