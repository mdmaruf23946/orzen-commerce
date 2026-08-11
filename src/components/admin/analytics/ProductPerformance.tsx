import { Package } from "lucide-react";
import { compactMoney } from "@/lib/analytics-ui";
import type { AnalyticsPayload } from "@/lib/analytics.server";

type Row = AnalyticsPayload["products"]["top"][number];

function ProductRow({ p, rank }: { p: Row; rank: number }) {
  return (
    <li className="flex items-center gap-3">
      <span className="w-4 shrink-0 text-xs font-semibold text-muted-foreground sm:w-5">
        {rank}
      </span>
      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted sm:h-11 sm:w-11">
        {p.image ? (
          <img
            src={p.image}
            alt={p.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <Package className="h-4 w-4 text-muted-foreground sm:h-5 sm:w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium sm:text-sm">{p.name}</div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.max(p.share, 2)}%` }}
          />
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs font-semibold tabular-nums sm:text-sm">
          {compactMoney(p.revenue)}
        </div>
        <div className="text-[10px] text-muted-foreground sm:text-xs">{p.qty} sold</div>
      </div>
    </li>
  );
}

function Panel({ title, items }: { title: string; items: Row[] }) {
  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4">
      <h3 className="text-sm font-semibold sm:text-base">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No product sales yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((p, i) => (
            <ProductRow key={`${p.id}-${p.name}`} p={p} rank={i + 1} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProductPerformance({ products }: { products: AnalyticsPayload["products"] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold sm:text-base">Product Performance</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Top Selling Products" items={products.top} />
        <Panel title="Lowest Performing Products" items={products.low} />
      </div>
    </section>
  );
}
