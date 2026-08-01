import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Package,
  KeyRound,
  Wallet,
  Gift,
  Lock,
  TrendingUp,
  Clock,
} from "lucide-react";
import { digitalDashboard } from "@/lib/digital.functions";

export const Route = createFileRoute("/_authenticated/admin/digital-dashboard")({
  head: () => ({
    meta: [
      { title: "Digital Dashboard — ORZEN Store Admin" },
      {
        name: "description",
        content:
          "Downloads, digital sales, license usage and the best performing digital products of your store.",
      },
      { property: "og:title", content: "Digital Dashboard — ORZEN Store Admin" },
      {
        property: "og:description",
        content: "Track downloads, digital revenue and license keys in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DigitalDashboardPage,
});

function money(n: number) {
  return `৳${Math.round(n).toLocaleString()}`;
}

function DigitalDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["digital-dashboard"],
    queryFn: () => digitalDashboard(),
  });

  const t = (data as any)?.totals;
  const most: any[] = (data as any)?.mostDownloaded ?? [];
  const recent: any[] = (data as any)?.recentlyUpdated ?? [];

  const kpis = t
    ? [
        { label: "Digital products", value: t.products, icon: Package, hint: `${t.published} live` },
        { label: "Total downloads", value: t.downloads, icon: Download },
        { label: "Digital revenue", value: money(t.revenue), icon: Wallet, hint: `${t.orders} orders` },
        { label: "Active licenses", value: t.activeLicenses, icon: KeyRound, hint: `${t.availableLicenses} unused` },
        { label: "Free downloads", value: t.freeDownloads, icon: Gift },
        { label: "Awaiting unlock", value: t.lockedFiles, icon: Lock },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Digital Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Downloads, revenue and licenses for your digital catalogue.
          </p>
        </div>
        <Link
          to="/admin/digital-orders"
          className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
        >
          Digital orders →
        </Link>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-xl border bg-card p-3">
                <div className="flex items-center gap-2 text-[11px] uppercase text-muted-foreground">
                  <k.icon className="h-3.5 w-3.5" /> {k.label}
                </div>
                <div className="mt-1 text-xl font-bold">{k.value}</div>
                {k.hint && <div className="text-[11px] text-muted-foreground">{k.hint}</div>}
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-xl border bg-card p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="h-4 w-4" /> Most downloaded
              </h2>
              {most.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No downloads yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {most.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{p.name}</span>
                      <span className="shrink-0 font-semibold">{p.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border bg-card p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4" /> Recently updated
              </h2>
              {recent.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No digital products yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {recent.map((p) => (
                    <li key={p.id} className="flex items-center gap-3">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-muted">
                        {p.image && (
                          <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : ""}
                        </div>
                      </div>
                      <span className="text-sm font-semibold">
                        {Number(p.price) === 0 ? "Free" : money(Number(p.price))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
