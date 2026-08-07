import { money } from "@/lib/finance-ui";
import { cn } from "@/lib/utils";

export function FinanceChart({ series }: { series: { d: string; sales: number; expense: number; cogs: number }[] }) {
  if (series.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-3 sm:p-4">
        <h2 className="text-sm font-semibold">Finance report</h2>
        <p className="mt-6 pb-6 text-center text-sm text-muted-foreground">No activity in this range.</p>
      </div>
    );
  }
  const max = Math.max(1, ...series.map((s) => Math.max(s.sales, s.expense + s.cogs)));
  const legend = [
    { label: "Sales", tone: "bg-primary/70" },
    { label: "Expenses", tone: "bg-destructive/60" },
    { label: "Profit", tone: "bg-emerald-500/80" },
  ];
  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Finance report</h2>
        <div className="flex gap-3">
          {legend.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <i className={cn("h-2 w-2 rounded-full", l.tone)} />
              {l.label}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 flex h-40 items-end gap-1 overflow-x-auto">
        {series.map((s) => {
          const profit = s.sales - s.cogs - s.expense;
          return (
            <div
              key={s.d}
              className="flex min-w-[10px] flex-1 flex-col items-center gap-[2px]"
              title={`${s.d} · Sales ${money(s.sales)} · Expense ${money(s.expense + s.cogs)} · Profit ${money(profit)}`}
            >
              <div className="flex h-32 w-full items-end justify-center gap-[1px]">
                <div className="w-1/3 rounded-t bg-primary/70" style={{ height: `${(s.sales / max) * 100}%` }} />
                <div className="w-1/3 rounded-t bg-destructive/60" style={{ height: `${((s.expense + s.cogs) / max) * 100}%` }} />
                <div
                  className={cn("w-1/3 rounded-t", profit >= 0 ? "bg-emerald-500/80" : "bg-amber-500/70")}
                  style={{ height: `${(Math.abs(profit) / max) * 100}%` }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground">{s.d.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
