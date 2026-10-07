# Payment Gateway Apps — connection-based menus

Same pattern as Courier Apps and Marketing & Targeting Apps: one hub page, plus a separate sidebar menu for each connected gateway.

## Sidebar

```text
Payment Gateway Apps        (always)
Payment Overview            (always)
bKash                       (only when connected)
  ├── Overview
  ├── Integration
  └── Settings
Stripe                      (only when connected)
...
```

- Each connected gateway gets its own menu. A gateway that is not connected shows only on the hub page with a "Connect" button.
- No gateway appears inside another gateway's menu.

## What "connected" means
The current connection status already used on the page: credentials saved and status Connected or Verified. Disabling or disconnecting a gateway removes its menu.

## Hub page — Payment Gateway Apps
- The current "Payment Gateways" page is renamed "Payment Gateway Apps".
- Every gateway card keeps its current logo, name and description exactly as they are.
- Each card shows: logo, name, short description, status (Connected / Verified / Error / Not connected), and a Connect or Manage button.

## Payment Overview (all connected gateways combined)
- Total payments, successful / failed / pending, total amount, refunds, transaction count.
- A table with the summary for each gateway.
- Uses real store orders only, with a date range picker. If a number has no data, it shows "No data yet" instead of a made-up number.

## Gateway workspace (for example bKash)
- **Overview**: the same figures, but only for this gateway's own payments, plus its recent transactions.
- **Integration**: the existing setup form moved here unchanged: credentials, environment (sandbox/live), webhook, test connection, test webhook, save, disconnect, and webhook event log.
- **Settings**: enable/disable, "make default gateway", show at checkout. Payment status rules stay a single shared setting on the hub, not repeated on every gateway.

## Not changing
Payment processing, saved credentials, checkout, webhooks, custom gateways and manual/bank transfer all keep working as they do now. The old `/admin/payment-gateway` link will send you to the hub page.

## Technical details
- New `src/lib/payment-gateway-apps.ts` registry (hub/overview paths, sections Overview/Integration/Settings with icons, `isGatewayConnected` using existing `computeStatus` logic, `usePaymentGatewayConnections()` via `listStorePaymentGateways`).
- Routes: `payment-gateways.tsx` layout, `payment-gateways.index.tsx` redirect to `payment-gateways.apps.tsx` hub, `payment-gateways.overview.tsx`, `payment-gateways.$gateway.tsx` with `?section=`. `payment-gateway.tsx` becomes a redirect.
- Move `GatewayCard`/`ConfigureForm`/`CredentialInput` from the 966-line page into `src/components/admin/payments/` without changing their logic; reuse existing server functions (save/test/toggle/setActive/disconnect/webhook test/events).
- New read-only, store-scoped server fn `getPaymentGatewayStats({ gatewayId?, from, to })` using `orders.payment_gateway_id`, `payment_status`, `paid_amount`, and refund status. No database changes.
- `admin/route.tsx`: replace the single "Payment Gateways" item with the hub + overview + dynamic `paymentGatewayItems()`; update `panel-sections.ts`; keep the `payment_gateway` badge on the hub item.
- Record the registry rule in `AGENTS.md` (extend the existing sidebar-registry rule). Check in preview first; deploy to orzen.top with the wrangler script only after you ask.
