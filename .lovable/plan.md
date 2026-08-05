# Returns & Exchanges — Customer-Initiated Workflow

Turn the admin page into a review-only dashboard and let customers raise return/exchange requests from their order page.

## Database

Extend `returns` (new migration):
- `customer_id`, `customer_name`, `phone` (snapshot), `items` (jsonb: product id, name, qty, price), `images` (text[] of storage paths)
- `replacement_product_id` (for exchanges), `courier_tracking_id`, `courier_name`
- Storage: reuse `store-assets` bucket under `returns/<store_id>/<order_id>/` for customer-uploaded photos (signed URLs on read).
- RLS stays owner-managed; customer writes go through a token-validated server function (security-definer style, same pattern as `customer_from_token`).

## Customer side

On `/store/$slug/order/$orderId` (physical orders only), show **Request Return** and **Request Exchange** buttons when eligible:
- order is delivered (or shipped) and not cancelled
- within a 7-day window from the delivery timeline event
- no existing open request for that order

Dialog collects: item selection, reason (required), optional photos (up to 4), and for exchange a preferred replacement note. Submitting calls a new `createMyReturnRequest` server fn (customer token + store slug), which inserts a `requested` row. After submit the page shows the request status inline (Pending / Approved / Rejected / Completed) with resolution note and courier return tracking when set.

## Admin side (`/admin/returns`)

- Remove the "New request" button and the entire `ReturnForm` modal.
- Status tabs using the existing `TypeFilterTabs`: Pending (requested), Approved, Rejected, Completed (refunded + completed), plus All.
- Each request card shows: invoice/order id, customer name + phone, product thumbnails and names, type badge, reason, uploaded images (clickable lightbox), request date, current status badge.
- Detail drawer with admin actions:
  - Approve / Reject
  - Resolution note
  - Refund amount (returns only)
  - Replacement product picker (exchanges only, from store products)
  - Status update (requested → approved/rejected → refunded/completed)
  - Courier return tracking fields, displayed read-only when a return parcel exists
- `upsertReturn` is replaced by an admin-only `updateReturnRequest` (no create path); listReturns gains items/images/replacement joins and signed image URLs.

## Technical notes

- Files: `src/lib/business.functions.ts` (list/update), new `src/lib/returns.functions.ts` for the customer token fn, `src/routes/_authenticated/admin/returns.tsx` (rewrite), new `src/components/admin/returns/RequestCard.tsx` + `ReturnDrawer.tsx`, new `src/components/storefront/order/ReturnRequestDialog.tsx`, wire into `src/routes/store/$slug/order.$orderId.tsx`.
- Plan gating for `returns` stays on the admin actions; customer submission is allowed only when the store has the feature.
- Mobile-first cards, no horizontal overflow at 320px.
