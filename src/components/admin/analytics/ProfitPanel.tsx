import { Lightbulb } from "lucide-react";
import { compactMoney } from "@/lib/analytics-ui";
import type { AnalyticsPayload } from "@/lib/analytics.server";

export function ProfitPanel({ finance }: { finance: AnalyticsPayload["finance"] }) {
  const rows = [
    { label: "Gross Revenue", value: finance.grossRevenue, tone: "text-foreground" },
    { label: "Product Cost (COGS)", value: -finance.cogs, tone: "text-destructive" },
    { label: "Expenses", value: -finance.expenses, tone: "text-destructive" },
  ];
  return (
    <section className="rounded-xl border bg-card p-3 sm:p-4">
      <h2 className="text-sm font-semibold">Profit &amp; Expenses</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-2">
            <span className="truncate text-muted-foreground">{r.label}</span>
            <span className={`shrink-0 font-medium tabular-nums ${r.tone}`}>
              {r.value < 0 ? `-${compactMoney(Math.abs(r.value))}` : compactMoney(r.value)}
            </span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-2 border-t pt-2">
          <span className="font-semibold">Net Profit</span>
          <span className="font-bold tabular-nums">{compactMoney(finance.netProfit)}</span>
        </li>
        <li className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Profit Margin</span>
          <span className="font-medium tabular-nums">{finance.margin.toFixed(1)}%</span>
        </li>
      </ul>
    </section>
  );
}

export function Insights({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-xl border bg-card p-3 sm:p-4">
      <h2 className="text-sm font-semibold">Smart Insights</h2>
      <ul className="mt-3 space-y-2">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
