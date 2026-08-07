import { CheckCircle2, ShoppingBag, Wallet, XCircle } from "lucide-react";
import { compactMoney, relativeTime } from "@/lib/analytics-ui";
import type { AnalyticsPayload } from "@/lib/analytics.server";

const ICONS: Record<string, typeof ShoppingBag> = {
  order: ShoppingBag,
  delivered: CheckCircle2,
  cancelled: XCircle,
  expense: Wallet,
};

export function ActivityFeed({ items }: { items: AnalyticsPayload["activity"] }) {
  return (
    <section className="rounded-xl border bg-card p-3 sm:p-4">
      <h2 className="text-sm font-semibold">Recent Business Activity</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No activity in this period.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((a, i) => {
            const Icon = ICONS[a.kind] ?? ShoppingBag;
            return (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{a.title}</div>
                  <div className="text-[11px] text-muted-foreground">{relativeTime(a.at)}</div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {a.amount < 0 ? `-${compactMoney(Math.abs(a.amount))}` : compactMoney(a.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
