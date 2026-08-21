# Manual Call Center for Store Admin

A lightweight calling module that sits on top of the existing Orders and Customers data. No new customer/order storage, no AI calling.

## What the store admin gets

1. **New sidebar group "Call Center"** with one item, **Manual Call Center**, placed right after Customers.
2. **Dashboard** with today's counters: Total Calls, Answered, Missed, Busy, Failed, Total Duration.
3. **Calling Provider card** at the top: pick provider, enter credentials, set caller ID, see Connected / Not Connected / Connection Error, plus Test Connection and Disconnect. Credentials are encrypted and never shown again — only a masked hint like `••••8f21`.
   - **Twilio**: real click-to-call, status and duration tracked automatically.
   - **Device mode**: one-click dials from the admin's own phone (`tel:`), and the call is logged with a manually chosen status/duration.
4. **Call history table** (cards on mobile): customer name, phone, related order, date/time, duration, status badge, result, agent, actions.
5. **Filters**: All / Today / Answered / Missed / Failed / No Answer, plus search by name, phone or order number.

## Calling flow

Anywhere a customer phone appears (orders list, order details, customers list, customer profile, call history) there is a compact **Call** action.

```text
Click Call  ->  "Call 017XXXXXXXX?"  [Cancel] [Call Now]
            ->  call row created (Calling)
            ->  status updates live (Ringing / Answered / Completed ...)
            ->  Result picker + optional note  ->  Save
```

- Result options: Order Confirmed, Wants Callback, Customer Unavailable, Order Cancelled, Wrong Number, Interested, Not Interested, Other.
- Status updates arrive automatically from Twilio; the admin can always override status/duration manually (required in device mode).
- If no provider is connected: a plain message "Calling provider is not connected." with a **Connect Calling Provider** button. Failed calls show a human message with **Try Again**.

## Order and customer integration

- **Order details**: compact call block — Call Customer, "Last Call: Answered • 2 minutes ago • 01:42", Call Again, Call History. Every call started from an order is linked to that order.
- **Customer profile sheet**: Call Customer, total calls, last call, last result, and a compact history list.

## Technical section

**Database (one migration)**

- `call_provider_settings` — one row per store: `store_id`, `provider` (`twilio` | `device`), `credentials_encrypted`, `credentials_preview`, `caller_id`, `status` (`connected` | `not_connected` | `error`), `last_error`, `is_active`, timestamps. Owner-only RLS via `is_store_owner(store_id)`; no anon grants.
- `calls` — `store_id`, `order_id` (nullable, FK orders), `customer_id` (nullable, FK store_customers), `customer_name`, `phone`, `agent_id` (auth uid), `provider`, `provider_call_sid`, `direction`, `status`, `duration_sec`, `result`, `note`, `started_at`, `ended_at`, timestamps. Indexes on `(store_id, created_at desc)`, `(order_id)`, `(provider_call_sid)`. RLS: store owner select/insert/update; `service_role` full (webhook writes). No anon/authenticated grants beyond owner scope.
- Grants follow the project pattern: `GRANT ... TO authenticated` + `GRANT ALL TO service_role`, RLS enabled, policies scoped through `is_store_owner`.

**Server code**

- `src/lib/crypto/credentials.server.ts` is reused as-is for AES-256-GCM credential encryption and the masked preview.
- `src/lib/call-center.functions.ts` (`requireSupabaseAuth`): `getCallCenterOverview`, `listCalls` (filters + search + pagination), `saveCallProvider`, `testCallProvider`, `disconnectCallProvider`, `startCall`, `updateCallOutcome` (status/duration/result/note), `getCallsForOrder`, `getCallsForCustomer`.
- `src/lib/call-center.server.ts`: Twilio adapter (Create Call via the Twilio REST API with the store's stored credentials, status-callback URL) plus a provider interface so a future AI provider slots in without schema change.
- `src/routes/api/public/calls/twilio-status.$store.ts`: Twilio status webhook. Validates the `X-Twilio-Signature` HMAC against the store's stored auth token before writing, maps `CallStatus`/`CallDuration` onto the `calls` row via the service-role client.

**Frontend**

- `src/routes/_authenticated/admin/call-center.tsx` — provider card, stat tiles, filters, history table/cards. Data via TanStack Query with a short poll (5s) only while a call is in a live state, so the page stays cheap otherwise.
- `src/components/admin/calls/CallButton.tsx` — confirm dialog + start call; used in `OrderCard.tsx` actions, order details, customers list, and `CustomerProfileSheet.tsx`.
- `src/components/admin/calls/CallResultDialog.tsx` — result chips + one-line note, single save.
- `src/components/admin/calls/CallHistoryList.tsx` and `CallStatusBadge.tsx` — shared compact history + badges reused in order/customer views.
- Sidebar entry added to `src/routes/_authenticated/admin/route.tsx` in a new "Call Center" group.

Existing admin styling, badge tones and card patterns are reused; no new UI library, no animations.
