# Subscription Checkout & Billing System (Professional)

A fully isolated subscription experience — its own checkout, data model, activation, renewal, success page, customer dashboard, admin management and settings. Nothing is shared with Physical, Digital or Service checkout.

Renewal model (confirmed): **reminder + manual renew link**. On each cycle the system creates a renewal invoice and emails a secure pay link; no card is stored. "Auto renewal" means automatic invoice + reminder, not silent charging.

---

## 1. Data model (new tables)

- `store_subscription_settings` — per store: auto-renewal default, default billing cycle, free trial on/off + duration, grace period, renewal reminder days, failed-payment retry, cancellation policy, refund policy, setup fee, tax %, invoice prefix, invoice template, success redirect URL, allowed payment methods, COD-enabled flag (off by default).
- `store_subscriptions` — the subscription record: human-readable subscription ID, store, customer, product/plan, plan snapshot (name, features, limits), billing cycle, status (`pending`, `trialing`, `active`, `past_due`, `grace`, `suspended`, `cancelled`, `expired`), price, renewal price, currency, started_at, current_period_start/end, next_billing_date, trial_ends_at, auto_renew, reminders_opt_in, cancel_at_period_end, user/device/license limits.
- `store_subscription_invoices` — one row per billing period: invoice no, amount breakdown (plan, setup fee, tax, discount), due date, status (`draft`, `open`, `paid`, `failed`, `void`), paid_at, payment method, order reference, secure pay token.
- `store_subscription_events` — audit + timeline: created, activated, renewed, upgraded, downgraded, suspended, cancelled, payment failed, reminder sent.
- `store_subscription_notifications` — outbox rows for the 7 notification types, consumed by the existing email queue.

All tables: GRANTs, RLS with store-owner policies; storefront customer access goes through SECURITY DEFINER RPCs validated by the customer session token (same pattern as service orders).

## 2. Subscription checkout (storefront)

New `src/components/storefront/checkout/SubscriptionCheckout.tsx`, dispatched from `checkout.tsx` when the cart is subscription-only (mirrors the existing digital/service branches). Physical/digital/service branches untouched.

- **Customer info** — required: full name, phone, email, country/region. Optional: company, VAT/tax number, notes. No address, area, zone, courier fields at all.
- **Subscription details card** — plan name, selected plan/variant, billing cycle, plan price, included features, trial info, user limit, device limit, license quantity, access start, auto-renewal status. All read from `products.meta.subscription`.
- **Billing summary** (replaces shipping summary) — subscription price, coupon discount, setup fee, tax, today's payment, renewal amount, renewal date, total due today. No shipping line anywhere.
- **Payment methods** — online only by default: Rupantor Pay, SSLCommerz, Stripe, PayPal, bKash, Nagad, Rocket, Bank Transfer, filtered by what the store has configured. COD hidden unless the admin explicitly enables it in Subscription Settings.
- **Agreement block** — required: agree to Subscription Terms, understand billing cycle. Optional: enable auto renewal, receive renewal reminders. Submit disabled until required boxes are ticked.
- **CTA** — "Subscribe Now" (or "Continue to Payment" for redirect gateways).

## 3. Activation flow

New `subscription-checkout.functions.ts` + `.server.ts` (isolated from `placeOrder`):
- Creates the order with `order_type = subscription`, subscription record (status `pending`, or `trialing` when a trial applies), first invoice, billing record, subscription ID, and links it to the customer account.
- On payment success (gateway webhook or manual approval): activate plan, compute `next_billing_date` from the cycle, generate the PDF invoice, mark the invoice paid, write timeline events, send confirmation email (SMS hook optional/off by default).
- Redirect to the Subscription Success page (or the admin's custom success URL when set).

## 4. Subscription success page

Dedicated route/view: success animation, "Subscription Activated", subscription ID, plan name, current status, activation date, next billing date, renewal amount, payment method, plus Invoice Download / Manage Subscription / Go to Dashboard buttons. Replaces the current generic `SubscriptionOrderView` for the post-checkout path.

## 5. Customer dashboard

New "Subscriptions" tab in the storefront account area: current plan, status, renewal date, payment history, invoice downloads, cancel, upgrade, downgrade, renew now (pay link), enable/disable auto renewal. Backed by token-validated RPCs.

## 6. Store Admin — Subscription Management

New admin page `Subscriptions`: subscriber list with search/filters and KPI strip (active, trialing, past due, MRR). Per-subscriber drawer with activate, suspend, cancel, renew, change billing cycle, upgrade/downgrade plan, apply discount, extend/change expiry date, send notification, generate invoice, and full payment history + event timeline.

## 7. Subscription Settings (admin)

New settings section covering every control in the spec: auto renewal, default cycle, free trial + duration, grace period, renewal reminder, failed-payment retry, cancellation & refund policy, setup fee, tax, invoice prefix, invoice template, success redirect URL, and the COD override.

## 8. Renewal engine

Cycle support: monthly, quarterly, semi-annual, yearly, lifetime (never renews), weekly and custom. A public cron route (`/api/public/cron/subscription-renewals`) runs daily to: advance periods, open renewal invoices, send reminders ahead of renewal, apply grace period, mark `past_due` then `expired`, and honour `cancel_at_period_end`.

## 9. Notifications

Seven automated events — activated, payment received, upcoming renewal, expiring, renewed, payment failed, cancelled — dispatched through the existing email queue, with SMS/WhatsApp channels wired as optional toggles.

## 10. Guardrails

Subscription checkout never renders shipping, delivery, courier, parcel tracking, delivery address, delivery zone, or COD (unless manually enabled). Each product type keeps its own checkout component, validation, server functions and success page, sharing only the ORZEN design language.

---

## Technical notes

- New files: `src/lib/subscriptions.ts` (shared types/cycle math), `subscriptions.functions.ts` (customer), `subscriptions-admin.functions.ts` (admin), `subscriptions.server.ts` (activation/renewal engine), `SubscriptionCheckout.tsx`, `SubscriptionSuccess.tsx`, `SubscriptionsTab.tsx`, admin `subscriptions.tsx` route + settings section, cron route.
- Storefront reads use SECURITY DEFINER RPCs with the customer token; admin reads use `requireSupabaseAuth` scoped by store ownership.
- Billing cycle maths and next-date calculation live in one shared module so checkout, admin and cron agree.
- Migrations are applied first; code that depends on the new schema follows.
