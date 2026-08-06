# Return & Exchange — Automated Enterprise Workflow

Replace today's simple request form (reason + photos + status) with a full lifecycle that connects orders, inventory, payments, courier, and the customer account.

## Request types

- **Return only** — money back (refund / store credit / COD adjustment).
- **Exchange, same product** — pick a different variant of the item that was ordered.
- **Exchange, different product** — pick another product from the store catalogue.

In every case the customer chooses which line items and **how many units** of each (partial returns supported). Only variants/products that are actually in stock and purchasable are offered.

## Automatic money math

While the customer builds the request, the system shows live:

```text
Returned items value        -  X
Replacement items value     +  Y
Return shipping             +/- per store policy
Replacement shipping        +/- per store policy
-------------------------------------------
Result: refund due  |  extra payment due  |  even
```

The same numbers are recomputed and locked server-side on submit, so the client can never dictate amounts.

## New store settings (Settings → Order & Workflow)

- Return eligibility window (days after delivery)
- Allowed request types
- Who pays return shipping (store / customer) and flat charge
- Who pays replacement shipping and flat charge
- Refund methods enabled: original payment, store credit, manual/cash, COD adjustment
- Restocking fee (percent or flat, optional)
- Auto-approve requests under a value threshold (optional)
- Require inspection before refund/replacement (on by default)

## Lifecycle

```text
Requested -> Approved / Rejected
   Approved -> Return shipment created -> In transit -> Received by store
        -> Inspection passed  -> Refund processed   -> Completed
                              -> Replacement order  -> Shipped -> Completed
        -> Inspection failed  -> Returned to customer / Closed
```

Every transition writes a timeline row (actor, note, timestamp) that the customer sees in My Orders and on the order page, mirroring the existing order tracking ladder.

## What happens automatically

- **Approval** creates the return shipment: a courier parcel using the store's active courier, with tracking number, label, and status sync through the same cron job that syncs forward parcels.
- **Inspection passed** is the only point that moves inventory: returned good units go back into stock, damaged units are written off — both logged as stock movements linked to the return.
- **Replacement** creates a real linked order (marked as a replacement, zero or difference-only amount), which flows through the normal pipeline: invoice number from the subscription/physical invoice sequence, courier label, tracking, and customer notifications.
- **Refund** routes by method: online gateway refund where the gateway supports it, store credit on the customer account, COD due adjustment, or a manual payout the admin marks as paid. Each writes a payment row.
- Emails/notifications fire on approve, shipment, received, refund, replacement shipped, and complete.

## Admin experience (`/admin/returns`)

Status tabs (Pending, Approved, In transit, Received, Inspection, Refund/Replacement, Completed, Rejected) with cards showing product photos, quantities, request type, customer, and the computed money line. The detail drawer carries the action for the current stage only: Approve / Reject → Create return shipment → Mark received → Inspection passed/failed (per unit) → Process refund or Create replacement → Complete. Everything is mobile-first with no horizontal overflow at 320px.

## Customer experience

Request wizard from My Orders and order details: pick items and quantities → pick request type → pick variant or replacement product (with live price difference) → reason, note, photos → review summary with the exact refund or extra-payment figure → submit. Afterwards the order page shows a full status timeline, the replacement order link, the return tracking number, and refund status.

## Technical notes

- **Migration**: extend `public.returns` with request type, quantities, financial columns (items value, shipping charges, restocking fee, refund/extra amounts, refund method/status), inspection fields, `replacement_order_id`, and courier parcel link; new `return_items` and `return_timeline` tables; new `store_return_settings` table; extend the `return_status` enum with the new stages; store-credit balance on the customer record. GRANTs + RLS on every new table (owner-managed; customer reads go through security-definer RPCs, matching `customer_list_returns`).
- **Server**: new `src/lib/returns-admin.functions.ts` for the stage machine (each admin action is one authenticated server fn that validates the current status before transitioning); `src/lib/returns.functions.ts` gains quantity/variant-aware creation and the server-side money calculator in a shared `src/lib/returns-pricing.ts` used by both client preview and server validation. Courier work reuses the existing courier adapter/registry; replacement order creation reuses the existing order + invoice + parcel paths.
- **UI**: rewrite `src/routes/_authenticated/admin/returns.tsx` and `src/components/admin/returns/ReturnDrawer.tsx`; new `src/components/storefront/order/ReturnWizard.tsx` replacing `ReturnRequestDialog.tsx`; `ReturnStages.tsx` extended to render the new timeline; `OrdersPanel.tsx` and `ReturnRequestBlock.tsx` wired to the wizard.
- **Settings**: new section component under `src/components/admin/settings/` mounted on the existing Order & Workflow settings page.
- Plan gating for the `returns` feature stays on the admin actions.
