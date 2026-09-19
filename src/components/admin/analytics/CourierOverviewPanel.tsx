// Courier Overview mini dashboard: KPIs, per-courier comparison and trends.
import { useNavigate } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CourierOverview, CourierRow } from "@/lib/ops-analytics.server";
import { COURIERS } from "@/components/admin/couriers/providers";
import { bucketLabel, compactMoney, pctChange } from "@/lib/analytics-ui";
import { ComparisonTable, rateTone, type ColumnDef } from "./ComparisonTable";
import { OpsKpiRow } from "./OpsKpi";

const FALLBACK = ["#6366F1", "#0EA5E9", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6"];

function colorOf(key: string, index: number) {
  const meta = COURIERS.find((c) => c.key === key);
  return meta?.brandColor ?? FALLBACK[index % FALLBACK.length];
}

export function CourierOverviewPanel({ data }: { data: CourierOverview }) {
  const navigate = useNavigate();
  const { rows, totals, previous, series, couriers } = data;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="text-sm font-medium">No courier shipments in this period</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Connect a courier and send your first parcel to see performance here.
        </p>
        <button
          type="button"
          onClick={() => navigate({ to: "/admin/couriers" })}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Go to Couriers
        </button>
      </div>
    );
  }

  const best = [...rows].filter((r) => r.total >= 3).sort((a, b) => b.successRate - a.successRate)[0]?.key;

  const columns: ColumnDef<CourierRow>[] = [
    { key: "total", label: "Total", value: (r) => r.total },
    { key: "pending", label: "Pending", value: (r) => r.pending, hideOnMobile: true },
    { key: "in_transit", label: "In Transit", value: (r) => r.in_transit },
    { key: "delivered", label: "Delivered", value: (r) => r.delivered },
    { key: "returned", label: "Returned", value: (r) => r.returned },
    { key: "cancelled", label: "Cancelled", value: (r) => r.cancelled, hideOnMobile: true },
    {
      key: "successRate",
      label: "Success %",
      value: (r) => Math.round(r.successRate * 10) / 10,
      render: (r) => <span className={rateTone(r.successRate)}>{r.successRate.toFixed(1)}%</span>,
    },
    {
      key: "returnRate",
      label: "Return %",
      value: (r) => Math.round(r.returnRate * 10) / 10,
      render: (r) => `${r.returnRate.toFixed(1)}%`,
      hideOnMobile: true,
    },
    { key: "cod", label: "COD", value: (r) => Math.round(r.cod), render: (r) => compactMoney(r.cod) },
    {
      key: "avgDays",
      label: "Avg Days",
      value: (r) => r.avgDays,
      render: (r) => (r.avgDays > 0 ? `${r.avgDays}d` : "—"),
      hideOnMobile: true,
    },
  ];

  const stacked = rows.map((r) => ({
    label: r.label,
    Delivered: r.delivered,
    "In Transit": r.in_transit,
    Pending: r.pending,
    Returned: r.returned,
    Cancelled: r.cancelled,
  }));

  return (
    <div className="space-y-4">
      <OpsKpiRow
        items={[
          {
            label: "Total Parcels",
            value: totals.total.toLocaleString("en-US"),
            delta: pctChange(totals.total, previous.total),
          },
          {
            label: "Delivered",
            value: totals.delivered.toLocaleString("en-US"),
            sub: `${totals.successRate.toFixed(1)}% success`,
            delta: pctChange(totals.successRate, previous.successRate),
          },
          {
            label: "Returned",
            value: totals.returned.toLocaleString("en-US"),
            sub: `${totals.returnRate.toFixed(1)}% return`,
          },
          {
            label: "In Transit / Pending",
            value: (totals.inTransit + totals.pending).toLocaleString("en-US"),
            sub: `${totals.inTransit} moving`,
          },
          {
            label: "COD Value",
            value: compactMoney(totals.cod),
            sub: `${compactMoney(totals.codCollected)} collected`,
            delta: pctChange(totals.cod, previous.cod),
          },
        ]}
      />

      <ComparisonTable
        rows={rows}
        columns={columns}
        defaultSort="total"
        bestKey={best}
        accentOf={(r) => colorOf(r.key, rows.indexOf(r))}
        leading={(r) => (
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: colorOf(r.key, rows.indexOf(r)) }}
          />
        )}
        onRowClick={() => navigate({ to: "/admin/courier-orders", search: { tab: undefined } })}
        exportName="courier-overview"
        emptyText="No courier data."
      />

      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2 [&>*]:min-w-0">
        <section className="min-w-0 overflow-hidden rounded-xl border bg-card p-3 sm:p-4">
          <h2 className="text-sm font-semibold">Parcel Status by Courier</h2>
          <div className="mt-3 h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stacked} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, fontSize: 12, background: "var(--card)", border: "1px solid var(--border)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Delivered" stackId="s" fill="#10B981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="In Transit" stackId="s" fill="#6366F1" />
                <Bar dataKey="Pending" stackId="s" fill="#F59E0B" />
                <Bar dataKey="Returned" stackId="s" fill="#F97316" />
                <Bar dataKey="Cancelled" stackId="s" fill="#EF4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl border bg-card p-3 sm:p-4">
          <h2 className="text-sm font-semibold">Delivery Success Rate Trend</h2>
          <div className="mt-3 h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="bucket"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => bucketLabel(String(v), "day")}
                />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickLine={false} axisLine={false} width={40} unit="%" />
                <Tooltip
                  contentStyle={{ borderRadius: 12, fontSize: 12, background: "var(--card)", border: "1px solid var(--border)" }}
                  labelFormatter={(v) => bucketLabel(String(v), "day")}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {couriers.map((c, i) => (
                  <Line
                    key={c.key}
                    type="monotone"
                    dataKey={c.key}
                    name={c.label}
                    stroke={colorOf(c.key, i)}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
