# Customers Page — Mini CRM Redesign

Today the Customers page is a plain table built from orders grouped by phone, with a single "Notes & tags" dialog. This rebuilds it into a full customer management workspace.

## Identity model (merge by phone)

One customer profile = one normalized phone number within a store. Registered accounts (store customer logins) and guest orders with the same phone collapse into the same profile. Orders, addresses, returns, notes and lifetime spend all roll up under it. Where a phone is missing, email is used as the fallback key.

Lifetime stats are computed live from orders on each read, so a new order updates the profile immediately — no separate counters to drift out of sync.

## Page layout

**Summary strip** (top, horizontally scrollable on mobile): Total customers, New (today / this month), Returning, VIP, Total customer revenue, Average order value.

**Search + filters bar**: one search box matching name, phone, email, or order/invoice number. Filter chips: All, New, Returning, VIP, Blocked, Has pending orders, Has returns, Has exchanges. Sort select: Newest, Highest spending, Most orders, Last order, Alphabetical.

**Customer list**: cards on mobile, table on desktop. Each row shows a generated initials avatar, name, phone, email, total orders, total spend, last order date, and a status badge (New / Returning / VIP / Inactive / Blocked) plus an actions menu.

Status rules: New = 1 order or joined within 30 days; Returning = 2+ orders; VIP = spend or order count above the top threshold; Inactive = no order in 90+ days; Blocked = account disabled.

**Actions menu** per customer: View profile, View orders, Return & exchange history, Saved addresses, Timeline, Internal notes, Send SMS (opens sms: link), Send email (mail link or Communication Center), Call (tel: link), Block / Unblock (only for registered accounts).

**Export**: CSV and Excel of the current filtered list, plus a print-friendly customer report.

## Customer profile

Opens as a full-height drawer (sheet) with tabs, loaded on demand so the list stays fast.

- **Overview** — basic info (name, phone, email, registered date, last login), statistics (total / delivered / pending / cancelled / returned / exchanged / refunded orders, lifetime spend, AOV, last purchase), and analytics (total discount saved, favourite categories, favourite products, preferred payment method, preferred courier, purchase frequency).
- **Orders** — every order with ID/invoice, date, amount, payment method, courier, status; click through to the order details drawer.
- **Returns & exchanges** — request date, type, status, refund amount, replacement order, courier tracking.
- **Addresses** — all saved addresses with the default marked; addresses captured from guest orders are listed as order addresses.
- **Timeline** — chronological activity merged from account creation, orders, order stages, payments, courier events, and return events.
- **Notes** — private tags and free-text notes (existing notes storage, kept intact).

## Performance

- Server-side pagination (25 per page) with infinite scroll on mobile.
- List query aggregates in one pass and returns only list-level fields; profile tabs fetch their own data when opened.
- Search and filters run server-side; sorting applied before pagination.

## Technical notes

- New `src/lib/customers-admin.functions.ts` with server functions: `listStoreCustomers` (search/filter/sort/paginate + summary), `getCustomerProfile`, `getCustomerOrders`, `getCustomerReturns`, `getCustomerTimeline`, `getCustomerAnalytics`, `setCustomerBlocked`, `exportCustomers`. All use `requireSupabaseAuth` and scope every query to the owner's store.
- Profiles are built by merging `store_customers` rows with order rows keyed on a normalized phone (digits only), matching the existing phone normalization used elsewhere.
- Block/unblock toggles the account active flag on `store_customers`; guest-only profiles show the action disabled with a hint.
- Notes reuse the existing customer notes storage and its plan gate; no schema changes are required for this redesign.
- New UI under `src/components/admin/customers/`: `CustomerSummary`, `CustomerFilters`, `CustomerRow` / `CustomerCard`, `CustomerProfileSheet`, and the profile tab panels. `src/routes/_authenticated/admin/customers.tsx` becomes a thin composition of these.
- Export reuses the existing CSV/XLSX writers from the import-export module.
