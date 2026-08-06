# Quick Order — Phone / Offline Order Creation

A guided order builder inside the Store Admin panel so you can take orders that arrive by phone, WhatsApp, Messenger or Facebook and turn them into real orders — with the same invoice, inventory, timeline and customer-account behaviour as a storefront order.

Scope agreed: **physical products only**, delivery zones for shipping (no district/upazila fields), **paid/due amounts tracked**, notifications by **email + in-app**.

## Entry points

A prominent **+ Create Order** button on:
- Orders page (header, next to the filters)
- Dashboard (quick actions)
- Customer profile sheet — opens pre-loaded with that customer
- Customer search results row action

It opens a full-screen sheet on desktop and a stacked full-page flow on mobile.

## The flow

**1. Customer lookup**
Type a phone number, customer ID or email. Matching customers appear as you type (from the second digit onwards).

- Match found → **Existing Customer** badge, and the form fills itself with name, phone, email, default saved address, delivery zone, and customer notes. A side panel shows their history.
- No match → **New Customer** badge. The customer record is created when the order is submitted, never before.
- The phone number is the identity key: an order for an existing phone is always attached to that existing customer. No duplicate account is ever created.

**2. Customer details**
Editable name, phone, email, delivery zone, full address, and a delivery note. Saved addresses appear as one-tap chips when the customer has more than one.

**3. Products**
Search by name, SKU, product code or category. Each result shows image, price, stock and variants. Pick variant options (size/colour where the product defines them), set quantity, add as many lines as needed. Out-of-stock products are flagged and blocked unless you override.

**4. Pricing**
Live totals: subtotal, discount, delivery charge, additional charge, grand total. Delivery charge auto-fills from the selected zone and stays editable. A coupon code can be applied and is validated against the store's coupon rules.

**5. Payment**
Choose COD, online/manual method, and a payment state of Unpaid, Partially paid (advance) or Fully paid. When money was already received, enter the amount and an optional transaction reference; the balance due is calculated and shown.

**6. Review**
A full summary — customer, items, charges, payment, delivery — before you commit.

**7. Create**
On submit the system: creates or reuses the customer, creates the order with an invoice number, writes order items, deducts stock, records the payment, writes the order timeline, tags the order source as `manual`, and sends the confirmation email plus an in-app notification.

## Customer history panel

Shown beside the builder whenever an existing customer is matched:
- Total orders, lifetime spend, average order value, last order date
- Loyalty/VIP badge
- Recent orders with status
- Recently purchased products
- Cancelled orders, return and exchange requests
- Customer notes

## Quick reorder

**Reorder last order** and per-product **Buy again** buttons load those products straight into the current draft with their quantities, respecting current prices and stock.

## Validation checklist

- Existing customers detected by phone, never duplicated
- Auto-fill populates name, email, address and zone correctly
- Stock decrements and stock movements are logged
- Timeline entry and invoice number generated
- Order appears immediately in the customer's own account and in the Orders list
- Works at 320px width through desktop

---

## Technical notes

**Database migration**
- `orders`: add `paid_amount numeric default 0` and `due_amount numeric default 0` so advance/partial payments are recorded. Existing rows backfill to 0/total.
- `store_customer_addresses`: add owner-scoped INSERT/UPDATE policies so admin-created addresses can be saved from the wizard (writes still go through the service-role server function).

**Server functions** — new `src/lib/quick-order.functions.ts`, all behind `requireSupabaseAuth` and scoped to the signed-in owner's store:
- `searchQuickOrderCustomers` — phone/email/id prefix search, returns match + stats
- `getQuickOrderCustomerContext` — history panel payload (orders, returns, products, notes, spend)
- `searchQuickOrderProducts` — name/SKU/product_code/category search with stock and variants
- `createQuickOrder` — the write path

`createQuickOrder` recomputes every price server-side from the product rows (never trusting client prices), resolves the delivery zone charge, validates the coupon through the existing coupon logic, upserts the customer by `(store_id, phone)`, inserts the order with `source: 'manual'` and `confirmation_status: 'confirmed'`, inserts items, and reuses the existing confirm path so stock movements, invoice numbering and the `order_timeline` trigger fire exactly as they do today. Duplicate-order protection is bypassed for admin-created orders (the admin is the human check).

**Notifications** reuse `order_notifications_outbox` plus the existing email queue and `admin_notifications` — no new channel.

**UI** — new `src/components/admin/quick-order/` folder: `QuickOrderSheet.tsx` (step shell), `CustomerStep.tsx`, `ProductStep.tsx`, `PricingPaymentStep.tsx`, `ReviewStep.tsx`, `CustomerHistoryPanel.tsx`. Wired into `admin/orders.tsx`, `admin/index.tsx`, `admin/customers.tsx` and `CustomerProfileSheet.tsx`.
