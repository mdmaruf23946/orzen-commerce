import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Banknote, CheckCircle2, ReceiptText, ShoppingBag, TrendingDown, TrendingUp, Users } from "lucide-react";
import { getMarketingPerformance } from "@/lib/marketing.functions";
import { ANALYTICS_RANGES, analyticsRange, compareRange, compactMoney, pctChange, type AnalyticsRangeKey } from "@/lib/analytics-ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Metric = { label: string; current: number; previous: number; display: (value: number) => string; icon: typeof Users };
const number = (value: number) => Math.round(value).toLocaleString("en-US");
const percent = (value: number) => `${value.toFixed(1)}%`;

export function PlatformOverview({ platformName }: { platformName: string }) {
  const [rangeKey, setRangeKey] = useState<Exclude<AnalyticsRangeKey, "custom">>("30d");
  const range = useMemo(() => analyticsRange(rangeKey), [rangeKey]);
  const comparison = useMemo(() => compareRange(range, "previous_period"), [range]);
  const load = useServerFn(getMarketingPerformance);
  const { data, isLoading } = useQuery({
    queryKey: ["marketing", "performance", range.from, range.to],
    queryFn: () => load({ data: { from: range.from, to: range.to, compare_from: comparison.from, compare_to: comparison.to } }),
  });
  const current = data?.current;
  const previous = data?.previous;
  const metrics: Metric[] = current && previous ? [
    { label: "Customers", current: current.customers, previous: previous.customers, display: number, icon: Users },
    { label: "Orders", current: current.orders, previous: previous.orders, display: number, icon: ShoppingBag },
    { label: "Purchases", current: current.purchases, previous: previous.purchases, display: number, icon: CheckCircle2 },
    { label: "Revenue", current: current.revenue, previous: previous.revenue, display: compactMoney, icon: Banknote },
    { label: "Average order value", current: current.averageOrderValue, previous: previous.averageOrderValue, display: compactMoney, icon: ReceiptText },
    { label: "Order-to-purchase rate", current: current.purchaseRate, previous: previous.purchaseRate, display: percent, icon: TrendingUp },
  ] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Store performance</h2>
          <p className="mt-1 text-xs text-muted-foreground">Business results while {platformName} is connected. These totals are not platform-attributed.</p>
        </div>
        <Select value={rangeKey} onValueChange={(value) => setRangeKey(value as Exclude<AnalyticsRangeKey, "custom">)}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Performance date range"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ANALYTICS_RANGES.filter((item) => item.key !== "custom").map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">Loading performance…</div> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => {
            const change = pctChange(metric.current, metric.previous);
            const Trend = change < 0 ? TrendingDown : TrendingUp;
            return <div key={metric.label} className="rounded-md border bg-card p-4">
              <div className="flex items-center justify-between gap-3 text-muted-foreground"><span className="text-xs font-medium">{metric.label}</span><metric.icon className="h-4 w-4" /></div>
              <div className="mt-2 text-xl font-semibold">{metric.display(metric.current)}</div>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Trend className="h-3.5 w-3.5" />{Math.abs(change).toFixed(1)}% vs previous period</div>
            </div>;
          })}
        </div>
      )}
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Visitors, add-to-cart activity & platform-attributed revenue are not available from current tracking data, so no estimated values are shown.</div>
    </div>
  );
}