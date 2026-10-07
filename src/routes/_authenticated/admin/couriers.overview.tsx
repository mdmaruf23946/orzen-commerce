import { createFileRoute, Link } from "@tanstack/react-router";
import { COURIERS, type CourierMeta } from "@/components/admin/couriers/providers";
import { BrandBadge } from "@/components/admin/couriers/BrandBadge";
import { StatGrid, summarize, useCourierCounts, type ParcelSummary } from "@/components/admin/couriers/CourierStats";
import { Button } from "@/components/ui/button";
import { useCourierBrandAssets, useCourierConnections } from "@/lib/courier-apps";

export const Route = createFileRoute("/_authenticated/admin/couriers/overview")({
  head: () => ({
    meta: [
      { title: "Courier Overview — ORZEN Merchant Panel" },
      { name: "description", content: "Combined parcel summary across all connected couriers." },
      { property: "og:title", content: "Courier Overview — ORZEN Merchant Panel" },
      { property: "og:description", content: "Combined parcel summary across all connected couriers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const { connected } = useCourierConnections();
  const { logo } = useCourierBrandAssets();
  const list = COURIERS.filter((m) => connected[m.key]);
  // One query per courier (fixed list → stable hook order).
  const results = COURIERS.map((m) => ({ m, q: useCourierCounts(m.key, !!connected[m.key]) }));
  const rows = results.filter((r) => connected[r.m.key]).map((r) => ({ m: r.m, s: summarize(r.q.data) }));
  const total: ParcelSummary = rows.reduce(
    (a, { s }) => ({ total: a.total + s.total, active: a.active + s.active, delivered: a.delivered + s.delivered, returned: a.returned + s.returned, failed: a.failed + s.failed }),
    { total: 0, active: 0, delivered: 0, returned: 0, failed: 0 },
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <div>
        <h1 className="text-2xl font-semibold">Courier Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">All connected couriers combined.</p>
      </div>
      {list.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No courier connected yet.</p>
          <Button asChild size="sm" className="mt-3"><Link to="/admin/couriers/apps">Open Courier Apps</Link></Button>
        </div>
      ) : (
        <>
          <StatGrid s={total} />
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b px-4 py-2 text-sm font-medium">By courier</div>
            {rows.map(({ m, s }) => <Row key={m.key} m={m} s={s} logoUrl={logo[m.key] ?? null} />)}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ m, s, logoUrl }: { m: CourierMeta; s: ParcelSummary; logoUrl: string | null }) {
  const rate = s.delivered + s.returned > 0 ? Math.round((s.delivered / (s.delivered + s.returned)) * 100) : null;
  return (
    <Link
      to="/admin/couriers/$provider"
      params={{ provider: m.key }}
      search={{ section: "overview" }}
      className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-muted/50"
    >
      <BrandBadge meta={m} logoUrl={logoUrl} />
      <div className="min-w-0 flex-1 font-medium">{m.label}</div>
      <div className="grid grid-cols-4 gap-4 text-right text-xs tabular-nums">
        <div><div className="text-muted-foreground">Total</div>{s.total}</div>
        <div><div className="text-muted-foreground">Active</div>{s.active}</div>
        <div><div className="text-muted-foreground">Delivered</div>{s.delivered}</div>
        <div><div className="text-muted-foreground">Success</div>{rate == null ? "—" : `${rate}%`}</div>
      </div>
    </Link>
  );
}
