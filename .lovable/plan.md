## Goal

Turn the Store Admin Orders page into one unified screen for Physical, Digital, Service and Subscription orders — same layout everywhere, only stats / filters / cards / actions / details change per tab. The existing Physical workflow (courier, COD, tracking, invoice, statuses) is not touched at all.

## What exists today

- `src/routes/_authenticated/admin/orders.tsx` — header, 4 KPIs, status tabs (All/Pending/…/Returned), search + filter popover, `OrderCard` list.
- `src/components/admin/orders/OrderCard.tsx` — card with courier/parcel/payment badges and quick actions.
- `src/lib/orders-admin.functions.ts` — single `listAdminOrders` payload builder.
- `src/components/admin/OrderDetailsDrawer.tsx` — order details.
- Products already carry `product_type` = physical | digital | service | subscription.
- Digital admin operations already exist in `src/lib/digital-admin.functions.ts` (access on/off, resend email, regenerate license, audit events).
- The `orders` table has no order-type or confirmation columns yet; `stores` has per-area jsonb settings columns (marketing, delivery, notifications…), so confirmation preferences fit that same pattern.

## Plan

### 1. Data (one migration)

- `orders.order_type` (text, default `physical`) — set on order creation from the cart's product types (mixed cart → `physical`), plus a one-time backfill from existing `order_items → products.product_type`.
- `orders.confirmation_status` (text, default `pending`) and `orders.confirmed_at` — used only by digital/service/subscription.
- `orders.fulfillment_meta` (jsonb) — booking date/time + assigned staff for service, plan / billing cycle / renewal date / subscription state for subscription. No new tables, so the model stays open for future types.
- `stores.order_confirmation` (jsonb) — `{ digital: "auto"|"manual", service: …, subscription: … }`, default auto for digital, manual for service and subscription.
- Grants + RLS follow the existing orders policies (store-owner scoped).

### 2. Confirmation engine

- A shared server helper decides, after a successful payment, whether to auto-confirm: reads the store's `order_confirmation` preference for that order type.
  - Auto → mark confirmed and run the type action (digital: grant access via the existing activation path; service: booking confirmed; subscription: activated).
  - Manual → stays pending until the admin presses **Confirm**, which runs the same action.
- Wired into the existing payment webhook / activation path only for non-physical orders; the physical branch keeps its current behaviour.
- New server fns in a `orders-types.functions.ts` module: `confirmOrder`, `scheduleService`, `completeService`, `extendSubscription`, `cancelSubscription`.

### 3. Orders page shell

- Add a product-type nav directly under the header, reusing the existing `TypeFilterTabs` pill component used on Categories/Banners/Coupons: `All | Physical | Digital | Service | Subscription`, default **All**, with counts.
- Everything below is driven by a per-type config object (stats, filters, card renderer, actions, details panel) so a future type is one config entry, not a redesign.
- **All** tab shows every order together; each card shows a small type badge.

### 4. Per-type behaviour

- **Physical** — current KPIs, current status tabs, current filters, current `OrderCard`. Unchanged code path.
- **Digital** — KPIs: Today's sales, Revenue, Pending, Confirmed, Downloaded. Filters: payment status, confirmation status, access status, purchase date. Card hides address/courier/tracking/COD, shows email, product, payment + confirmation + access status. Actions: View, Invoice, Grant Access, Resend Download Email, Copy Download Link, Refund, More.
- **Service** — KPIs: New requests, Pending, Confirmed, Completed. Filters: booking date, confirmation status, assigned staff. Card: customer, service name, booking date/time, payment + confirmation. Actions: View, Schedule, Confirm, Complete, Invoice.
- **Subscription** — KPIs: Active, Pending, Confirmed, Expiring soon. Filters: active / pending / expired / renewal. Card: customer, plan, billing cycle, renewal date, payment + confirmation + subscription status. Actions: View, Extend, Cancel, Invoice.

### 5. Order details + timeline

- `OrderDetailsDrawer` gains a type-aware section:
  - Digital: gateway, transaction id, confirmation + access status, download count / remaining, license key, invoice (reuses `getOrderDigitalAdmin`).
  - Service: service details, appointment, confirmation, payment.
  - Subscription: plan, billing cycle, renewal date, status, payment history.
- A shared vertical timeline component renders the per-type step ladder (created → paid → pending/confirmed → access/appointment/activated → completed).

### 6. Store Settings

- New "Order Confirmation Settings" section in Store Settings with Auto / Manual radios for Digital, Service and Subscription, saved to `stores.order_confirmation` through the existing `SettingsPage` wrapper pattern.

## Technical notes

- One migration; all new columns nullable/defaulted so existing rows and the physical flow keep working untouched.
- Orders list payload extended in `orders-admin.functions.ts` with `order_type`, `confirmation_status`, digital access summary, and service/subscription meta — one round trip, no per-card fetching.
- Type-specific card bodies live in `src/components/admin/orders/` next to the untouched `OrderCard`, selected by a registry map.
- Service and Subscription have no product-side booking/plan UI yet; the orders page reads whatever the checkout stores in `fulfillment_meta`, and admins can set booking/renewal values from the Schedule/Extend actions.
