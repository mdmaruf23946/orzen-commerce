import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { ownerStoreHealth } from "@/lib/owner.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/owner/health")({ component: StoreHealthPage });

type Filter = "all" | "critical" | "warning" | "healthy" | "inactive";

function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString() : "—";
}

function StoreHealthPage() {
  const fn = useServerFn(ownerStoreHealth);
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["owner", "store-health"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const rows = (data?.rows ?? []).filter((r) => {
    const text = `${r.name} ${r.slug} ${r.merchant_code ?? ""}`.toLowerCase();
    if (q && !text.includes(q.toLowerCase())) return false;
    if (filter === "critical") return r.issues.length > 2;
    if (filter === "warning") return r.issues.length > 0 && r.issues.length <= 2;
    if (filter === "healthy") return r.issues.length === 0;
    if (filter === "inactive") return r.orders_7d === 0;
    return true;
  });

  const t = data?.totals;
  const chips: { key: Filter; label: string; value: number | string; tone: string }[] = [
    { key: "all", label: "All stores", value: t?.stores ?? "—", tone: "text-slate-600" },
    { key: "healthy", label: "Healthy", value: t?.healthy ?? "—", tone: "text-emerald-600" },
    { key: "warning", label: "Needs attention", value: t?.warning ?? "—", tone: "text-amber-600" },
    { key: "critical", label: "Critical", value: t?.critical ?? "—", tone: "text-red-600" },
    { key: "inactive", label: "No orders (7d)", value: t?.inactive7d ?? "—", tone: "text-blue-600" },
  ];

  return (
    <div className="min-w-0 space-y-4">
      <OwnerPageHeader
        title="Store Health"
        description="Every store's live condition — plan, activity, catalogue, customers and domains."
        actions={
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`min-w-0 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted ${
              filter === c.key ? "ring-2 ring-primary" : ""
            }`}
          >
            <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className={`mt-1 text-xl font-bold ${c.tone}`}>{c.value}</div>
          </button>
        ))}
      </div>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search store name, slug or merchant code…"
        className="max-w-sm"
      />

      {isLoading ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Loading store health…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No stores match this filter.</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((r) => {
            const tone =
              r.issues.length === 0 ? "text-emerald-600" : r.issues.length <= 2 ? "text-amber-600" : "text-red-600";
            const Icon = r.issues.length === 0 ? CheckCircle2 : r.issues.length <= 2 ? AlertTriangle : ShieldAlert;
            return (
              <div key={r.id} className="min-w-0 rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 shrink-0 ${tone}`} />
                      <span className="truncate font-semibold">{r.name}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      /{r.slug}
                      {r.merchant_code ? ` · ${r.merchant_code}` : ""} · joined {fmtDate(r.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`text-lg font-bold ${tone}`}>{r.score}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">health</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <Stat label="Products" value={`${r.active_products}/${r.products}`} />
                  <Stat label="Orders" value={`${r.orders} (${r.orders_7d} · 7d)`} />
                  <Stat label="Customers" value={r.customers} />
                  <Stat label="Revenue" value={`৳${Math.round(r.revenue).toLocaleString()}`} />
                </div>

                <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>Plan: <b className="text-foreground">{r.subscription_status}</b>{r.days_left !== null ? ` · ${r.days_left}d left` : ""}</span>
                  <span>Store status: <b className="text-foreground">{r.status}</b></span>
                  <span>Last order: {fmtDate(r.last_order_at)}</span>
                  <span>Last customer login: {fmtDate(r.last_customer_login_at)}</span>
                </div>

                {r.domains.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.domains.map((d) => (
                      <span
                        key={d.hostname}
                        className={`rounded-full border px-2 py-0.5 text-[11px] ${
                          d.status === "verified" || d.status === "active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {d.hostname} · {d.status}
                      </span>
                    ))}
                  </div>
                )}

                {r.issues.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.issues.map((i) => (
                      <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {i}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to="/owner/stores" className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">Manage store</Link>
                  <Link to="/owner/subscriptions" className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">Subscription</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Activity className="h-3 w-3" />
        Updated {data ? new Date(data.generated_at).toLocaleString() : "—"}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-background p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}
