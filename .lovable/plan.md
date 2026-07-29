## Goal

Courier Integration page = connection & configuration only. All parcel operations move to a new **Courier Orders** page under the Orders group in the sidebar.

## 1. Courier Integration cleanup

- Remove the "Manage Parcels" button/link from `SimpleCourierCard.tsx` and `CourierCard.tsx`.
- Everything else on `/admin/couriers` stays: enable/disable, credentials, pickup info, shipping options, save, test connection, sync info, disconnect, diagnostics, default courier.

## 2. Sidebar

- Add `Courier Orders` (truck icon) to the **Orders** group, after Orders and Returns, with the existing `delivery` badge key.
- `/admin/parcels` becomes a redirect to the new page so old links keep working.

## 3. New page `/admin/courier-orders`

Header strip showing the connected courier:
- "Current Courier: SteadFast — Connected · Default Courier" (logo + badges), or a fallback card "No courier connected yet." with a **Go to Courier Integration** button.

Tabs (counts on each): Ready to Send, Sent Parcels, Processing, Delivered, Partial Delivered, Cancelled, Returned, Failed, Hold. Tab state stored in the URL search param so tabs are shareable and don't remount the page. Mobile-first: horizontally scrollable tab bar, stacked cards on small screens, table-like rows on desktop.

**Ready to Send tab** — every confirmed/processing order with no live parcel. Each card shows Order ID/invoice, customer name, phone, full address, product summary, COD amount, delivery charge, selected (default) courier, payment status. Buttons: View Details, Send to Courier, Print Invoice, Print Label.

**Send to Courier dialog** — confirmation showing customer, address, products, COD amount, courier, pickup location, package weight (editable, defaults from courier shipping options), delivery type. On confirm: creates the parcel through the connected courier adapter, stores tracking id / consignment id / courier name / created time on the parcel and mirrors them onto the order, then the order moves to Sent Parcels automatically.

**Sent Parcels and status tabs** — tracking number, courier name, current status, last updated, plus Track (opens courier tracking URL), Sync Status, Print Label, Print Invoice, Cancel Parcel (only where the adapter supports it). Bulk select for send/refresh/print stays. Detail drawer keeps the timeline, COD info and API logs.

**Auto sync** — the existing `sync-parcels` cron continues to refresh active parcels; the page adds a **Sync Now** button (all active parcels) and shows the last-synced time.

## 4. Order Details

In `OrderDetailsDrawer`, replace the manual courier name/tracking/status editor with a single **Send to Courier** action (opening the same confirmation dialog). If a parcel already exists, it shows read-only tracking info with a link to Courier Orders — no parcel management duplicated there.

## 5. Backend (small additions, adapter layer unchanged)

- Extend `listSendableOrders` to also return order items summary, payment status and delivery charge.
- Add `sendOrderToCourier({ orderId, courierKey?, weight?, deliveryType?, note? })` — one call that builds the draft from the order and dispatches through `dispatchParcel`, so the UI never has to do draft-then-send.
- Add `syncActiveParcels()` for the Sync Now button.
- Courier resolution always uses the store's default/connected courier via the existing registry, so adding a new provider needs no page changes.

## Technical notes

- No schema changes; `courier_parcels`, events, logs and pickup tables already cover this.
- New file `src/routes/_authenticated/admin/courier-orders.tsx`, with the parcel drawer, send dialog and order card extracted into `src/components/admin/couriers/` components to keep files small.
- `src/routes/_authenticated/admin/parcels.tsx` reduced to a redirect.
- Page keeps the `courier` FeatureGate for plan gating.
