import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  listSubscriptionStores,
  setSubscriptionStatus,
  assignPackage,
  listPackages,
  getStoreUsage,
} from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Users,
  Package as PackageIcon,
  ShoppingCart,
  Sparkles,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  RefreshCcw,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner/subscriptions")({
  component: SubscriptionsPage,
});

type TabKey = "all" | "trialing" | "active" | "expiring" | "expired" | "suspended";

const TABS: { v: TabKey; label: string; icon: any }[] = [
  { v: "all", label: "All", icon: PackageIcon },
  { v: "trialing", label: "Trials", icon: Sparkles },
  { v: "active", label: "Active", icon: CheckCircle2 },
  { v: "expiring", label: "Expiring 7d", icon: Clock },
  { v: "expired", label: "Expired", icon: AlertTriangle },
  { v: "suspended", label: "Suspended", icon: Ban },
];



function fmtDate(v?: string | null) {
  return v ? new Date(v).toLocaleDateString() : "—";
}
function daysBetween(v?: string | null) {
  if (!v) return null;
  return Math.ceil((new Date(v).getTime() - Date.now()) / 86400000);
}
function statusBadge(s: string) {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    trialing: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    expired: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    suspended: "bg-muted text-muted-foreground",
    cancelled: "bg-muted text-muted-foreground",
  };
  return map[s] ?? "bg-muted";
}

