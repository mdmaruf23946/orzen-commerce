# Invoice Numbering per Order Type

Split the single Invoice Numbering configuration into four independent configurations: Physical, Digital, Service, Subscription.

## What the user sees

In Store Settings → Store Configuration → Invoice Numbering:

- Four tabs at the top: `Physical | Digital | Service | Subscription`
- Selecting a tab shows only that type's fields: Prefix, Separator, Number padding, Starting number, Include year, Include month, plus a live preview.
- Each tab has its own save button: "Save Physical Invoice Settings", "Save Digital Invoice Settings", etc. Saving one tab never touches the others.
- Default prefixes for newly created configs: PH, DG, SV, SUB (preview e.g. `PH-000001`, `SUB-000008`).

Each type keeps its own running sequence, so Physical can be at 000156 while Service is at 000009.

## Order generation

When an order is confirmed and gets its invoice number, the system picks the configuration matching that order's type. Existing invoices are untouched — only newly generated numbers use the per-type settings. The generation format/logic itself stays identical.

## Technical notes

Database migration:
- `store_invoice_settings`: add `order_type text not null default 'physical'` with a check for physical/digital/service/subscription; replace the unique-on-`store_id` constraint with a primary/unique key on `(store_id, order_type)`.
- Existing rows become the `physical` config (keeps current prefix and `next_number`, so no invoice reuse).
- `generate_invoice_no(_store_id uuid, _order_type text default 'physical')`: same body, but selects/locks the row for `(store_id, order_type)` and inserts a defaulted row (PH/DG/SV/SUB prefix) when missing. Keep a `(_store_id)` overload behaviour via the default argument so existing callers keep working.
- `on_order_status_change` trigger: pass `NEW.order_type` (coalesced to `'physical'`) into `generate_invoice_no`.
- Re-grant EXECUTE consistent with the current grants on the function.

Code:
- `src/lib/invoice-settings.functions.ts`: `getInvoiceSettings` accepts an `order_type` input (defaults physical) and returns that row plus preview; `updateInvoiceSettings` upserts on `(store_id, order_type)`. Preview helper unchanged.
- `src/components/admin/settings/InvoiceNumberingSection.tsx`: add the four tabs (reusing `TypeFilterTabs`), keep one query per selected type, per-tab save button label, per-tab local form state.
- `src/lib/subscriptions.server.ts` reads `store_invoice_settings.prefix` — scope that read to the `subscription` config.
- Regenerated Supabase types after migration.
