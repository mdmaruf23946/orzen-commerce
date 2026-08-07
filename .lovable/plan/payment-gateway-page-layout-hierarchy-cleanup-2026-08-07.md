# Payment Gateway page — layout & hierarchy cleanup

Reorder and restyle the Payment Gateway admin page. No changes to gateway logic, credentials, testing, webhooks, or order-status behaviour.

## New page order

```text
1. Header + Active gateway summary (compact)
2. Payment Providers        — built-in gateway cards
3. Custom Payment Gateways  — "Add Custom Gateway" button, cards for connected ones
4. Order Status Rules       — its own settings card section
5. Recent Webhook Events    — collapsed at the bottom
```

Today the order is: providers → webhook events → order status rules → custom gateways, so the two most-used settings sit at the very bottom.

## What changes

**Active gateway summary** — tighter padding, wraps cleanly at 320px, no oversized empty gradient block when nothing is connected.

**Payment Providers** — wrapped in a titled section ("Payment Providers" + one-line help text). Card grid stays 1 / 2 / 3 columns.

**Custom Payment Gateways** — moves up to sit directly under the providers grid. Section keeps its existing "Add Custom Gateway" button, which already opens the form in a side drawer; the empty state becomes a slim dashed row instead of a tall block. Connected custom gateways keep their status badge and Configure / Enable-Disable / Delete actions exactly as they are.

**Order Status Rules** — becomes a clearly separated settings card with a section heading above it, visually distinct from the provider cards (no change to the four rule selects or the save action).

**Recent Webhook Events** — stays last, unchanged in behaviour.

**Spacing & mobile** — consistent section rhythm, section headings use the grid + `min-w-0` + `shrink-0` pattern so titles and action buttons never collide on narrow screens, buttons go full-width under 480px, and dead vertical space between sections is removed.

## Technical notes

- `src/routes/_authenticated/admin/payment-gateway.tsx` — reorder the JSX blocks, add a small local `Section` wrapper (title + description + children) used by the provider, custom-gateway, rules and webhook blocks. No data-fetch or handler changes.
- `src/components/admin/payments/CustomGatewaySection.tsx` — header/empty-state styling only; the existing `Sheet` editor, save/test/delete server calls stay as-is.
- `src/components/admin/payments/PaymentStatusRules.tsx` — card chrome/responsive tweaks only; same state, same `updatePaymentStatusRules` call.
- `src/components/admin/payments/WebhookEventsPanel.tsx` — untouched apart from fitting the new section wrapper.
