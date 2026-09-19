// Payment Gateway Overview mini dashboard: KPIs, gateway comparison and trends.
import { AlertTriangle } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PaymentOverview, PaymentRow } from "@/lib/ops-analytics.server";
import { getBrand } from "@/components/admin/payments/providers";
import { bucketLabel, compactMoney, pctChange } from "@/lib/analytics-ui";
import { ComparisonTable, rateTone, type ColumnDef } from "./ComparisonTable";
import { OpsKpiRow } from "./OpsKpi";

const colorOf = (key: string) => getBrand(key).brandColor;

export function PaymentOverviewPanel({ data }: { data: PaymentOverview }) {
  const { rows, totals, previous, series, gateways } = data;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="text-sm font-medium">No transactions in this period</p>
        <p className="mt-1 text-xs text-muted-foreground">Gateway performance appears once orders are paid.</p>
      </div>
    );
  }

  const best = [...rows].filter((r) => r.txn >= 3).sort((a, b) => b.successRate - a.successRate)[0]?.key;
  const weak = rows.filter((r) => r.txn >= 5 && r.successRate < 70);

  const columns: ColumnDef<PaymentRow>[] = [
    { key: "txn", label: "Txn", value: (r) => r.txn },
    { key: "success", label: "Success", value: (r) => r.success },
    { key: "failed", label: "Failed", value: (r) => r.failed },
    { key: "pending", label: "Pending", value: (r) => r.pending, hideOnMobile: true },
    { key: "refunded", label: "Refunded", value: (r) => r.refunded, hideOnMobile: true },
    {
      key: "successRate",
      label: "Success %",
      value: (r) => Math.round(r.successRate * 10) / 10,
      render: (r) => <span className={rateTone(r.successRate)}>{r.successRate.toFixed(1)}%</span>,
    },
    { key: "amount", label: "Amount", value: (r) => Math.round(r.amount), render: (r) => compactMoney(r.amount) },
    {
      key: "avgValue",
      label: "Avg Value",
      value: (r) => Math.round(r.avgValue),
      render: (r) => compactMoney(r.avgValue),
      hideOnMobile: true,
    },
    {
      key: "share",
      label: "Share %",
      value: (r) => Math.round(r.share * 10) / 10,
      render: (r) => `${r.share.toFixed(1)}%`,
      hideOnMobile: true,
    },
  ];

  const stacked = rows.map((r) => ({
    label: r.label,
    Success: r.success,
    Failed: r.failed,
    Pending: r.pending,
    Refunded: r.refunded,
  }));

  const donut = rows.filter((r) => r.amount > 0).map((r) => ({ name: r.label, value: Math.round(r.amount), key: r.key }));

  return (
    <div className="space-y-4">
      <OpsKpiRow
        items={[
          { label: "Transactions", value: totals.txn.toLocaleString("en-US"), delta: pctChange(totals.txn, previous.txn) },
          {
            label: "Collected",
            value: compactMoney(totals.amount),
            sub: `${totals.success} successful`,
            delta: pctChange(totals.amount, previous.amount),
          },
          {
            label: "Success Rate",
            value: `${totals.successRate.toFixed(1)}%`,
            delta: pctChange(totals.successRate, previous.successRate),
          },
          {
            label: "Failed / Pending",
            value: `${totals.failed} / ${totals.pending}`,
            sub: "needs follow-up",
          },
          {
            label: "Refunded",
            value: compactMoney(totals.refundedAmount),
            sub: `${totals.refunded} refunds`,
          },
        ]}
      />

      {weak.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-muted-foreground">
            Low success rate on{" "}
            <span className="font-medium text-foreground">{weak.map((w) => w.label).join(", ")}</span> — check gateway
            credentials or customer payment failures.
          </p>
        </div>
      )}

      <ComparisonTable
        rows={rows}
        columns={columns}
        defaultSort="amount"
        bestKey={best}
        accentOf={(r) => colorOf(r.key)}
        leading={(r) => (
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(r.key) }} />
        )}
        exportName="payment-gateway-overview"
        emptyText="No transactions."
      />

      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2 [&>*]:min-w-0">
        <section className="min-w-0 overflow-hidden rounded-xl border bg-card p-3 sm:p-4">
          <h2 className="text-sm font-semibold">Revenue Share by Gateway</h2>
          <div className="mt-3 h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
                  {donut.map((d) => (
                    <Cell key={d.key} fill={colorOf(d.key)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any) => compactMoney(Number(v))}
                  contentStyle={{ borderRadius: 12, fontSize: 12, background: "var(--card)", border: "1px solid var(--border)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl border bg-card p-3 sm:p-4">
          <h2 className="text-sm font-semibold">Transaction Status by Gateway</h2>
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
                <Bar dataKey="Success" stackId="s" fill="#10B981" />
                <Bar dataKey="Pending" stackId="s" fill="#F59E0B" />
                <Bar dataKey="Failed" stackId="s" fill="#EF4444" />
                <Bar dataKey="Refunded" stackId="s" fill="#6366F1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="min-w-0 overflow-hidden rounded-xl border bg-card p-3 sm:p-4">
        <h2 className="text-sm font-semibold">Collected Amount Trend</h2>
        <div className="mt-3 h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="bucket"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => bucketLabel(String(v), "day")}
              />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => compactMoney(Number(v))} />
              <Tooltip
                formatter={(v: any) => compactMoney(Number(v))}
                labelFormatter={(v) => bucketLabel(String(v), "day")}
                contentStyle={{ borderRadius: 12, fontSize: 12, background: "var(--card)", border: "1px solid var(--border)" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {gateways.map((g) => (
                <Line key={g.key} type="monotone" dataKey={g.key} name={g.label} stroke={colorOf(g.key)} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
