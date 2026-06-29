# Subscription & Payment System

Builds on what already exists (`subscription_packages`, `stores.package_id/expires_at`, `payments`, owner Packages page, admin Subscription page). Nothing existing is duplicated — fields are added, status enforcement is added, and a renewal flow is added.

## 1. Database (one migration)

Extend `subscription_packages`:
- `description text`, `is_trial boolean default false`, `trial_days int default 0`
- `order_limit int`, `customer_limit int`, `staff_limit int`, `storage_mb int`
- `billing_cycle text default 'monthly'` (`monthly | 2m | 3m | 6m | yearly | custom`)
- `features jsonb default '{}'` — feature flags map (see §3)
- `sort_order int default 0`

Extend `stores`:
- `trial_ends_at timestamptz`
- `subscription_status text default 'trialing'` (`trialing | active | expired | suspended | cancelled`)
- `last_renewed_at timestamptz`

Extend `payments`:
- `invoice_no text`, `cycle_start date`, `cycle_end date`, `verified_by uuid`, `verified_at timestamptz`, `notes text`
- unique index on `(store_id, invoice_no)`

New table `platform_payment_settings` (single row keyed by `id='global'`, owner-only):
- `bkash jsonb`, `nagad jsonb`, `rocket jsonb`, `sslcommerz jsonb` — each `{ enabled, number|store_id, api_key, instructions }`. API credentials stored only here, never returned to non-owners.

New table `subscription_notifications`:
- `store_id`, `type` (`trial_started|trial_expiring|expired|payment_success|payment_failed|renewal_reminder`), `sent_at`, `meta jsonb`. Read by store owner, written by server fns.

Trigger / function `public.start_trial_for_store()` — on `stores` insert, if no `package_id`, set `package_id` = first `is_trial=true` package, `trial_ends_at = now() + trial_days`, `expires_at = trial_ends_at`, `subscription_status='trialing'`, and write a `subscription_notifications` row.

Function `public.refresh_store_subscription_status(_store_id uuid)` — recomputes `subscription_status` from `expires_at` (sets `expired` when past), called from server fns after payment / assign / cron.

GRANTs follow existing pattern (authenticated for owner-scoped tables, anon for `subscription_packages` SELECT only).

## 2. Server functions

`src/lib/billing.functions.ts` (new):
- `listPublicPlans()` — anon, returns active non-trial packages for the upgrade page.
- `myBillingStatus()` — auth, returns store + plan + days_left + status + recent payments + active notifications.
- `submitManualPayment({ packageId, method, txn_id, amount, sender_number })` — store owner; inserts `payments` row with `status='pending'` and notifies owner.
- `startSslcommerzCheckout({ packageId })` — store owner; creates pending payment, returns gateway redirect URL (uses creds from `platform_payment_settings`). Stubbed with clear TODO if creds blank.

`src/lib/owner.functions.ts` (extend):
- `upsertPackage` — accept new fields (features, limits, billing_cycle, trial).
- `listPayments({ status?, from?, to? })`, `verifyPayment({ id, approve })` — on approve: marks paid, advances `stores.expires_at` by package duration, sets `subscription_status='active'`, writes timeline + notification.
- `extendSubscription({ storeId, days })`, `setStoreSubscriptionStatus({ storeId, status })`.
- `revenueStats()` — today / month / year / total + counts of trialing / active / expired / suspended + renewal rate (paid renewals ÷ expiring last 30d).
- `getPaymentSettings` / `updatePaymentSettings` — owner only.

Server route `src/routes/api/public/billing/sslcommerz-ipn.ts` — verifies signature against stored secret, marks matching payment paid, advances expiry. Public path, signature-verified (no auth header).

Cron via `pg_cron` + `pg_net` daily: hits `/api/public/billing/daily-refresh` which (a) sets expired stores, (b) inserts `trial_expiring` / `renewal_reminder` notifications for stores with ≤3 days left and none sent in last 24h. Endpoint authenticated by `apikey` header (anon key).

## 3. Feature flags (no-code gating)

A single source of truth: `src/lib/features.ts` exports `FEATURE_KEYS` (`ai_agent`, `ai_messenger`, `pixel`, `courier`, `inventory`, `coupons`, `invoice`, `analytics`, `import_export`, `bulk_actions`, `staff`, `customer_notes`, `returns`). Helper `hasFeature(store, key)` reads `store.subscription_packages.features[key]`; trial package returns true for all.

`getMyStore` already returns the joined package — extend the projection to include `features`, `subscription_status`, `trial_ends_at`. Hook `useStoreFeatures()` exposes a memoized map.

Apply gating non-invasively:
- Sidebar entries in `_authenticated/admin/route.tsx` hide items whose feature is off.
- Each gated page renders an `<UpgradeRequired feature="..." />` card when off (one shared component) — no logic deleted from the existing pages.
- A top-level `<StoreStatusBanner />` in the admin layout shows trial countdown, expiring warning, or "Read-only — please renew". When `subscription_status` is `expired | suspended`, the admin server mutations short-circuit via a new `assertActiveSubscription` helper used by write fns in `admin.functions.ts`, `inventory.functions.ts`, `coupons.functions.ts`, etc.

Storefront stays online for read-only when expired; checkout fn rejects new orders with a polite message when status is `expired | suspended`.

## 4. Owner panel (new + updated routes)

- `owner/packages.tsx` — extend dialog to a tabbed form: General / Limits / Features (checkbox list from `FEATURE_KEYS`) / Trial / Status. Drag-free sort via number input.
- `owner/billing.tsx` (new) — revenue cards (today/month/year/total, active/trial/expired, renewal rate), recent payments table, status filter, "Verify"/"Reject" actions.
- `owner/payment-settings.tsx` (new) — enable + credentials per gateway (bKash/Nagad/Rocket/SSLCommerz), connection status pill (green if creds present & enabled).
- `owner/subscriptions.tsx` (new) — store list with status tabs (All / Trial / Active / Expired / Suspended), per-row actions: Upgrade (change package), Extend days, Suspend / Reactivate.
- Sidebar in `owner/route.tsx` gets 3 new links: Billing, Subscriptions, Payment Settings.

## 5. Store admin panel (new routes)

- `_authenticated/admin/billing.tsx` — current plan card, trial / days-left badge, plan comparison table, "Renew / Upgrade" CTA.
- `_authenticated/admin/billing.checkout.$packageId.tsx` — choose method, show owner-configured instructions, capture txn_id + sender number → `submitManualPayment`; "Pay with SSLCommerz" button when enabled.
- Existing `subscription.tsx` stays as payment history (no duplication).

## 6. Notifications

Stored in `subscription_notifications`; a small bell badge in admin layout shows unread counts. No email/SMS provider added — UI + DB only (extensible later via the same helper).

## 7. Performance

- All new lists paginated 50/page; queries project narrow columns.
- Feature gating computed once per request, memoized client-side.
- No new heavy deps; SSLCommerz call uses native `fetch`.
- All new routes lazy-loaded by file-based routing.

## Open question

Payment verification model: should bKash/Nagad/Rocket stay **manual** (owner approves pending payments — matches existing storefront pattern, zero API setup), or do you want me to wire one of them to its live gateway API? I'll proceed manual + SSLCommerz live (with creds stored in payment-settings) unless you say otherwise.
