# Customer Order Details – Workflow Review & Fix

The public order page (`/store/:slug/order/:orderId`) currently shows the gateway payment timeline for every order, including Cash on Delivery, and offers no action buttons other than "Back to store". Returns/exchanges appear only after delivery. This plan fixes the payment display, adds a proper action bar, and aligns the status lifecycle end to end.

## 1. Payment status block

Today `PaymentTimeline` renders "পেমেন্ট শুরু হয়েছে" and "গেটওয়ে থেকে এখনও কোনো আপডেট আসেনি" for COD orders too (visible in the screenshot).

- Split the block by payment method.
- **COD orders** get a simple card:
  - Payment method: Cash on Delivery
  - Payment status: Pay on Delivery (amber) — switches to Paid (green) once the order is delivered/marked paid
  - Line: "ডেলিভারির সময় পেমেন্ট সংগ্রহ করা হবে" / "Payment will be collected at delivery."
  - No gateway rows, no initiation step, no "waiting for gateway" message.
- **Online orders** keep the existing gateway timeline unchanged.
- The order-summary "Payment status" chip shows "PAY ON DELIVERY" instead of "PENDING" for unpaid COD.

## 2. Order action bar

Add a sticky/inline action row on the order page, rendered from the order's real state:

| Action | Shown when |
| --- | --- |
| Cancel Order | not yet shipped (no `shipped` / `courier_assigned` stage) and not cancelled |
| Track Shipment | courier assigned or tracking id present — scrolls to / expands courier tracking |
| Request Return | delivered, physical, inside the 7-day window, no open request |
| Request Exchange | same conditions as return |
| Download Invoice | always (existing invoice endpoint) |
| Buy Again | delivered/completed or cancelled — re-adds the order's items to the cart |

Cancel and return/exchange reuse the existing customer server functions; the return/exchange modal is the shared `ReturnRequestDialog`.

Cancellation rule change: the server currently only allows cancelling while `status = pending` and unconfirmed. It will be widened to "any time before the parcel is shipped/handed to courier" to match the requested behaviour, with the same ownership checks and a clear error afterwards.

## 3. Lifecycle verification

- Timeline stepper gains the full ladder: Placed, Confirmed, Packed, Courier Assigned, Shipped, Delivered, Completed — plus terminal/branch states rendered distinctly: Cancelled, Return Requested, Exchange Requested, Refund Processed.
- Return/exchange and refund states are derived from the existing `returns` rows for the order, so admin decisions (approve, reject, refund amount, replacement product, return tracking) show up live on the customer page.
- Courier status sync already writes `courier_status`; it will be surfaced inside the Track Shipment panel with last-synced time.
- Guest (no login token) viewers still see tracking, payment and invoice; return/exchange and cancel require the customer session, with a "Sign in to manage this order" prompt otherwise.

## Technical notes

- `src/components/storefront/PaymentTimeline.tsx`: early branch for `payment_method !== "online"` into a new COD card; extract shared status text.
- `src/routes/store/$slug/order.$orderId.tsx`: new `OrderActions` component + expanded stage ladder and branch states; keep the digital/service/subscription views untouched.
- New `src/components/storefront/order/OrderActions.tsx` holding the button logic; reuses `cancelMyOrder`, `ReturnRequestDialog`, `createMyReturnRequest`, and the cart helpers in `src/lib/cart.ts` for Buy Again.
- `src/lib/order-display.ts`: `canCancel` updated to a shipment-based rule; matching guard updated in `cancelMyOrder` (`src/lib/customer-account.functions.ts`).
- No database migration required — all data already exists in `orders`, `order_timeline`, and `returns`.
