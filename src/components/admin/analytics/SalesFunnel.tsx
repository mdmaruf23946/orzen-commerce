import { Info } from "lucide-react";
import type { AnalyticsPayload } from "@/lib/analytics.server";

export function SalesFunnel({
  funnel,
  marketing,
}: {
  funnel: AnalyticsPayload["funnel"];
  marketing: AnalyticsPayload["marketing"];
}) {
  const top = Math.max(funnel.checkoutStarted, 1);
  const steps = [
    { label: "Checkouts Started", value: funnel.checkoutStarted },
    { label: "Orders Placed", value: funnel.purchases },
    { label: "Confirmed / Paid", value: funnel.fulfilled },
  ];
  const tracked = marketing.facebook || marketing.google || marketing.tiktok;

  return (
    <section className="rounded-xl border bg-card p-3 sm:p-4">
      <h2 className="text-sm font-semibold">Conversion Funnel</h2>
      <ul className="mt-3 space-y-2.5">
        {steps.map((s, i) => {
          const pct = (s.value / top) * 100;
          const prev = i === 0 ? null : steps[i - 1]!.value;
          return (
            <li key={s.label}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium">{s.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {s.value}
                  {prev ? ` · ${prev ? ((s.value / Math.max(prev, 1)) * 100).toFixed(0) : 0}%` : ""}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(pct, 2)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex items-start gap-2 rounded-lg bg-muted/60 p-2.5 text-[11px] text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {tracked
          ? "Visitor and add-to-cart stages are tracked by your connected marketing pixels — view them in that platform's dashboard. The stages above come from your real order data."
          : "Visitor and add-to-cart stages need a tracking pixel. Connect Facebook, Google, or TikTok in Marketing settings to measure them."}
      </p>
    </section>
  );
}
