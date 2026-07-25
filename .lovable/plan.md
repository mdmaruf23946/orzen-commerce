## Goal

Redesign `/admin/settings` into a clean, sectioned Store Settings page with cards, sticky Save bar, and the new fields listed — without touching sidebar menus or duplicating features that live elsewhere (Invoice numbering, Delivery, Payments, Theme colors, Marketing, SEO, Legal etc. stay where they are).

## Scope check vs current page

The existing page currently mixes: Branding, Contact, Mobile wallet, Customer accounts (Require login), Invoice numbering, Danger zone. The redesign will:

- Keep: Store Identity, Contact, Customer login setting, Danger zone (with confirm — already present).
- Move OUT of this page: Mobile wallet fields (belong in Payment Gateway module) and Invoice numbering card (already has its own settings surface; keep only if user wants — see Q1). Header/title-bar/footer/button colors already live in Theme page and are not re-added here.
- Add: Social Links (Instagram, YouTube, TikTok, LinkedIn, Website), Business Information, Localization, Guest Checkout toggle, Email address.

## Database changes (one migration)

Add nullable columns to `public.stores`:

- `email text`, `instagram text`, `youtube text`, `tiktok text`, `linkedin text`, `website text`
- `business_name text`, `owner_name text`, `trade_license text`, `tax_number text`
- `currency text default 'BDT'`, `language text default 'en'`, `timezone text default 'Asia/Dhaka'`
- `allow_guest_checkout boolean default true`

No new tables, no RLS changes (existing owner policies cover these).

## Server functions

Update `updateMyStore` in `src/lib/admin.functions.ts`:
- Extend Zod schema with the new optional fields.
- Persist them in the update payload.
- Keep existing fields (name, slug, logo, phone, whatsapp, facebook, address, primary_color, bkash/nagad) working — bkash/nagad remain writable via API for backward compat; only the UI moves.

Storefront helper `getPublicStoreBySlug` / storefront queries: extend safe-column projection to include the new social links + currency + language so the storefront can hide empty ones automatically.

## UI: `src/routes/_authenticated/admin/settings.tsx`

Rewrite the page structure. One `<form>` with a sticky bottom Save bar (mobile + desktop). Sections rendered as cards with icon + heading + description:

1. **Store Identity** — logo uploader, name*, slug*, description, primary color (picker + hex).
2. **Contact Information** — phone, whatsapp, email, address.
3. **Social Links** — facebook, instagram, youtube, tiktok, linkedin, website. Note under card: "Empty links are automatically hidden on your storefront."
4. **Business Information** — business_name, owner_name, trade_license, tax_number.
5. **Customer Login Settings** — three switches: Enable customer accounts (existing `require_customer_login` inverse + new dedicated toggle — see Q2), Allow guest checkout, Require login before checkout (uses existing `adminSetRequireCustomerLogin`).
6. **Localization** — currency select (BDT/USD/EUR/GBP/INR + free text), language select (en/bn), timezone select (common list).
7. **Danger Zone** — unchanged Reset to Default Template with existing AlertDialog.

Sticky save bar: `sticky bottom-0` container with backdrop blur, showing "Save changes" button (loading state) and unsaved-changes indicator. Zod client validation for required fields (name, slug). Toast on success/error (already wired via sonner).

Storefront: `src/components/storefront/*` footer/social bar reads new fields and skips falsy ones (single-line change wherever social links render).

## Files touched

- Migration (add columns).
- `src/lib/admin.functions.ts` — extend `updateMyStore` schema + payload.
- `src/lib/storefront.functions.ts` — extend public store projection.
- `src/routes/_authenticated/admin/settings.tsx` — full redesign.
- Storefront social/footer component — hide-empty logic (one file, once identified).

## Out of scope (explicit)

- Invoice numbering card (has its own settings). See Q1.
- Mobile wallet numbers (owned by Payment Gateway module).
- Theme colors beyond Primary (owned by Theme page).
- No sidebar changes.

## Questions

Q1. Should the existing **Invoice numbering** card stay on this page, or move out (it's operational config, not "general store settings")?
Q2. "Enable/Disable Customer Account Login" vs existing "Require login before checkout" — treat as two independent switches (enable accounts feature + separately require login), or is "Enable accounts" just a rename of the existing toggle?

If you're fine with: keep Invoice card in place (Q1 = keep) and treat customer-accounts as a single existing toggle (Q2 = same), I'll proceed with that default.