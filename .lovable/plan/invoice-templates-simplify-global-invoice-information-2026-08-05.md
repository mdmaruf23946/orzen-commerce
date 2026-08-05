# Invoice Templates — Simplify + Global Invoice Information

Everything stays on the existing Invoice Templates page (`/admin/invoice-templates`). No new menu, no new page.

## 1. Simplified template list (Store Admin)

Store Admin can only:

- **Preview** a template (existing preview dialog, unchanged)
- **Set as Active** (uses the existing default-template logic)

Removed from the Store Admin view: New Template, Edit, Duplicate/"Use this", Delete, Hide/Show, Version history, and the category/status/sort toolbar. Cards keep the miniature preview, name, and an "Active" badge.

All available designs (the platform's global presets plus anything already in the store) are shown in one clean grid to pick from. The Winner Admin page keeps the full builder exactly as it is today — only the Store Admin view is simplified.

## 2. Global Invoice Information (same page, below the list)

A collapsible section, collapsed by default, with a "Saved / Not set up yet" hint on the header. Contains one form with grouped fields:

**Business Information** — Business Name, Owner Name, Business Address, Phone, Email, Website (optional), Trade License (optional), BIN / VAT Number (optional)

**Branding** — Company Logo, Signature (optional), Company Seal (optional) — uploaded with the existing image uploader

**Invoice Footer** — Thank You Message, Terms & Conditions, Return / Refund Policy

**Display Options** — Show Logo, Show Signature, Show Company Seal, Show Terms & Conditions (toggles)

One Save button for the whole section.

## 3. Behaviour

- Filled in once, stored per store as the store's global invoice information.
- Every invoice — whatever template is active — renders using this information for business details, logo, signature, seal and footer text.
- Switching templates changes design only; business info never changes.
- Editing this section updates all future invoices immediately; already printed PDFs are unaffected.
- If a field is left empty, the invoice falls back to the existing store profile value (store name, phone, address, email, logo) so nothing breaks for stores that never fill this in.

## Technical notes

- Migration (additive): new table `public.store_invoice_profile` keyed by `store_id` with the business, branding, footer and display-flag columns, plus `created_at`/`updated_at` and an update trigger. GRANTs for `authenticated` + `service_role`, RLS scoped to the owning store via the existing `is_store_owner` helper. No existing table or row is modified.
- New server functions in `src/lib/invoice-settings.functions.ts`: `getInvoiceProfile` / `saveInvoiceProfile` (both `requireSupabaseAuth`).
- `getInvoicePayload` in `src/lib/invoice-templates.functions.ts` merges the profile over the `stores` row when building `InvoiceData.store`, and passes footer text, signature, seal and display flags through so the renderer can use them.
- `InvoiceData` (`src/lib/invoice-template/data.ts`) gains optional `store.owner_name / trade_license / bin_vat / signature / seal` and a `footer { thanks, terms, refund }` block plus `display` flags, with matching variables in `VARIABLE_GROUPS` so templates can place them. Existing templates keep rendering unchanged.
- `src/components/invoice/InvoiceTemplatesManager.tsx` branches on `scope`: `global` keeps today's full manager; `store` renders the simplified picker plus a new `GlobalInvoiceInfo` sub-component under `src/components/invoice/`.
