import { money } from "@/lib/finance-ui";
import { cn } from "@/lib/utils";

export type FinanceSummary = {
  from: string;
  to: string;
  rangeSales: number;
  rangeCogs: number;
  rangeExpense: number;
  rangeProfit: number;
  monthProfit: number;
  netProfit: number;
  totalSales: number;
  totalExpense: number;
  codReceivable: number;
  byCategory: Record<string, number>;
  series: { d: string; sales: number; expense: number; cogs: number }[];
};

function Card({ label, value, tone, hint }: { label: string; value: string; tone?: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-base font-semibold tabular-nums sm:text-xl", tone)}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

const profitTone = (n: number) => (n >= 0 ? "text-emerald-600" : "text-destructive");

export function SummaryCards({ s }: { s: FinanceSummary }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
      <Card label="Sales" value={money(s.rangeSales)} />
      <Card label="Expenses" value={money(s.rangeExpense)} tone="text-destructive" />
      <Card label="Profit" value={money(s.rangeProfit)} tone={profitTone(s.rangeProfit)} />
      <Card label="Monthly Profit" value={money(s.monthProfit)} tone={profitTone(s.monthProfit)} hint="This month" />
      <Card label="Net Profit" value={money(s.netProfit)} tone={profitTone(s.netProfit)} hint="All time" />
      <Card label="COD Receivable" value={money(s.codReceivable)} tone="text-amber-600" hint="Undelivered COD" />
    </div>
  );
}

export function ProfitLoss({ s }: { s: FinanceSummary }) {
  const steps = [
    { label: "Sales", value: s.rangeSales, tone: "bg-primary/70" },
    { label: "Product Cost", value: -s.rangeCogs, tone: "bg-amber-500/70" },
    { label: "Other Expenses", value: -s.rangeExpense, tone: "bg-destructive/70" },
    { label: "Net Profit", value: s.rangeProfit, tone: s.rangeProfit >= 0 ? "bg-emerald-500/80" : "bg-destructive/80" },
  ];
  const max = Math.max(1, ...steps.map((x) => Math.abs(x.value)));
  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4">
      <h2 className="text-sm font-semibold">Profit &amp; Loss</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Sales → product cost → other expenses → net profit</p>
      <div className="mt-3 space-y-2">
        {steps.map((x) => (
          <div key={x.label} className="flex items-center gap-3">
            <div className="w-28 shrink-0 text-xs text-muted-foreground sm:w-36">{x.label}</div>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", x.tone)} style={{ width: `${(Math.abs(x.value) / max) * 100}%` }} />
            </div>
            <div className={cn("w-24 shrink-0 text-right text-xs font-semibold tabular-nums sm:text-sm", x.value < 0 && "text-destructive")}>
              {x.value < 0 ? `-${money(Math.abs(x.value))}` : money(x.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
