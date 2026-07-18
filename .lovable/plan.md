## Goal

A dedicated **Subscription Payment Gateway** module in the Winner Admin Panel that handles ORZEN plan payments (Free / Basic / Business / Custom) end-to-end. Modular provider architecture so the Winner Admin can add / replace / enable / disable providers at any time without touching the subscription logic. Store customer payments remain untouched.

## Architecture (pluggable providers)

```text
src/lib/subscription-pay/
  providers/
    types.ts              # SubscriptionPaymentProvider interface
    registry.ts           # id -> provider adapter map
    sslcommerz.ts         # first shipped adapter (server-only)
    bkash.ts              # stub adapter (disabled)
    manual.ts             # manual/offline verify fallback
  pay.functions.ts        # initiatePayment / verifyPayment / handleWebhook
  pay.server.ts           # provider dispatch + secret loading
  invoice.server.ts       # PDF invoice generation
  email.server.ts         # Resend email send
```

Each adapter implements:

```ts
interface SubscriptionPaymentProvider {
  id: string;              // "sslcommerz", "bkash", ...
  label: string;
  methods: string[];       // ["bkash","nagad","visa",...]
  supportsSandbox: boolean;
  testConnection(cfg): Promise<{ok:boolean; message:string; latency_ms:number}>;
  createCheckout(ctx): Promise<{redirect_url:string; provider_ref:string}>;
  verifyPayment(ctx): Promise<{status:"paid"|"failed"|"pending"; amount:number; currency:string; raw:any}>;
  parseWebhook?(req): Promise<{provider_ref:string; status:string; raw:any}>;
}
```

Subscription activation code never imports a provider directly — it calls `pay.server.ts`, which dispatches to the active provider via `registry`.

## Data model (one migration)

New tables (all with GRANTs + RLS + `TO service_role` full access):

- `subscription_payment_providers` — one row per registered provider (id, label, is_active, enabled, sandbox, credentials jsonb, status, last_tested_at, latency_ms). Only one row may have `is_active=true`. Owner-only SELECT/UPDATE.
- `subscription_invoices` — invoice_no, store_id, user_id, package_id, billing_cycle (monthly/3m/6m/yearly), amount, discount, coupon_id, tax, total, currency, status (pending/paid/failed/refunded), pdf_path, issued_at, paid_at.
- `subscription_transactions` — invoice_id, provider_id, provider_ref, method, amount, status (initiated/pending/success/failed/cancelled), sandbox bool, raw jsonb, created_at, verified_at. Indexed by (provider_id, provider_ref).
- `subscription_coupons` — code (unique upper), type (percent/fixed), value, min_amount, applies_to_packages uuid[], applies_to_cycles text[], usage_limit, used_count, starts_at, expires_at, active. Owner-managed.
- `subscription_coupon_redemptions` — coupon_id, invoice_id, user_id, amount_off, redeemed_at.

RPC `validate_subscription_coupon(_code, _package_id, _cycle, _amount)` mirrors existing `validate_coupon` shape.

Store owners have SELECT on their own `subscription_invoices` / `subscription_transactions` (via `owner_user_id`). Coupons + provider config are owner-only.

## Server functions (`src/lib/subscription-pay/pay.functions.ts`)

All `requireSupabaseAuth` (owner-only where noted):

- `listProviders()` / `getActiveProvider()` — owner only.
- `saveProvider({id, credentials, sandbox, enabled})` — owner only. Credentials stored server-side; never returned to client (only masked preview + `has_credentials` boolean).
- `setActiveProvider(id)` — owner only.
- `testProviderConnection(id)` — owner only; calls adapter `testConnection`, persists status/latency.
- `initiateSubscriptionCheckout({package_id, cycle, coupon_code?})` — authenticated store owner. Computes amount from `subscription_packages` + billing cycle discount (`get_billing_discounts`) + coupon. Creates `subscription_invoices` (pending) + `subscription_transactions` (initiated). Calls active adapter `createCheckout`, returns `redirect_url`.
- `verifyAndActivate({provider_ref})` — called from the return URL. Verifies via adapter, on success: marks invoice paid, updates `stores.package_id / expires_at / last_renewed_at / subscription_status='active'`, generates PDF invoice, emails receipt, records coupon redemption.
- `listSubscriptionPayments({filters})` — owner dashboard feed.
- `subscriptionPaymentsStats()` — totals + monthly revenue + counts by status for the dashboard.

## Server routes (raw HTTP)

- `src/routes/api/public/subscription-pay/webhook.$provider.ts` — POST endpoint per provider. Verifies signature inside the adapter, then calls `verifyAndActivate`. Public prefix, self-authenticated per provider.
- `src/routes/api/public/subscription-pay/return.ts` — GET callback used by hosted checkouts; forwards to a client route that calls `verifyAndActivate`.

