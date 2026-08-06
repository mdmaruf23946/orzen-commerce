# Customer Panel — Return & Exchange Requests in My Orders

The order details page already supports customer-initiated return/exchange requests. This plan brings the same capability into the **My Orders** list and completes the tracking view.

## What the customer gets

**In My Orders (account page)**
- Each delivered, eligible physical order shows **Request Return** and **Request Exchange** buttons.
- Buttons appear only when: order type is physical, order is delivered, within the 7-day window, not cancelled, and no open (pending/approved) request already exists for that order.
- Orders with an existing request show a status chip instead: Pending, Approved, Rejected, Completed.

**Request modal (shared with the order details page)**
- Request type (preset from the button, switchable)
- Item selection
- Reason (required)
- Upload images (optional, multiple, compressed in the browser)
- Additional note (optional) — new field
- For exchange: preferred replacement note

**Tracking**
- Expanding a request in My Orders (and on the order details page) shows: current status, admin resolution note, refund amount (returns), assigned replacement product with thumbnail (exchanges), and courier return tracking number + status when set.

## Workflow

```text
Customer submits request  ->  status: Pending
        -> appears instantly in Store Admin > Returns & Exchanges
        -> admin approves / rejects / completes
        -> customer sees live status + notes in My Orders
```

No change to the admin module; it already reads these rows.

## Technical notes

- **Database migration**: add `customer_note` (text) to `public.returns`, and extend the `customer_create_return` security-definer function with a `_note` argument. Also extend `customer_list_returns` to return `resolution_note`, `refund_amount`, `courier_tracking_id`, `courier_name`, `customer_note`, and the joined replacement product (id, name, image).
- **`src/lib/customer-account.functions.ts`**: `listMyOrders` gains, per order, a `return_eligible` flag (delivered timeline event + 7-day window + physical + not cancelled) and a `returns` array summary, computed in two batched queries (`order_timeline`, `returns`) instead of per-row fetches.
- **New `src/components/storefront/order/ReturnRequestDialog.tsx`**: the modal currently embedded in `ReturnRequestBlock.tsx`, extracted so both surfaces reuse it, plus the new "Additional note" field.
- **`src/components/storefront/order/ReturnRequestBlock.tsx`**: uses the extracted dialog; renders replacement product and courier return status in the request card.
- **`src/components/storefront/account/OrdersPanel.tsx`**: adds the two action buttons, status chip, and a collapsible request-detail section per order card; invalidates `my-orders` and `my-returns` queries after submit.
- **`src/lib/returns.functions.ts`**: `createMyReturnRequest` passes the new note through to the RPC.
- Mobile-first: buttons wrap into the existing card footer row, no horizontal overflow at 320px.
