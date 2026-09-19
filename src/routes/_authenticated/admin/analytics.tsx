import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { TypeFilterTabs } from "@/components/admin/page/TypeFilterTabs";
import { useProductTypeScope, scopeTabs } from "@/lib/product-type-scope";
import { storeAnalytics } from "@/lib/analytics.functions";
import {
  analyticsRange,
  compareRange,
  type AnalyticsRangeKey,
  type CompareKey,
  type DateRange,
} from "@/lib/analytics-ui";
import { AnalyticsRangeBar } from "@/components/admin/analytics/AnalyticsRangeBar";
import { KpiGrid } from "@/components/admin/analytics/KpiGrid";
import { RevenueChart } from "@/components/admin/analytics/RevenueChart";
import { SalesBreakdown } from "@/components/admin/analytics/SalesBreakdown";
import { OrdersOverview } from "@/components/admin/analytics/OrdersOverview";
import { ProductPerformance } from "@/components/admin/analytics/ProductPerformance";
import { CustomerInsights } from "@/components/admin/analytics/CustomerInsights";
import { TypeSections } from "@/components/admin/analytics/TypeSections";
import { SalesFunnel } from "@/components/admin/analytics/SalesFunnel";
import { ActivityFeed } from "@/components/admin/analytics/ActivityFeed";
import { Insights, ProfitPanel } from "@/components/admin/analytics/ProfitPanel";
import { CourierOverviewPanel } from "@/components/admin/analytics/CourierOverviewPanel";
import { PaymentOverviewPanel } from "@/components/admin/analytics/PaymentOverviewPanel";
import { courierOverview, paymentOverview } from "@/lib/ops-analytics.functions";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — ORZEN Merchant Panel" },
      { name: "description", content: "Track sales, traffic and conversion performance for your store." },
      { property: "og:title", content: "Analytics — ORZEN Merchant Panel" },
      { property: "og:description", content: "Track sales, traffic and conversion performance for your store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeatureGate feature="analytics">
      <AnalyticsPage />
    </FeatureGate>
  ),
});

function AnalyticsPage() {
  const run = useServerFn(storeAnalytics);
  const { scope, setScope, filter } = useProductTypeScope();
  const [rangeKey, setRangeKey] = useState<AnalyticsRangeKey>("30d");
  const [customRange, setCustomRange] = useState<DateRange>(analyticsRange("this_month"));
  const [compare, setCompare] = useState<CompareKey>("previous_period");

  const range = useMemo(() => analyticsRange(rangeKey, customRange), [rangeKey, customRange]);
  const cmp = useMemo(() => compareRange(range, compare), [range, compare]);

  const [view, setView] = useState<"overview" | "courier" | "payment">("overview");

  const { data, isFetching } = useQuery({
    queryKey: ["analytics", filter ?? "all", range.from, range.to, cmp.from, cmp.to],
    enabled: view === "overview",
    queryFn: () =>
      run({
        data: {
          product_type: filter,
          from: range.from,
          to: range.to,
          compare_from: cmp.from,
          compare_to: cmp.to,
        },
      } as any),
    placeholderData: (prev) => prev,
  });

  const rangeArgs = { from: range.from, to: range.to, compare_from: cmp.from, compare_to: cmp.to };

  const { data: courier, isFetching: courierLoading } = useQuery({
    queryKey: ["analytics-courier", range.from, range.to, cmp.from, cmp.to],
    enabled: view === "courier",
    queryFn: () => runCourier({ data: rangeArgs }),
    placeholderData: (prev) => prev,
  });

  const { data: payment, isFetching: paymentLoading } = useQuery({
    queryKey: ["analytics-payment", range.from, range.to, cmp.from, cmp.to],
    enabled: view === "payment",
    queryFn: () => runPayment({ data: rangeArgs }),
    placeholderData: (prev) => prev,
  });

  const tabs = scopeTabs({}).map((t) => ({ key: t.key, label: t.label.replace(/ \(0\)$/, "") }));

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden pb-10">
      <AdminPageHeader
        title="Analytics"
        description="Business performance from your real store data."
      />
      <TypeFilterTabs
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "courier", label: "Courier Overview" },
          { key: "payment", label: "Payment Overview" },
        ]}
        value={view}
        onChange={(k) => setView(k as typeof view)}
      />
      {view === "overview" && (
        <TypeFilterTabs
          className="static top-auto z-auto border-0 bg-transparent px-0 py-0 backdrop-blur-none sm:px-0"
          tabs={tabs}
          value={scope}
          onChange={(k) => setScope(k as any)}
        />
      )}
      <AnalyticsRangeBar
        rangeKey={rangeKey}
        onRangeKey={setRangeKey}
        custom={customRange}
        onCustom={setCustomRange}
        compare={compare}
        onCompare={setCompare}
      />

      {view === "courier" ? (
        !courier ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            {courierLoading ? "Loading courier performance…" : "No courier data available yet."}
          </div>
        ) : (
          <div className={courierLoading ? "opacity-60 transition-opacity" : undefined}>
            <CourierOverviewPanel data={courier} />
          </div>
        )
      ) : view === "payment" ? (
        !payment ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            {paymentLoading ? "Loading payment performance…" : "No payment data available yet."}
          </div>
        ) : (
          <div className={paymentLoading ? "opacity-60 transition-opacity" : undefined}>
            <PaymentOverviewPanel data={payment} />
          </div>
        )
      ) : !data ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          {isFetching ? "Loading analytics…" : "No analytics available yet."}
        </div>
      ) : (
        <div className={isFetching ? "space-y-4 opacity-60 transition-opacity" : "space-y-4"}>
          <KpiGrid k={data.kpis} />
          <RevenueChart series={data.series} mode={data.range.mode} />
          <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2 [&>*]:min-w-0">
            <SalesBreakdown rows={data.typeBreakdown} />
            <OrdersOverview counts={data.statusCounts} />
          </div>
          <ProductPerformance products={data.products} />
          <CustomerInsights customers={data.customers} series={data.series} mode={data.range.mode} />
          <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2 [&>*]:min-w-0">
            <ProfitPanel finance={data.finance} />
            <SalesFunnel funnel={data.funnel} marketing={data.marketing} />
          </div>
          <TypeSections data={data} />
          <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2 [&>*]:min-w-0">
            <ActivityFeed items={data.activity} />
            <Insights items={data.insights} />
          </div>
        </div>
      )}
    </div>
  );
}
