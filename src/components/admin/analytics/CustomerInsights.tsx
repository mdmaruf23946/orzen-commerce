import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { bucketLabel, compactMoney } from "@/lib/analytics-ui";
import type { AnalyticsPayload } from "@/lib/analytics.server";

export function CustomerInsights({
  customers,
  series,
  mode,
}: {
  customers: AnalyticsPayload["customers"];
  series: AnalyticsPayload["series"];
  mode: "day" | "week" | "month";
}) {
  const data = series.map((s) => ({
    label: bucketLabel(s.bucket, mode),
    New: s.newCustomers,
    Returning: s.returningCustomers,
  }));

  return (
    <section className="rounded-xl border bg-card p-3 sm:p-4">
      <h2 className="text-sm font-semibold">Customer Insights</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Total Customers" value={String(customers.total)} />
        <Stat label="Returning Rate" value={`${customers.rate.toFixed(0)}%`} />
        <Stat label="Avg Customer Value" value={compactMoney(customers.avgValue)} />
        <Stat label="Orders / Customer" value={customers.avgOrders.toFixed(1)} />
      </div>
      <div className="mt-4 h-52 w-full sm:h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} tickLine={false} axisLine={false} width={36} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))" }}
              contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="New" stackId="c" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Returning" stackId="c" fill="hsl(var(--muted-foreground))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-2.5">
      <div className="truncate text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-base font-bold tabular-nums">{value}</div>
    </div>
  );
}
