import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { compactMoney, pctChange } from "@/lib/analytics-ui";
import type { AnalyticsPayload } from "@/lib/analytics.server";

function Delta({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        up ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive",
      )}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function Kpi({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4">
      <div className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
        {label}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-lg font-bold tabular-nums sm:text-2xl">{value}</span>
        {delta !== undefined && <Delta value={delta} />}
      </div>
    </div>
  );
}

export function KpiGrid({ k }: { k: AnalyticsPayload["kpis"] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      <Kpi label="Total Revenue" value={compactMoney(k.revenue)} delta={pctChange(k.revenue, k.prevRevenue)} />
      <Kpi label="Total Orders" value={String(k.orders)} delta={pctChange(k.orders, k.prevOrders)} />
      <Kpi label="Avg Order Value" value={compactMoney(k.aov)} delta={pctChange(k.aov, k.prevAov)} />
      <Kpi label="Net Profit" value={compactMoney(k.netProfit)} delta={pctChange(k.netProfit, k.prevNetProfit)} />
      <Kpi label="Total Expenses" value={compactMoney(k.expenses)} delta={pctChange(k.expenses, k.prevExpenses)} />
      <Kpi label="Profit Margin" value={`${k.margin.toFixed(1)}%`} delta={pctChange(k.margin, k.prevMargin)} />
      <Kpi label="New Customers" value={String(k.newCustomers)} delta={pctChange(k.newCustomers, k.prevNewCustomers)} />
      <Kpi label="Returning Customers" value={String(k.returningCustomers)} />
    </div>
  );
}
