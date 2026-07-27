# Provider Website & Docs Links (Payment Gateways)

Make the "Visit Provider Website" and "Read API Docs" links data-driven per provider, managed centrally from Winner Admin, and rendered on every Store Admin provider connection page.

## 1. Database

Migration on `public.platform_payment_gateways`:
- Add `website_url text`
- Add `docs_url text`

Backfill existing rows with the current hard-coded docs URLs from `src/components/admin/payments/providers.ts` (`docsUrl`) so nothing regresses on first load. Website URLs left null unless already known (Stripe, PayPal, SSLCommerz, ShurjoPay, AmarPay, PortWallet, bKash, Nagad, Upay, BDGate, NagorikPay, PaybyBD, Fastaar, PayBD, iPayBD, UrbdPay).

No RLS changes — table already readable by owners and writable by winner admins.

## 2. Winner Admin – Brand Assets page

File: `src/routes/_authenticated/owner/brand-assets.tsx`

For each provider row, add two inputs under the existing branding fields:
- Official Website URL (`website_url`)
- API / Developer Documentation URL (`docs_url`)

Both optional, URL-typed with light validation (must start with `https://` or be empty). Saved through the existing update mutation (extend the payload + server fn to accept the two new columns).

## 3. Server functions

File: `src/lib/store-payments.functions.ts`
- `listStorePaymentGateways` / owner list functions: include `website_url` and `docs_url` in the SELECT and returned shape.

Winner update fn (wherever brand-assets currently saves): whitelist the two new fields.

## 4. Store Admin – Provider connection page

File: `src/routes/_authenticated/admin/payment-gateway.tsx` (provider header block).

Below the existing `[Logo] Provider Name / description` header, render a button row:
- `Visit Provider Website` → `website_url` (only if present)
- `Read API Docs` → `docs_url` (only if present)
- Both missing → render nothing (remove the current always-on "Read docs" fallback that uses the static registry).

Buttons:
- Open in new tab, `rel="noopener noreferrer"`.
- Primary button uses the provider's `brand_color` as background with white text; secondary uses outline styled with the same brand color for border/text — falls back to theme tokens if `brand_color` missing.
- `flex flex-wrap gap-2 w-full sm:w-auto`, buttons `w-full sm:w-auto` for mobile.

Remove hard-coded `docsUrl` reads from `providers.ts` in the header render path (keep the constant file intact for other metadata so nothing else breaks).

## 5. Non-goals / preserved

- No changes to credential forms, webhooks, encryption, adapters, or registry.
- `PAYMENT_BRANDS.docsUrl` stays in the file as legacy fallback but is not used to render buttons.
- No new provider-specific URLs hard-coded in the frontend.

## Technical notes

```text
platform_payment_gateways
├─ website_url  text  (nullable)
└─ docs_url     text  (nullable)
```

Header render logic:

```text
if (!website_url && !docs_url) → no button row
else render [Website?] [Docs?] with brand_color styling
```
