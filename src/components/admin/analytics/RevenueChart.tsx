import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { bucketLabel, compactMoney } from "@/lib/analytics-ui";
import type { AnalyticsPayload } from "@/lib/analytics.server";

const METRICS = [
  { key: "revenue", label: "Revenue", money: true },
  { key: "orders", label: "Orders", money: false },
  { key: "profit", label: "Profit", money: true },
  { key: "expenses", label: "Expenses", money: true },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

export function RevenueChart({
  series,
  mode,
}: {
  series: AnalyticsPayload["series"];
  mode: "day" | "week" | "month";
}) {
  const [metric, setMetric] = useState<MetricKey>("revenue");
  const active = METRICS.find((m) => m.key === metric)!;
  const data = series.map((s) => ({ label: bucketLabel(s.bucket, mode), value: s[metric] }));
  const fmt = (v: number) => (active.money ? compactMoney(v) : String(Math.round(v)));

  return (
    <section className="rounded-xl border bg-card p-3 sm:p-4">
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <h2 className="truncate text-sm font-semibold">Revenue Overview</h2>
        <div className="flex shrink-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors sm:text-xs",
                metric === m.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-56 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={fmt} tickLine={false} axisLine={false} width={56} />
            <Tooltip
              formatter={(v: any) => [fmt(Number(v)), active.label]}
              contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
            />
            <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
