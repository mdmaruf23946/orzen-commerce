// Compact KPI card row shared by the Courier and Payment mini dashboards.
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type OpsKpiItem = {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
};

export function OpsKpiRow({ items }: { items: OpsKpiItem[] }) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
      {items.map((k) => {
        const up = (k.delta ?? 0) >= 0;
        return (
          <div key={k.label} className="min-w-0 rounded-xl border bg-card p-3">
            <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <p className="mt-1 truncate text-lg font-semibold tabular-nums sm:text-xl">{k.value}</p>
            <div className="mt-0.5 flex items-center gap-1 text-[11px]">
              {k.sub && <span className="truncate text-muted-foreground">{k.sub}</span>}
              {k.delta != null && (
                <span className={cn("inline-flex items-center gap-0.5", up ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                  {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(k.delta).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
