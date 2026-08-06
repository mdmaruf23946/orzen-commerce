# Returns & Exchanges — Master Toggle, Manual Requests, Notifications

Builds on the existing returns module (settings, wizard, admin drawer, stage machine) rather than replacing it.

## 1. Master on/off switch

`store_return_settings.enabled` already exists but nothing reads it. Wire it up:

- The settings panel (Returns & Exchanges → Settings drawer, and the Order & Workflow settings card) gets a prominent master toggle at the top: **Enable Returns & Exchanges**. When off, the remaining sections are visibly dimmed/disabled.
- Storefront honours it: the return/exchange button on order details, the "Request return" action in My Orders, and the wizard entry all disappear when disabled. The public settings RPC already returns `enabled`, so the check is a single gate in `ReturnRequestBlock` and `OrdersPanel`.
- Server-side enforcement: customer submission rejects with "Returns are currently disabled" so a stale page can't post.
- Already-submitted requests stay visible to the customer (status + timeline), and the admin panel keeps working — including manual creation.

## 2. Manual return / exchange from the admin panel

New **+ Create Return / Exchange** button at the top of the Returns & Exchanges page, opening a step wizard (same drawer style as the storefront wizard, mobile-first).

```text
1  Search order      → by order ID / invoice no / customer phone, live results
2  Pick order        → shows customer, date, items, totals
3  Request type      → Return  |  Exchange
4  Pick items        → per-line quantity selector
5  Replacement       → (exchange only) same variant / different variant /
                       different product; sourced from the customer's cart
                       when available, otherwise any store product
6  Notes             → reason, internal note, customer note
7  Charges           → return shipping, replacement shipping, restocking fee,
                       manual adjustment — prefilled from global settings,
                       each editable
8  Summary           → returned value, replacement value, shipping, restocking,
                       difference, refund due OR extra payment due
9  Create            → request saved with all lines + timeline entry
```

The money math reuses the same pricing module the storefront wizard and admin drawer use, so manual and automatic requests price identically. Final amounts are recomputed server-side on submit.

## 3. Linking, no duplicates

A manual request always attaches to the existing order and its existing customer record — the wizard only picks from real orders, and the customer id/name/phone are copied from the order. No new customer, no new order at creation time. Every request writes into the same timeline table the automatic flow uses, so inventory, accounting and courier stay on one trail.

## 4. Replacement order on approval

Already implemented for automatic requests and reused unchanged: approving an exchange creates a linked replacement order that references the original order and the return, carries only the payment difference, mints an invoice number, deducts stock, and enters the normal courier/fulfilment pipeline. Manual exchanges flow through the exact same stage machine, so nothing extra is needed beyond storing replacement items in the same shape.

## 5. Refund workflow

The refund step gains explicit state and methods:

- Statuses: pending, completed, rejected (plus the existing "not applicable").
- Methods: cash, online/original payment, store credit, manual payout.
- Partial refunds: the refund amount is editable and may be lower than the computed figure; the request records the difference.

Rejecting a refund keeps the request open with a note instead of silently completing it.

## 6. Timeline

The timeline table already records each transition. Extend the labels so every stage in the requested list renders with a friendly name and time: created, approved, rejected, courier assigned, customer sent item, item received, inspection passed/failed, replacement order created, replacement shipped, refund pending/completed/rejected, completed, cancelled. Both the admin drawer and the customer order page read the same list.

## 7. Notifications

On every status change the stage machine emits:

- **Customer** — email (existing transactional email path) plus SMS when the store has an SMS sender configured; silently skipped otherwise.
- **Store admin** — in-app notification row, so the bell badge counts it.
- **Owner admin** — in-app platform notification.

Notification sending is best-effort and never blocks or rolls back the status change. Respects the existing "auto notify customer" toggle in return settings.

## Technical notes

- Migration: `returns` gains `internal_note`, `manual_adjustment`, `created_by` ('customer' | 'admin'), and refund-status values for pending/rejected; `store_return_settings.enabled` stays as the master flag. Timeline/labels are code-side.
- New `searchOrdersForReturn` and `createManualReturn` server fns in `src/lib/returns-admin.functions.ts` (auth + plan gated, store-scoped). `createManualReturn` recomputes charges through `src/lib/returns-pricing.ts`.
- New `src/components/admin/returns/ManualReturnWizard.tsx`; `src/routes/_authenticated/admin/returns.tsx` gets the button. `ReturnDrawer.tsx` gains the refund status/method controls and the richer timeline.
- Storefront gating in `ReturnRequestBlock.tsx` and `OrdersPanel.tsx` from the public settings RPC; server guard in `createMyReturnRequest`.
- Notification helper as a server-only module called from the stage machine and manual creation, writing to the existing admin notification and email paths.

## Verification

Manual and customer requests both create correctly and price the same; toggling off hides every customer-facing entry point while admin creation still works; order search by phone and order ID returns matches; approval of an exchange generates exactly one replacement order; inspection restocks once; timeline and refund figures match at each stage; all screens usable at 320px.
