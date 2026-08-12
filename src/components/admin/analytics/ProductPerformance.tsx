import { Package } from "lucide-react";
import { compactMoney } from "@/lib/analytics-ui";
import type { AnalyticsPayload } from "@/lib/analytics.server";

type Row = AnalyticsPayload["products"]["top"][number];

function ProductRow({ p, rank }: { p: Row; rank: number }) {
  return (
    <li className="grid min-w-0 grid-cols-[1.25rem_3rem_minmax(0,1fr)] items-center gap-2.5 sm:grid-cols-[1.25rem_2.75rem_minmax(0,1fr)_auto] sm:gap-3">
      <span className="text-sm font-semibold text-muted-foreground">
        {rank}
      </span>
      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted sm:h-11 sm:w-11">
        {p.image ? (
          <img
            src={p.image}
            alt={p.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <Package className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="block max-w-full truncate text-sm font-medium" title={p.name}>
          {p.name}
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.max(p.share, 2)}%` }}
          />
        </div>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <div className="text-sm font-semibold tabular-nums">
          {compactMoney(p.revenue)}
        </div>
        <div className="text-xs text-muted-foreground">{p.qty} sold</div>
      </div>
    </li>
  );
}

function Panel({ title, items }: { title: string; items: Row[] }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border bg-card p-4">
      <h3 className="text-base font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No product sales yet.</p>
      ) : (
        <ul className="mt-3 min-w-0 space-y-3">
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
    <section className="min-w-0 space-y-3 overflow-hidden">
      <h2 className="text-sm font-semibold sm:text-base">Product Performance</h2>
      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Top Selling Products" items={products.top} />
        <Panel title="Lowest Performing Products" items={products.low} />
      </div>
    </section>
  );
}