function SubscriptionsPage() {
  const listFn = useServerFn(listSubscriptionStores);
  const pkgFn = useServerFn(listPackages);
  const setStatus = useServerFn(setSubscriptionStatus);
  const assign = useServerFn(assignPackage);
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // We fetch "all" then filter client-side so tab counts stay live.
  const { data: allStores, isFetching } = useQuery({
    queryKey: ["owner", "subscriptions", "all"],
    queryFn: () => listFn({ data: { filter: "all" } }),
    staleTime: 15_000,
  });
  const { data: packages } = useQuery({ queryKey: ["owner", "packages"], queryFn: () => pkgFn() });

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { all: 0, trialing: 0, active: 0, expiring: 0, expired: 0, suspended: 0 };
    const now = Date.now();
    const next7 = now + 7 * 86400000;
    for (const s of (allStores as any[]) ?? []) {
      c.all++;
      const st = s.subscription_status as TabKey;
      if (st in c) (c as any)[st]++;
      if (s.expires_at) {
        const t = new Date(s.expires_at).getTime();
        if (t >= now && t <= next7 && st !== "suspended") c.expiring++;
      }
    }
    return c;
  }, [allStores]);

  const rows = useMemo(() => {
    const now = Date.now();
    const next7 = now + 7 * 86400000;
    const q = search.trim().toLowerCase();
    return ((allStores as any[]) ?? []).filter((s) => {
      if (q && !`${s.name} ${s.slug}`.toLowerCase().includes(q)) return false;
      if (tab === "all") return true;
      if (tab === "expiring") {
        if (!s.expires_at) return false;
        const t = new Date(s.expires_at).getTime();
        return t >= now && t <= next7 && s.subscription_status !== "suspended";
      }
      return s.subscription_status === tab;
    });
  }, [allStores, tab, search]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["owner", "subscriptions"] });
  }
  async function setS(id: string, status: any) {
    try {
      await setStatus({ data: { storeId: id, status } });
      toast.success("Status updated");
      invalidate();
    } catch (e) { toast.error((e as Error).message); }
  }
  async function setPkg(id: string, pkg: string) {
    if (!pkg) return;
    try {
      await assign({ data: { storeId: id, packageId: pkg } });
      toast.success("Package assigned");
      invalidate();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Subscriptions & Billing</h1>
          <p className="text-sm text-muted-foreground">Manage plans, trials, renewals & quotas per store.</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search store…"
          className="h-9 w-full sm:w-64 rounded-md border bg-background px-3 text-sm"
        />
      </div>

      {/* Tabs */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.v;
          return (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                active ? "bg-primary-foreground/20" : "bg-muted"
              }`}>{counts[t.v]}</span>
            </button>
          );
        })}
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 sm:hidden">
        {rows.map((s: any) => {
          const daysLeft = daysBetween(s.expires_at);
          const trialLeft = daysBetween(s.trial_ends_at);
          return (
            <div key={s.id} className="rounded-xl border bg-card p-3">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">/{s.slug}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase ${statusBadge(s.subscription_status)}`}>
                  {s.subscription_status}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <div className="text-muted-foreground">Plan</div>
                  <div className="truncate">{s.subscription_packages?.name ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Expires</div>
                  <div>{fmtDate(s.expires_at)}
                    {daysLeft !== null && (
                      <span className={`ml-1 ${daysLeft < 0 ? "text-red-500" : daysLeft <= 7 ? "text-amber-500" : "text-muted-foreground"}`}>
                        ({daysLeft >= 0 ? `${daysLeft}d` : `${-daysLeft}d ago`})
                      </span>
                    )}
                  </div>
                </div>
                {s.subscription_status === "trialing" && trialLeft !== null && (
                  <div className="col-span-2 text-amber-600 dark:text-amber-400">
                    Trial ends in {trialLeft}d
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setOpenId(s.id)}>
                  Usage
                </Button>
                {s.subscription_status !== "suspended" ? (
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setS(s.id, "suspended")}>
                    Suspend
                  </Button>
                ) : (
                  <Button size="sm" className="h-7 px-2 text-[11px]" onClick={() => setS(s.id, "active")}>
                    Reactivate
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            {isFetching ? "Loading…" : "No stores match."}
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card sm:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Store</th>
              <th className="p-3">Status</th>
              <th className="p-3">Package</th>
              <th className="p-3">Expires</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s: any) => {
              const daysLeft = daysBetween(s.expires_at);
              const trialLeft = daysBetween(s.trial_ends_at);
              return (
                <tr key={s.id} className="border-b last:border-0 align-top">
                  <td className="p-3">
                    <button className="text-left hover:underline" onClick={() => setOpenId(s.id)}>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-[11px] text-muted-foreground">/{s.slug}</div>
                    </button>
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${statusBadge(s.subscription_status)}`}>
                      {s.subscription_status}
                    </span>
                    {s.subscription_status === "trialing" && trialLeft !== null && (
                      <div className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">Trial {trialLeft}d left</div>
                    )}
                  </td>
                  <td className="p-3">
                    <select
                      value={s.package_id ?? ""}
                      onChange={(e) => setPkg(s.id, e.target.value)}
                      className="h-8 max-w-[160px] rounded-md border bg-background px-2 text-xs"
                    >
                      <option value="">{s.subscription_packages?.name ?? "—"}</option>
                      {(packages ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name} — ৳{p.price}</option>)}
                    </select>
                  </td>
                  <td className="p-3 text-xs">
                    {fmtDate(s.expires_at)}
                    {daysLeft !== null && (
                      <div className={`text-[11px] ${daysLeft < 0 ? "text-red-500" : daysLeft <= 7 ? "text-amber-500" : "text-muted-foreground"}`}>
                        {daysLeft >= 0 ? `${daysLeft}d left` : `${-daysLeft}d ago`}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setOpenId(s.id)}>
                        <Zap className="mr-1 h-3 w-3" /> Usage
                      </Button>
                      {s.subscription_status !== "suspended" ? (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setS(s.id, "suspended")}>
                          <Ban className="mr-1 h-3 w-3" /> Suspend
                        </Button>
                      ) : (
                        <Button size="sm" className="h-7 px-2 text-[11px]" onClick={() => setS(s.id, "active")}>
                          <RefreshCcw className="mr-1 h-3 w-3" /> Reactivate
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                {isFetching ? "Loading…" : "No stores match."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <UsageSheet storeId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function UsageSheet({ storeId, onClose }: { storeId: string | null; onClose: () => void }) {
  const usageFn = useServerFn(getStoreUsage);
  const { data, isLoading } = useQuery({
    queryKey: ["owner", "storeUsage", storeId],
    queryFn: () => usageFn({ data: { storeId: storeId! } }),
    enabled: !!storeId,
  });

  const store = (data as any)?.store;
  const pkg = store?.subscription_packages;
  const counts = (data as any)?.counts ?? { products: 0, orders: 0, orders30d: 0, customers: 0 };
  const ai = (data as any)?.ai ?? { cost: 0, tokens: 0, requests: 0 };

  function Bar({ used, limit }: { used: number; limit?: number | null }) {
    if (!limit) return <div className="text-[11px] text-muted-foreground">unlimited</div>;
    const pct = Math.min(100, Math.round((used / limit) * 100));
    const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
    return (
      <div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">{used} / {limit} ({pct}%)</div>
      </div>
    );
  }

  return (
    <Sheet open={!!storeId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="truncate">{store?.name ?? "Store usage"}</SheetTitle>
        </SheetHeader>
        {isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>}
        {store && (
          <div className="mt-4 space-y-4 text-sm">
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Plan</div>
                <div className="font-medium">{pkg?.name ?? "—"} · ৳{pkg?.price ?? 0}</div>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Status</div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${statusBadge(store.subscription_status)}`}>
                  {store.subscription_status}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Expires</div>
                <div className="text-xs">{fmtDate(store.expires_at)}</div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-card p-3">
              <div className="text-xs font-semibold text-muted-foreground">Usage vs plan quotas</div>
              <div>
                <div className="flex items-center gap-2 text-xs"><PackageIcon className="h-3 w-3" /> Products</div>
                <Bar used={counts.products} limit={pkg?.product_limit} />
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs"><ShoppingCart className="h-3 w-3" /> Orders (all-time)</div>
                <Bar used={counts.orders} limit={pkg?.order_limit} />
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs"><Users className="h-3 w-3" /> Customers</div>
                <Bar used={counts.customers} limit={pkg?.customer_limit} />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div className="rounded-md bg-muted p-2">
                  <div className="text-muted-foreground">Orders 30d</div>
                  <div className="font-semibold">{counts.orders30d}</div>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <div className="text-muted-foreground">Revenue</div>
                  <div className="font-semibold">৳{Number((data as any)?.revenue ?? 0).toFixed(0)}</div>
                </div>
                <div className="col-span-2 rounded-md bg-primary/10 p-2">
                  <div className="text-muted-foreground">Ad Fund (wallet)</div>
                  <div className="font-semibold text-primary">৳{Number((data as any)?.adFund ?? 0).toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-card p-3 text-[11px]">
              <div className="col-span-2 text-xs font-semibold text-muted-foreground">AI Credits</div>
              <div className="rounded-md bg-primary/10 p-2">
                <div className="text-muted-foreground">Balance (অবশিষ্ট)</div>
                <div className="font-semibold text-primary">{Number((data as any)?.aiCredits?.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
              <div className="rounded-md bg-muted p-2">
                <div className="text-muted-foreground">Used (মোট খরচ)</div>
                <div className="font-semibold">{Number((data as any)?.aiCredits?.used ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs font-semibold text-muted-foreground">AI usage (30d)</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded-md bg-muted p-2">
                  <div className="text-muted-foreground">Requests</div>
                  <div className="font-semibold">{ai.requests}</div>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <div className="text-muted-foreground">Tokens</div>
                  <div className="font-semibold">{(ai.tokens / 1000).toFixed(1)}k</div>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <div className="text-muted-foreground">Cost</div>
                  <div className="font-semibold">${ai.cost.toFixed(3)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-3">
              <div className="mb-2 text-xs font-semibold text-muted-foreground">Recent payments</div>
              <div className="space-y-1">
                {((data as any)?.recentPayments ?? []).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span>{new Date(p.created_at).toLocaleDateString()}</span>
                      <span className="uppercase text-muted-foreground">{p.method}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>৳{Number(p.amount).toFixed(0)}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                        p.status === "paid" ? "bg-emerald-100 text-emerald-700" :
                        p.status === "pending" ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>{p.status}</span>
                    </div>
                  </div>
                ))}
                {((data as any)?.recentPayments ?? []).length === 0 && (
                  <div className="text-xs text-muted-foreground">No payments yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
