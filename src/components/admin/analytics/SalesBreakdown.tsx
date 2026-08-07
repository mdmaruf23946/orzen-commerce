import { compactMoney } from "@/lib/analytics-ui";
import type { AnalyticsPayload } from "@/lib/analytics.server";

const LABEL: Record<string, string> = {
  physical: "Physical",
  digital: "Digital",
  service: "Service",
  subscription: "Subscription",
};

export function SalesBreakdown({ rows }: { rows: AnalyticsPayload["typeBreakdown"] }) {
  const visible = rows.filter((r) => r.orders > 0 || r.revenue > 0);
  const total = visible.reduce((a, r) => a + r.revenue, 0);
  return (
    <section className="rounded-xl border bg-card p-3 sm:p-4">
      <h2 className="text-sm font-semibold">Sales Breakdown</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Revenue share by product type</p>
      {visible.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No sales in this period.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {visible.map((r) => {
            const pct = total ? (r.revenue / total) * 100 : 0;
            return (
              <li key={r.type}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{LABEL[r.type]}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {compactMoney(r.revenue)} · {r.orders} orders · {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
