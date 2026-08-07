# Business Finance Page Upgrade

Rebuild the Finance page into a clean, range-aware profit view driven entirely by the store's existing order, product cost, payment and expense data. No new accounting modules.

## 1. Date range filter

A single filter at the top: Today | 7 Days | This Month | Last Month | Custom. Every card, the P&L block, chart, history list and export respect the selected range.

## 2. Summary cards

Six compact cards, colour-coded for profit/loss:

- Sales (range)
- Expenses (range)
- Profit (range)
- This month's profit
- Net profit (all time)
- COD receivable — unpaid cash-on-delivery orders not yet delivered/collected

## 3. Profit & Loss strip

A compact horizontal breakdown: Sales → Product cost (COGS from product cost price × qty) → Other expenses → Net profit, each with amount and share bar. Courier and gateway costs appear as expense categories, not separate systems.

## 4. Expenses

- Add form: Category, Amount, Date, optional Note.
- Categories expanded to: Ads, Courier, Product Purchase, Packaging, Payment Gateway, Staff, Other (existing values stay valid and are shown under their new labels).
- Existing expenses can now be edited as well as deleted (edit opens the same form pre-filled).

## 5. Expense history

Searchable list with category filter and date-range scoping, sorted by date. Table on desktop, stacked cards on mobile, with a running total for the filtered set.

## 6. Report

- Simple bar/line chart of Sales, Expenses and Profit per day (or per month for long ranges).
- Export button producing CSV (finance summary + expense rows) and a print-to-PDF view of the same data. Excel opens the CSV natively, so no extra library is added.

## 7. UI

Existing ORZEN card style kept; tighter spacing, clearer typography hierarchy, green/red profit indicators, full mobile layout, no large empty areas.

## Technical notes

- DB migration: extend the `expense_category` enum with `ads`, `product_purchase`, `payment_gateway`, `staff`, `other`. Old values (`fb_ads`, `misc`, ...) remain and are mapped to friendly labels in the UI.
- `financeSummary` in `src/lib/business.functions.ts` gains `from`/`to` inputs and returns range sales, COGS, expenses, profit, month profit, all-time net profit, COD receivable, per-day series, and expense breakdown by category — one server call for the whole page.
- `addExpense` gains an optional `id` for update; `listExpenses` already supports `from`/`to` and gains a category filter.
- COD receivable = sum of `subtotal + delivery_amount − discount_amount − paid_amount` for non-cancelled `payment_method = 'cod'` orders that are not yet marked paid.
- Page split into small components under `src/components/admin/finance/` (RangeFilter, SummaryCards, PnLStrip, ExpenseForm, ExpenseHistory, FinanceChart) with the route staying thin.
