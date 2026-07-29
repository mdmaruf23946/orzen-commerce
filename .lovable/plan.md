## Goal

Rebuild the Store Admin → Orders screen as a premium, one-screen order management surface (Shopify/Linear feel) using the existing database, order workflow, courier and payment integrations exactly as they are.

## What exists today (verified)

- `/admin/orders` is a plain list: expandable rows, a status `<select>`, invoice link, fraud button, plus an existing `OrderDetailsDrawer`.
- `listMyOrders` returns all orders with `order_items(name_snapshot, price_snapshot, qty)`.
- `getOrderDetails` returns order + items (joined `products.primary_image_url, sku`) + `order_timeline` + `order_internal_notes` + store.
- Courier operations already live in `/admin/courier-orders` with `courier_parcels`, `dispatchParcel`, `syncActiveParcels`, and shared UI in `parcel-ui.tsx`.
- Order status enum is only: pending, confirmed, processing, delivered, cancelled. Timeline stages additionally include courier_assigned, shipped, returned.

## Data reality vs the request (no DB changes)

These requested fields are not stored, so they will be derived or omitted rather than adding columns:

- Courier / In Transit / Returned tabs → derived from the order's `courier_parcels` status, not from `orders.status`.
- Variant → not stored on `order_items`; product name + SKU shown instead.
- Profit → computed as (item price − current `products.cost_price`) × qty, labelled as an estimate; hidden when cost is unset.
- IP address / browser → not stored; the Order Info section will show `source`, `landing_page_url`, `utm`, and `device_id`/`fingerprint` presence instead.
- Activity Log → rendered from the existing `order_timeline` plus courier parcel events; no new logging table.
- Customer statistics (total orders, delivered, cancelled, returned, COD success, lifetime spend, customer since) → computed on the fly from this store's orders by phone (the fraud cache already supplies some of this).

## Build plan

### 1. Read-only server helpers (additive, no schema/workflow change)

In `src/lib/business.functions.ts` (or a new `orders-admin.functions.ts`):

- `listAdminOrders` — orders + first item image/SKU + `courier_parcels` (courier key, tracking, parcel status) + computed total, COD amount, estimated profit, and customer tags (new/repeat/high value) in one query pass. Replaces the raw `listMyOrders` call on this page only; `listMyOrders` stays for other callers.
- `getOrderCustomerStats` — aggregates the customer's history by phone for the drawer.

Existing mutations (`updateOrderStatus`, `dispatchParcel`, notes, fraud) are reused untouched.

### 2. Orders list redesign — `src/routes/_authenticated/admin/orders.tsx`

- Header: title, order count, Export placeholder removed (not requested), search bar.
- Status tabs with per-tab counters and distinct accent colors: All, Pending, Confirmed, Processing, Courier, In Transit, Delivered, Cancelled, Returned (last four courier-derived where the order enum lacks them).
- Search across order ID/invoice, customer name, phone, product name, tracking ID — instant client-side filtering, no reload.
- Advanced filter popover: payment method, payment status, courier, district/area, date range, amount range, repeat customer, risk level. Selections persisted to `localStorage` so the last used filters return.
- New `OrderCard` component (`src/components/admin/orders/OrderCard.tsx`):
  - Left: lazy-loaded product thumbnail, order ID, date/time, NEW badge for recent orders.
  - Center: customer, phone, district + area, product summary, qty, customer tags (Repeat / New / High Value / Risk).
  - Right: total, delivery charge, estimated profit, payment badge (COD / Online Paid / Partial), large status badge, courier badge with brand color.
  - Quick actions row: View, Invoice, Send to Courier, Call, WhatsApp, Copy Address, More menu (status change, fraud check, allow duplicate).
- Desktop keeps the same card grid (no table, no horizontal scroll); mobile shows a compact collapsed card that expands in place.
- Lists longer than ~60 rows render through a lightweight windowed list; images use `loading="lazy"`.
- Transitions kept at 150–250ms using existing tokens.

### 3. Order Details drawer redesign — `src/components/admin/OrderDetailsDrawer.tsx`

Right-side sheet on desktop, full-height bottom sheet on mobile, with a sticky header (customer, order ID, status/courier/payment badges) and a quick-action bar (Invoice, Print, Send to Courier, Call, WhatsApp, More).

Sections, in order: Product & pricing breakdown (incl. discount/coupon, total, estimated profit) · Customer (avatar, contacts, address, Google Maps link, computed statistics) · Order information (IDs, dates, payment, source/UTM, device presence) · Courier (parcel data with Track / Sync / Update status / Cancel / Print label, disabled when no courier connected, wired to the existing courier functions) · Timeline · Internal notes in a chat style · Activity log from timeline + parcel events.

### 4. Styling

Reuse existing semantic tokens with ORZEN purple as the accent; rounded cards, soft shadows, clear hierarchy. No new color hardcoding.

## Out of scope

No changes to database schema, RLS, order status workflow, courier dispatch logic, or payment handling. Note-pinning and note replies are shown as a flat chat list since the notes table has no parent/pin fields.