## Coupons

New table + owner CRUD UI at `/owner/subscription-coupons` (list, create, toggle active, edit). Storefront-facing coupon entry lives on the store-admin checkout page. Reuses the `validate_subscription_coupon` RPC. Redemption row written atomically inside `verifyAndActivate`.

## Invoice + email

- `invoice.server.ts` builds an HTML invoice with brand tokens, renders to PDF via `@react-pdf/renderer` (Worker-compatible; falls back to a Puppeteer-free path). PDF stored in Supabase Storage bucket `subscription-invoices` (private). Signed URL returned to owner.
- `email.server.ts` uses the existing Resend connector to send:
  - Payment receipt (with PDF attachment + signed link).
  - Payment failure notice.
  Subject/body pulled from a template file, brand color from `platform_settings`.

If Resend connector is not linked yet, the plan surfaces a step to link it before enabling emails; module works without it (email step is a no-op with a warning).

## Winner Admin UI

New menu group **"Subscription Payments"** in `src/routes/_authenticated/owner/route.tsx` with three routes:

1. `/owner/subscription-pay` — **Dashboard**
   - Cards: Gateway Status, Connected Provider (+ mode badge), Total Payments, Successful, Failed, Pending, Monthly Revenue.
   - Recent Transactions table (customer, plan, cycle, amount, method, status, date, actions: view invoice, resend email, mark refunded).
   - Mobile: cards stack, transactions become card list.

2. `/owner/subscription-pay/providers` — **Provider Management**
   - List of registered providers with status pills (Connected / Disabled / Missing credentials / Sandbox).
   - Connect / Configure drawer per provider: credential fields defined by adapter metadata, sandbox switch, enable switch, Test Connection button with latency + error banner, Set Active button. Disconnect clears credentials.

3. `/owner/subscription-coupons` — **Coupons**
   - CRUD table for subscription-only coupons, scoped to packages + billing cycles, with usage stats.

Design: reuse existing owner card style, Sonner toasts, mobile-first (single column < 640px), Sparkles/CreditCard icons.

## Store-owner checkout flow

Update `/admin/billing/checkout/$packageId`:

1. Select billing cycle (monthly / 3m / 6m / yearly). Discount pulled from `get_billing_discounts` RPC.
2. Optional coupon input → `validate_subscription_coupon`.
3. Show final total + method icons from active provider.
4. "Pay & Activate" → `initiateSubscriptionCheckout` → redirect to provider.
5. Return route hits `verifyAndActivate`, shows success screen with invoice download + email confirmation status, then routes to `/admin/billing`.

Failure path: shows retry + "Try different method" + link back to plans.

If no active provider is configured, checkout shows a soft banner: "Payments are being set up. Please contact support." and the Pay button is disabled — subscription table is untouched.

## First shipped provider

**SSLCommerz** adapter (`sslcommerz.ts`):

- Fields: `store_id`, `api_key`, `sandbox`.
- `createCheckout` posts to SSLCommerz Session API, returns `GatewayPageURL`.
- `verifyPayment` calls Validator API with `val_id` from return payload.
- `parseWebhook` verifies IPN signature.
- Methods advertised: bKash, Nagad, Rocket, Visa, Mastercard, Amex, Bank, Internet Banking.

Stubs registered but disabled: `bkash`, `nagad`, `manual`. Adding a new provider = one file in `providers/` + one row in registry — no other code changes.

## Security

- Provider credentials stored in `subscription_payment_providers.credentials` (jsonb) accessed only from server functions via `supabaseAdmin`. Never returned to the client raw.
- Webhook routes verify provider signature before writes; use `supabaseAdmin` inside handler only.
- Coupon validation server-side; client only sees `{ok, discount}`.
- Invoice storage bucket private; access via signed URL from server function.
- `assertPlan` untouched — this module manages plan activation itself and updates `stores` via `supabaseAdmin` after verified payment.

## Out of scope (explicit)

- Store customer checkout / payments_config / SSLCommerz-for-storefront — untouched.
- Migrating existing manual bKash/Nagad owner "Payment Settings" (kept as-is for backward compatibility; a follow-up can retire it).
- Refund workflow beyond a manual "mark refunded" toggle.
- Multi-currency (BDT only for now).

## Deliverables checklist

- [ ] Migration: 5 tables + `validate_subscription_coupon` RPC + storage bucket + policies + grants.
- [ ] `src/lib/subscription-pay/*` (types, registry, adapters, functions, server helpers, invoice, email).
- [ ] Server routes: webhook per provider + return handler.
- [ ] Owner UI: dashboard, providers, coupons + nav entry.
- [ ] Admin billing checkout upgrade (cycle + coupon + real gateway).
- [ ] Resend template + PDF invoice generator.
- [ ] Typecheck + build clean.
