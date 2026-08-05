# Remove Global Subscription Settings — Move Config to Subscription Product

## Goal

Subscription behaviour becomes fully product-based. The Store Settings → Subscription Settings page disappears, and each subscription product carries its own billing plans, trial, pricing and renewal rules.

## 1. Delete the global Subscription Settings page

- Remove the settings route and its section component.
- Remove the "Subscription Settings" tab from the Settings tab bar and the collapsible Settings submenu in the admin sidebar.
- Old `/admin/settings/subscription` URL redirects to `/admin/settings/information` so no bookmark breaks.
- Remove the admin load/save server functions for these settings.

## 2. Where the store-level leftovers come from

Per your choice, these keep working from the store's existing global settings instead of a subscription-only page:

| Field | New source |
|---|---|
| Tax % | Store tax settings already used by other checkouts |
| Invoice prefix | Store Configuration → Invoice Numbering |
| Cash on Delivery / payment methods | Store Payment Gateway settings |
| Success redirect | Store checkout behaviour (unchanged default) |
| Email / SMS / WhatsApp | Store notification system + order workflow |

Nothing subscription-specific is duplicated anywhere.

## 3. Multiple billing plans per subscription product

New step in the Subscription product Add/Edit form: **Billing Plans**.

- Add as many plans as needed. Each plan has: label (e.g. "3 Months"), duration + unit (or Lifetime), price, optional compare-at/discount, optional "Most popular" badge, and a default flag.
- Presets for fast entry: 1 / 2 / 3 / 6 / 12 months, Lifetime.
- At least one plan required; exactly one is the default.
- Existing single-cycle products keep working — on open, the current cycle + price is shown as one plan, so nothing is lost.

## 4. Per-product trial and renewal

Already in the form and stays there, now as the only source of truth:

- Trial: enabled/disabled, duration + unit (3 days, 7 days, 30 days, none).
- Setup fee, renewal price mode, grace period, renewal/expiry reminder days, auto/manual renewal, upgrade & downgrade rules.
- Product-level policies (refund / cancellation / renewal / terms) stay on the product.

## 5. Checkout picks the plan

- Subscription checkout shows a plan selector (all plans of that product, price + savings, default preselected). Lifetime shows "one-time".
- Trial banner, setup fee, totals and next-renewal date all recalculate from the selected plan.
- No more reads of global subscription settings; tax comes from store settings, payment methods from the store's enabled gateways.

## 6. Server side

- Subscription creation, invoicing and the renewal cron read cycle, price, trial, grace and reminder values from the chosen product plan; store settings are only consulted for tax and invoice prefix.
- The selected plan is stored on the order/subscription record so renewals stay on the right cycle.
- Existing subscriptions keep their stored cycle and price — no data migration needed and no live subscription changes behaviour.

## Technical notes

- Delete: `src/routes/_authenticated/admin/settings.subscription.tsx`, `src/components/admin/settings/SubscriptionSettingsSection.tsx`; drop the tab entry in `settings.tsx` and the sidebar item in `admin/route.tsx`.
- Extend `subscription-meta.ts` with a `plans: BillingPlan[]` array and a `selected_plan_id` on the cart/checkout payload; keep legacy `billing_cycle` fields readable for old products.
- New Billing Plans step inside `SubscriptionProductDialog.tsx` (repeatable rows, same StepCard pattern as Access/Usage steps).
- `SubscriptionCheckout.tsx`: replace `getPublicSubscriptionSettings` usage with product plan data; keep the store payment-method fetch.
- `subscriptions.server.ts`: replace `loadSettings(...)` fallbacks for cycle/price/trial/grace/reminders with plan-derived values; retain tax and invoice-prefix lookups from store-level settings.
- `store_subscription_settings` table is left in place (unused) so no destructive migration runs; it can be dropped later once verified.
