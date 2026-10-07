import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { COURIERS, type CourierKey } from "@/components/admin/couriers/providers";
import { BrandBadge } from "@/components/admin/couriers/BrandBadge";
import { CourierIntegration } from "@/components/admin/couriers/CourierIntegration";
import { StatGrid, summarize, useCourierCounts } from "@/components/admin/couriers/CourierStats";
import { StatusBadge } from "@/components/admin/marketing/ui";
import { listParcels } from "@/lib/courier-parcels.functions";
import { STATUS_LABEL, type ParcelStatus } from "@/lib/couriers/status";
import { COURIER_SECTIONS, useCourierBrandAssets, useCourierConnections } from "@/lib/courier-apps";
import { cn } from "@/lib/utils";

const search = z.object({ section: z.enum(["overview", "integration"]).optional() });

export const Route = createFileRoute("/_authenticated/admin/couriers/$provider")({
  validateSearch: search,
  head: ({ params }) => {
    const name = COURIERS.find((c) => c.key === params.provider)?.label ?? "Courier";
    return {
      meta: [
        { title: `${name} — Courier Apps — ORZEN Merchant Panel` },
        { name: "description", content: `Manage ${name} parcels and connection.` },
        { property: "og:title", content: `${name} — Courier Apps` },
        { property: "og:description", content: `Manage ${name} parcels and connection.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: Workspace,
});

function Workspace() {
  const { provider } = Route.useParams();
  const { section } = Route.useSearch();
  const meta = COURIERS.find((c) => c.key === provider);
  const { connected, isLoading } = useCourierConnections();
  const { logo } = useCourierBrandAssets();
  if (!meta) return <Navigate to="/admin/couriers/apps" replace />;
  const on = !!connected[meta.key];
  // Not connected → only the Integration (connect) form is available.
  const active = on ? section ?? "overview" : "integration";

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <BrandBadge meta={meta} logoUrl={logo[meta.key] ?? null} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">{meta.label}</h1>
          {!isLoading && <StatusBadge kind={on ? "connected" : "not_configured"} label={on ? "Connected" : "Not connected"} />}
        </div>
        <Link to="/admin/couriers/apps" className="text-xs text-muted-foreground hover:text-foreground">All Courier Apps</Link>
      </div>
      {on && (
        <div className="flex gap-1 border-b">
          {COURIER_SECTIONS.map((s) => (
            <Link
              key={s.key}
              to="/admin/couriers/$provider"
              params={{ provider: meta.key }}
              search={{ section: s.key }}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm",
                active === s.key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </Link>
          ))}
        </div>
      )}
      {active === "overview" ? <ProviderOverview k={meta.key} /> : <CourierIntegration only={meta.key} />}
    </div>
  );
}

function ProviderOverview({ k }: { k: CourierKey }) {
  const counts = useCourierCounts(k);
  const list = useServerFn(listParcels);
  const { data } = useQuery({
    queryKey: ["parcels", "recent", k],
    queryFn: () => list({ data: { courierKey: k, limit: 8 } }),
    staleTime: 60_000,
  });
  const rows = (data?.rows ?? []) as any[];
  const cod = rows.reduce((a, r) => a + Number(r.cod_amount ?? 0), 0);
  return (
    <div className="space-y-4">
      <StatGrid s={summarize(counts.data)} />
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2 text-sm">
          <span className="font-medium">Recent parcels</span>
          <span className="text-xs text-muted-foreground">COD (recent): ৳{cod.toLocaleString()}</span>
        </div>
        {rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No parcels yet for this courier.</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.recipient_name ?? "—"}</div>
                <div className="truncate text-xs text-muted-foreground">{r.tracking_code ?? r.consignment_id ?? "No tracking yet"}</div>
              </div>
              <div className="text-xs tabular-nums">৳{Number(r.cod_amount ?? 0).toLocaleString()}</div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{STATUS_LABEL[r.status as ParcelStatus] ?? r.status}</span>
            </div>
          ))
        )}
        <Link to="/admin/parcels" className="block border-t px-4 py-2 text-center text-xs text-muted-foreground hover:text-foreground">
          Open Courier Parcels
        </Link>
      </div>
    </div>
  );
}
