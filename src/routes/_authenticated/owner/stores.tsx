import { storeHref } from "@/lib/store-link";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, ExternalLink, Trash2, Power, Eye, X } from "lucide-react";
import {
  listAllStores,
  setStoreStatus,
  deleteStore,
  assignPackage,
  listPackages,
  getStoreUsage,
} from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/owner/stores")({
  component: OwnerStores,
});

type StatusFilter = "all" | "active" | "suspended";
type SubFilter = "all" | "active" | "trialing" | "expired" | "suspended";

function StatusBadge({ v }: { v: string }) {
  const cls =
    v === "active"
      ? "bg-emerald-100 text-emerald-700"
      : v === "trialing"
      ? "bg-amber-100 text-amber-700"
      : v === "expired"
      ? "bg-rose-100 text-rose-700"
      : v === "suspended"
      ? "bg-zinc-200 text-zinc-700"
      : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${cls}`}>{v}</span>;
}

function OwnerStores() {
  const list = useServerFn(listAllStores);
  const setStatus = useServerFn(setStoreStatus);
  const del = useServerFn(deleteStore);
  const assign = useServerFn(assignPackage);
  const pkgFn = useServerFn(listPackages);
  const qc = useQueryClient();

  const { data: stores } = useQuery({ queryKey: ["owner", "stores"], queryFn: () => list() });
  const { data: packages } = useQuery({ queryKey: ["owner", "packages"], queryFn: () => pkgFn() });

  const [q, setQ] = useState("");
  const [status, setFilterStatus] = useState<StatusFilter>("all");
  const [sub, setSub] = useState<SubFilter>("all");
  const [planId, setPlanId] = useState<string>("all");
  const [viewingId, setViewingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (stores ?? []).filter((s: any) => {
      if (status !== "all" && s.status !== status) return false;
      if (sub !== "all" && (s.subscription_status ?? "active") !== sub) return false;
      if (planId !== "all" && s.package_id !== planId) return false;
      if (term && !(`${s.name} ${s.slug}`.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [stores, q, status, sub, planId]);

  async function toggle(id: string, current: string) {
    const next = current === "active" ? "suspended" : "active";
    await setStatus({ data: { id, status: next as any } });
    qc.invalidateQueries({ queryKey: ["owner", "stores"] });
    toast.success(next === "active" ? "Activated" : "Suspended");
  }
  async function remove(id: string) {
    if (!confirm("Delete store and all its data? This cannot be undone.")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["owner", "stores"] });
    toast.success("Deleted");
  }
  async function setPkg(storeId: string, packageId: string) {
    if (!packageId) return;
    await assign({ data: { storeId, packageId } });
    qc.invalidateQueries({ queryKey: ["owner", "stores"] });
    toast.success("Package assigned");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Stores</h1>
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {stores?.length ?? 0} stores
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or slug"
            className="pl-8"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
          className="h-10 w-full rounded-md border bg-background px-2 text-sm"
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          value={sub}
          onChange={(e) => setSub(e.target.value as SubFilter)}
          className="h-10 w-full rounded-md border bg-background px-2 text-sm"
        >
          <option value="all">All subscriptions</option>
          <option value="active">Active sub</option>
          <option value="trialing">Trialing</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended sub</option>
        </select>
        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          className="h-10 w-full rounded-md border bg-background px-2 text-sm"
        >
          <option value="all">All plans</option>
          {(packages ?? []).map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-2 sm:hidden">
        {filtered.map((s: any) => (
          <div key={s.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{s.name}</div>
                <div className="truncate font-mono text-[11px] text-muted-foreground">/{s.slug}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge v={s.status} />
                <StatusBadge v={s.subscription_status ?? "active"} />
              </div>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              {s.subscription_packages?.name ?? "No plan"} ·{" "}
              {s.expires_at ? `until ${new Date(s.expires_at).toLocaleDateString()}` : "no expiry"}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setViewingId(s.id)}>
                <Eye className="mr-1 h-3.5 w-3.5" /> View
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => toggle(s.id, s.status)}>
                <Power className="mr-1 h-3.5 w-3.5" />
                {s.status === "active" ? "Suspend" : "Activate"}
              </Button>
              <a
                href={storeHref(s.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted"
              >
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open
              </a>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => remove(s.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card sm:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Store</th>
              <th className="p-3">Status</th>
              <th className="p-3">Subscription</th>
              <th className="p-3">Package</th>
              <th className="p-3">Expires</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s: any) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="p-3">
                  <div className="font-medium">{s.name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">/{s.slug}</div>
                </td>
                <td className="p-3"><StatusBadge v={s.status} /></td>
                <td className="p-3"><StatusBadge v={s.subscription_status ?? "active"} /></td>
                <td className="p-3">
                  <select
                    value={s.package_id ?? ""}
                    onChange={(e) => setPkg(s.id, e.target.value)}
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                  >
                    <option value="">{s.subscription_packages?.name ?? "No package"}</option>
                    {(packages ?? []).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {s.expires_at ? new Date(s.expires_at).toLocaleDateString() : "—"}
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="sm" onClick={() => setViewingId(s.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <a
                      href={storeHref(s.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center rounded-md border px-3 text-xs hover:bg-muted"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <Button variant="outline" size="sm" onClick={() => toggle(s.id, s.status)}>
                      {s.status === "active" ? "Suspend" : "Activate"}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-sm text-muted-foreground">
                  No stores match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <StoreDrawer storeId={viewingId} onClose={() => setViewingId(null)} />
    </div>
  );
}

function StoreDrawer({ storeId, onClose }: { storeId: string | null; onClose: () => void }) {
  const usageFn = useServerFn(getStoreUsage);
  const { data, isLoading } = useQuery({
    queryKey: ["owner", "storeUsage", storeId],
    queryFn: () => usageFn({ data: { storeId: storeId! } }),
    enabled: !!storeId,
  });

  return (
    <Sheet open={!!storeId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-2">
            <span className="truncate">{data?.store?.name ?? "Store details"}</span>
            <button onClick={onClose} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
          </SheetTitle>
        </SheetHeader>

        {isLoading || !data ? (
          <div className="mt-6 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="mt-4 space-y-4 text-sm">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-xs text-muted-foreground">/{data.store.slug}</div>
                <a
                  href={storeHref(data.store.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge v={data.store.status} />
                <StatusBadge v={data.store.subscription_status ?? "active"} />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Plan: {data.store.subscription_packages?.name ?? "None"}
                {data.store.expires_at &&
                  ` · Expires ${new Date(data.store.expires_at).toLocaleDateString()}`}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Usage</div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Products" value={data.counts.products} limit={data.store.subscription_packages?.product_limit} />
                <Stat label="Orders (all)" value={data.counts.orders} />
                <Stat label="Orders (30d)" value={data.counts.orders30d} limit={data.store.subscription_packages?.order_limit} />
                <Stat label="Customers" value={data.counts.customers} limit={data.store.subscription_packages?.customer_limit} />
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Revenue</div>
              <div className="rounded-lg border p-3">
                <div className="text-lg font-semibold">৳{Number(data.revenue).toFixed(0)}</div>
                <div className="text-xs text-muted-foreground">Confirmed order value</div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">AI usage (30d)</div>
              <div className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-center">
                <div>
                  <div className="text-sm font-semibold">{data.ai.requests}</div>
                  <div className="text-[10px] text-muted-foreground">Requests</div>
                </div>
                <div>
                  <div className="text-sm font-semibold">{data.ai.tokens.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">Tokens</div>
                </div>
                <div>
                  <div className="text-sm font-semibold">${data.ai.cost.toFixed(3)}</div>
                  <div className="text-[10px] text-muted-foreground">Cost</div>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Recent payments</div>
              {data.recentPayments.length === 0 ? (
                <div className="rounded-lg border p-3 text-xs text-muted-foreground">No payments yet.</div>
              ) : (
                <div className="divide-y rounded-lg border">
                  {data.recentPayments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-2 text-xs">
                      <div>
                        <div className="font-medium">৳{Number(p.amount).toFixed(0)} · {p.method ?? "—"}</div>
                        <div className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</div>
                      </div>
                      <StatusBadge v={p.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, limit }: { label: string; value: number; limit?: number | null }) {
  const pct = limit && limit > 0 ? Math.min(100, Math.round((value / limit) * 100)) : null;
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">
        {value}
        {limit ? <span className="ml-1 text-xs font-normal text-muted-foreground">/ {limit}</span> : null}
      </div>
      {pct !== null && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full ${pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
