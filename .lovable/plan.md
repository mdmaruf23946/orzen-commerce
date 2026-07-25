
# Payment Gateway UI/UX Professional Upgrade

Scope: Store Admin → Payment Gateway page and its provider adapters. Winner Admin toggle page is untouched. All existing server functions (`listStorePaymentGateways`, `saveStorePaymentGateway`, `testStorePaymentGateway`, `setActiveStorePaymentGateway`, `toggleStorePaymentGateway`, `disconnectStorePaymentGateway`) keep their signatures; we only extend provider metadata and the UI.

## 1. Provider branding registry

New file `src/components/admin/payments/providers.ts` — central registry for all 8 providers (SSLCommerz, ShurjoPay, AmarPay, PortWallet, Stripe, PayPal, bKash, Manual/Bank Transfer):

- `id`, `label`, `tagline`, `brandColor` (hex), `accentColor`, `logo` (inline SVG component or `/assets` PNG), `icon` (lucide fallback), `docsUrl`, `region`.
- Consumed by the card, the config sheet, badges, loading spinners, and success/error toasts so branding is consistent everywhere.

New component `src/components/admin/payments/BrandMark.tsx` — renders the logo tile with brand-colored ring, works in light + dark mode (white inner tile like the courier `BrandBadge`).

## 2. Expanded provider credential schemas

Edit each adapter under `src/lib/subscription-pay/providers/*` to expand `credentialFields` per each provider's official docs, keeping existing keys for backward compatibility. Fields added become optional so already-saved connections still validate.

- **SSLCommerz**: `store_id`, `store_password`, `sandbox`, `success_url`, `fail_url`, `cancel_url`, `ipn_url`, `currency`.
- **ShurjoPay**: `merchant_username`, `merchant_password`, `prefix`, `return_url`, `callback_url`, `currency`.
- **AmarPay**: `store_id`, `signature_key`, `success_url`, `fail_url`, `cancel_url`, `ipn_url`, `currency`.
- **PortWallet**: `merchant_id`, `api_key`, `secret_key`, `success_url`, `fail_url`, `ipn_url`, `currency`.
- **Stripe**: `publishable_key`, `secret_key`, `webhook_secret`, `currency`, `statement_descriptor`.
- **PayPal**: `client_id`, `client_secret`, `webhook_id`, `return_url`, `cancel_url`, `currency`.
- **bKash**: `app_key`, `app_secret`, `username`, `password`, `merchant_number`, `callback_url`.
- **Manual / Bank Transfer**: `bank_name`, `account_name`, `account_number`, `branch`, `routing_number`, `swift`, `iban`, `bkash_number`, `nagad_number`, `rocket_number`, `upay_number`, `qr_code_url` (uploaded via existing `ImageUploader` → `store-assets/payment-qr/`), `instructions` (textarea).

Extend `CredentialField.type` in `providers/types.ts` with `"textarea"`, `"url"`, `"image"`, and a `group` string so the config form can render sectioned accordions (Credentials, URLs, Bank details, etc.).

## 3. Redesigned config sheet

Rewrite `ConfigureForm` inside `src/routes/_authenticated/admin/payment-gateway.tsx`:

- Branded header with `BrandMark`, tagline, docs link.
- Fields grouped by `group` in collapsible sections.
- Per-field UX: show/hide toggle for `password`, copy button, paste support, `onBlur` auto-trim, inline format hints (e.g. Stripe `sk_…`, PayPal client id length), `url` fields validated with `z.string().url()`.
- Image field uses existing `ImageUploader` component for QR code.
- Textarea for manual instructions with 1000-char counter.
- Sticky footer: **Test Connection**, **Save**, **Save & Set as Default** — Save is blocked when required fields are empty or format checks fail; Test runs the existing `testStorePaymentGateway` and shows an inline result banner (branded colors).
- Preserves current "leave blank to keep existing credential" behavior.

## 4. Redesigned gateway card

Update `GatewayCard`:

- Brand-tinted top strip using `brandColor`.
- `BrandMark` + provider name + tagline.
- Status pill states: **Connected**, **Verified** (connected + last successful test), **Not Connected**, **Disabled**, **Error** — with icons and brand-consistent colors.
- Meta rows: last connection time, last successful test, last error message (truncated with tooltip), sandbox/live badge, active badge.
- Actions row keeps existing buttons: Configure, Test, Set active, Enable/Disable switch, Disconnect. Loading spinners use brand color.

## 5. Active-gateway hero

Redesign the top summary card to a brand-forward hero: large `BrandMark`, active provider name, environment badge, last successful sync timestamp; fallback empty state gets a friendlier CTA linking to the first non-connected provider.

## 6. Toasts, loading, empty states

- Toast helpers wrap `sonner` to prepend the brand icon on success/error.
- Skeleton cards while loading (replace the plain "Loading…" line).
- Empty grid state (no providers enabled globally by owner) shows a note pointing to the owner-managed availability.

## 7. No backend/schema changes

- No new tables or migrations. `store_payment_gateways.credentials` is already `jsonb`, so new fields serialize without schema work.
- Existing server-side encryption, validation, and test-result persistence continue to power the UI (last test result, connected_at, credentials_preview already exist on the returned rows).

## 8. Files touched

- New: `src/components/admin/payments/providers.ts`, `src/components/admin/payments/BrandMark.tsx`, `src/components/admin/payments/StatusBadge.tsx`, `src/components/admin/payments/logos/*.svg` (inline components).
- Edited: `src/lib/subscription-pay/providers/types.ts`, all 8 files in `src/lib/subscription-pay/providers/*`, `src/routes/_authenticated/admin/payment-gateway.tsx`.
- Untouched: `src/routes/_authenticated/owner/payment-gateways.tsx`, all `.functions.ts` server files, database.

## 9. Verification

- `tsgo` typecheck.
- Manual walk-through of one card per provider: open config, toggle show/hide, paste + auto-trim, test connection (branded result), save, set active, disconnect.
- Light + dark mode screenshot check via Playwright on the payment-gateway route.
