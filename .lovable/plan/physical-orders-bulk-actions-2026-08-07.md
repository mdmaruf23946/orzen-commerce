# Physical Orders — Bulk Actions

Add multi-select and a bulk actions bar to the Orders page, active only for Physical orders. Everything reuses actions the physical order system already supports; no new backend systems.

## What the user sees

- Each physical order card gets a checkbox (top-left, next to the product thumb).
- A "Select all" checkbox appears above the list, selecting the currently filtered physical orders only. Shows "X selected" with a Clear button.
- When 1+ orders are selected, a sticky Bulk Actions bar appears at the top of the list (compact icon+label buttons, horizontally scrollable on mobile).
- Selection resets when the type tab, status tab, or filters change, so a bulk action can never touch a hidden order.
- Digital / Service / Subscription cards get no checkbox, and the bar never appears for those tabs. On the "All" tab only physical rows are selectable.

## Actions and when they show

Each action is shown only if at least one selected order qualifies; otherwise it stays hidden.

| Action | Shown when | Uses |
|---|---|---|
| Confirm Orders | any selected order is not yet confirmed | existing confirm order function |
| Cancel Orders | any selected order is not cancelled/delivered | existing status update |
| Send to Courier | any selected order is confirmed/processing and has no parcel yet | existing bulk courier send |
| Print Invoice | always (1+ selected) | opens the store's selected invoice template per order |
| Print Shipping Label | always (1+ selected) | courier label when a parcel exists, otherwise the existing printable label sheet |
| Export Orders | always (1+ selected) | CSV download built in the browser |
| Change Order Status | always (1+ selected) | dropdown of the existing statuses, applied one by one |

## Send to Courier validation

Before dispatching, each selected order is validated in the UI for: customer name, phone (Bangladeshi digit check), address, and COD amount (must be a valid number, and > 0 when the order is COD/unpaid).

- Valid orders are sent; invalid ones are never submitted.
- A confirmation dialog lists the skipped orders with the exact missing field, so the merchant can fix them individually.
- Server-side failures returned by the bulk send are merged into the same result summary.

## Result summary

After any bulk action, a summary panel appears above the list: "N succeeded · M failed", with each failed order listed by invoice number and reason. The orders list is refreshed automatically so statuses/badges update, and successful IDs are removed from the selection.

## Technical notes

- `src/components/admin/orders/OrderCard.tsx`: optional `selected` / `onSelectChange` props render a checkbox; card is unchanged when they are absent.
- New `src/components/admin/orders/BulkActionsBar.tsx`: selection count, applicability logic, action buttons, status dropdown, and the validation/summary dialog.
- New `src/lib/orders-bulk.ts` (client-safe): `validateForCourier(order)`, CSV builder, and applicability predicates — kept out of any `*.functions.ts` file so code splitting stays safe.
- `src/routes/_authenticated/admin/orders.tsx`: holds `Set<string>` selection state, renders the bar for `physicalView`, and runs the actions sequentially with progress toast.
- Server functions reused as-is: `confirmOrder`, `updateOrderStatus`, `bulkSendParcels` (orderIds), `getParcelPrintData`, `getParcelLabel`. No migration, no new server function.
