import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsPayload } from "@/lib/analytics.server";

const ORDER: { key: string; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "returned", label: "Returned" },
  { key: "cancelled", label: "Cancelled" },
];

export function OrdersOverview({ counts }: { counts: AnalyticsPayload["statusCounts"] }) {
  const data = ORDER.map((s) => ({ label: s.label, value: counts[s.key] ?? 0 })).filter((d) => d.value > 0);
  return (
    <section className="rounded-xl border bg-card p-3 sm:p-4">
      <h2 className="text-sm font-semibold">Orders Overview</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Order pipeline for this period</p>
      {data.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No orders in this period.</p>
      ) : (
        <div className="mt-3 h-52 w-full sm:h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={44} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{ borderRadius: 12, fontSize: 12, background: "var(--card)", border: "1px solid var(--border)" }}
              />
              <Bar dataKey="value" name="Orders" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
