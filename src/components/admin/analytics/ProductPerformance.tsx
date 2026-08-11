import { Package } from "lucide-react";
import { compactMoney } from "@/lib/analytics-ui";
import type { AnalyticsPayload } from "@/lib/analytics.server";

type Row = AnalyticsPayload["products"]["top"][number];

function ProductRow({ p, rank }: { p: Row; rank: number }) {
  return (
    <li className="flex items-center gap-2 sm:gap-3">
      <span className="w-3 shrink-0 text-[10px] font-semibold text-muted-foreground sm:w-4 sm:text-xs">
        {rank}
      </span>
      <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted sm:h-10 sm:w-10 sm:rounded-lg">
        {p.image ? (
          <img
            src={p.image}
            alt={p.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <Package className="h-3.5 w-3.5 text-muted-foreground sm:h-4 sm:w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium sm:text-sm">{p.name}</div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted sm:h-1.5">
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
        <div className="text-[10px] text-muted-foreground sm:text-[11px]">{p.qty} sold</div>
      </div>
    </li>
  );
}

function Panel({ title, items }: { title: string; items: Row[] }) {
  return (
    <div className="rounded-xl border bg-card p-2 sm:p-4">
      <h3 className="text-xs font-semibold sm:text-sm">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground sm:text-sm">No product sales yet.</p>
      ) : (
        <ul className="mt-2 space-y-2 sm:mt-3 sm:space-y-3">
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
    <section className="space-y-2 sm:space-y-3">
      <h2 className="text-xs font-semibold sm:text-sm">Product Performance</h2>
      <div className="grid gap-2 sm:gap-3 lg:grid-cols-2">
        <Panel title="Top Selling Products" items={products.top} />
        <Panel title="Lowest Performing Products" items={products.low} />
      </div>
    </section>
  );
}
