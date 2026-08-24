# Customer Accounts page upgrade

Remove the destructive Delete action and turn the page into a useful mini-CRM view of registered storefront customers.

## 1. Remove Delete

- Drop the red "Delete" button from both the mobile card list and the desktop table.
- Keep Enable/Disable as the only way to block an account (safe, reversible, keeps order history intact).
- The delete server function stays unused in the codebase but is no longer reachable from the UI.

## 2. Better list view

- Summary strip at the top: total accounts, active accounts, new this month, customers with at least one order.
- Each row/card also shows: total spent, last order date, and a "New / Repeat / VIP" tag (Repeat = 2+ orders, VIP = top spenders).
- Filters: All / Active / Disabled, and sort by Newest, Most orders, Highest spend.
- Search stays as-is (name, email, phone).

## 3. Richer customer detail dialog

- Header with avatar initials, name, status badge, and quick actions: call, email, WhatsApp.
- Stat row: total orders, total spent, average order value, first order, last order.
- Orders list gets clickable rows that open the order detail page, plus payment status.
- Saved addresses as today, with a copy-address button.
- Internal notes: the store admin can add private notes about the customer (stored per store, not visible to the customer).
- Activity: joined date, last login, account status history is out of scope; only current status shown.

## 4. Small extras

- Export current filtered list to CSV (name, contact, orders, spend, status, joined).
- Empty and loading states unchanged in behaviour, restyled to match the rest of the admin.

## Technical notes

- UI file: `src/routes/_authenticated/admin/customers-accounts.tsx`.
- `adminListCustomerAccounts` (src/lib/admin.functions.ts) is extended to also aggregate total spend and last order date per customer from `orders`, and to accept `status` and `sort` params.
- `adminGetCustomerAccount` is extended to return payment status on orders and aggregate stats.
- Notes reuse the existing `customer_notes` table; if its shape does not fit storefront customer accounts, a single additive migration adds a `customer_id` reference. No other schema change expected.
- Delete button removed from UI only; no migration, and existing customer rows are untouched.
