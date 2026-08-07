# Premium Analytics Dashboard (Store Admin)

The current Analytics page calls one server function (`businessAnalytics`) that returns totals, a 14-day series, best/worst sellers by quantity, and new/returning counts — no date range, no expenses, no order-status breakdown, no product images. The redesign replaces both the data layer and the page while keeping the existing product-type scope, plan gating (`FeatureGate` + `assertPlan`), and ORZEN card styling.

## Controls (top of page)

- Header: "Business Analytics" + subtitle, with **Export Report** (CSV / Excel-compatible CSV / PDF via print) on the right.
- Product type tabs (All / Physical / Digital / Service / Subscription) bound to the existing global `useProductTypeScope`.
- Date range selector: Today, Yesterday, Last 7 Days, Last 30 Days, This Month, Last Month, This Year, Last Year, Custom.
- Compare With: Previous Period / Previous Month / Previous Year.

All three controls live in one sticky-ish control row and drive every section through a single query key.

## Sections (in order)

1. **KPI grid** — Total Revenue, Total Orders, AOV, Net Profit, Total Expenses, Profit Margin, New Customers, Returning Customers. Each card: value, % change vs the comparison period, up/down arrow, "vs previous period" caption.
2. **Revenue Overview** — one chart with a Revenue / Orders / Profit / Expenses switcher. Buckets are daily for ranges up to ~60 days, weekly up to ~1 year, monthly beyond. Tooltip shows date + all four metrics.
3. **Sales Breakdown** — revenue by product type (physical / digital / service / subscription) as a horizontal bar list with share percentages. Doubles as "Revenue by Product Type"; the two requested sections are merged to avoid duplication, with a compare-over-time toggle.
4. **Orders Overview** — counts for pending, confirmed, processing, shipped, delivered, cancelled, returned, plus a status bar chart.
5. **Product Performance** — Top Selling and Lowest Performing lists with product image, name, units, revenue, and % contribution; "View All Products" link to `/admin/products`.
6. **Customer Insights** — Total / New / Returning customers, returning rate, average customer value, average orders per customer, a customer growth chart, and a new-vs-returning comparison.
7. **Profit & Expenses** — Gross Revenue, Total Expenses, Gross Profit (revenue − product cost), Net Profit, Profit Margin, plus a Revenue vs Expenses vs Profit chart. Sourced from the same orders/product-cost/`expenses` data the Finance page uses, so recorded expenses appear here automatically.
8. **Marketing Performance** — reads the saved `stores.marketing` config. If nothing is configured, a clean empty state with a **Configure Marketing** button linking to `/admin/marketing`. No fake numbers.
9. **Sales Funnel** — Visitors → Product Views → Add to Cart → Checkout → Purchase with stage conversion percentages. See the note below.
10. **Type-specific sections** — Subscription, Service, and Digital blocks rendered only when the store actually has products of that type.
11. **Recent Activity** — merged timeline of recent orders, status changes, payments, returns/refunds, new customers and expenses, each with a relative timestamp.
12. **Business Insights** — 3-5 sentences derived from the computed numbers only (period-over-period sales change, top revenue product, returning-customer revenue share, expense change). Rendered only when the underlying comparison data exists.

## Funnel and marketing data — important

The store has no server-side event tracking table: there are no visitor, product-view, add-to-cart or checkout-start records anywhere in the database (marketing pixels fire client-side to Meta/GA4/TikTok and those platforms don't return aggregates to us). So the funnel can only be populated honestly from what we do store: **Checkout Started** (orders created) and **Purchase** (confirmed/paid orders), with product views and add-to-cart shown as "Not tracked" with a link to Marketing. The alternative is a new lightweight storefront events table — that is a separate build; say the word and it gets added to this plan.

Marketing Performance shows connection status per platform plus a link to each platform's own dashboard, not invented metrics.

## Empty, loading, error states

- Skeleton cards and chart placeholders while loading (never blank space).
- Per-section empty states ("Not enough sales data yet" + a relevant action) instead of zero-filled charts.
- The analytics query failing renders one friendly error card; type-specific sub-queries fail independently without taking down the page.

## Mobile

KPI cards stack 2-up on small screens, charts scroll-free and readable, filters become horizontally scrollable chips / compact dropdowns, product and activity tables become cards, no horizontal overflow.

## Technical notes

- Rewrite `businessAnalytics` in `src/lib/business.functions.ts` to accept `{ product_type?, from, to, compare_from, compare_to }` and return one aggregated payload: kpis (current + previous), bucketed series, status counts, type breakdown, product performance (joined to `products` for image/price), customer stats, expense/COGS totals, recent activity and per-type blocks. All queries stay scoped by `store_id` under the existing auth middleware and RLS; only the needed columns are selected and date filters are applied in SQL.
- Add small companion fns where cleaner: `analyticsTypePresence` (which product types exist) and reuse of `stores.marketing` for the marketing section.
- Shared range/compare helpers extend `src/lib/finance-ui.ts` (existing `rangeFor`, `money`, `downloadCsv`) rather than duplicating logic.
- New components under `src/components/admin/analytics/`: `AnalyticsControls`, `KpiGrid`, `RevenueChart`, `SalesBreakdown`, `OrdersOverview`, `ProductPerformance`, `CustomerInsights`, `ProfitExpenses`, `MarketingPanel`, `SalesFunnel`, `TypeBlocks`, `RecentActivity`, `Insights`, `AnalyticsSkeleton`.
- Charts use `recharts` (already a dependency) with tokens from the design system — no hardcoded colors.
- `src/routes/_authenticated/admin/analytics.tsx` becomes a thin composition inside the existing `FeatureGate feature="analytics"`, with route `head()` metadata.
- One React Query key `["analytics", type, from, to, compare]`, cached, so switching tabs/ranges is a single request.
