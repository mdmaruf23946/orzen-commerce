import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { listAdminSubscriptions } from "@/lib/subscriptions-admin.functions";
import { CYCLE_LABEL, STATUS_LABEL, STATUS_TONE, type SubCycle, type SubStatus } from "@/lib/subscriptions";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { SubscriptionDrawer } from "@/components/admin/subscriptions/SubscriptionDrawer";
import { SubscriptionSettingsPanel } from "@/components/admin/subscriptions/SubscriptionSettingsPanel";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  component: AdminSubscriptionsPage,
  head: () => ({
    meta: [
      { title: "Subscriptions · Store Admin" },
      { name: "description", content: "Manage store subscribers, billing cycles, invoices and subscription settings." },
    ],
  }),
});

const STATUS_TABS = ["all", "active", "trialing", "pending", "past_due", "suspended", "cancelled", "expired"] as const;

const money = (n: any) => `৳${Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const date = (d: any) => (d ? new Date(d).toLocaleDateString() : "—");

function AdminSubscriptionsPage() {
  const fetchList = useServerFn(listAdminSubscriptions);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "subscriptions"], queryFn: () => fetchList() });
  const [tab, setTab] = useState<"subscribers" | "settings">("subscribers");
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = (data?.rows ?? []) as any[];
    const term = q.trim().toLowerCase();
    return list.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (!term) return true;
      return [s.subscription_no, s.customer_name, s.customer_email, s.customer_phone, s.plan_snapshot?.name]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(term));
    });
  }, [data, status, q]);

  const kpis = data?.kpis;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Subscriptions"
        description="Subscribers, billing cycles, invoices and lifecycle actions."
      />

      <div className="flex gap-1 rounded-lg border bg-card p-1 text-sm">
        {(["subscribers", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 capitalize",
              tab === t ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "settings" ? (
        <SubscriptionSettingsPanel />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi label="Active" value={kpis?.active ?? 0} />
            <Kpi label="Trialing" value={kpis?.trialing ?? 0} />
            <Kpi label="Pending" value={kpis?.pending ?? 0} />
            <Kpi label="Renewing in 7d" value={kpis?.expiring ?? 0} />
            <Kpi label="MRR" value={money(kpis?.mrr)} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search subscriber, plan or ID"
                className="pl-9"
              />
            </div>
          </div>

          <div className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
            {STATUS_TABS.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs capitalize",
                  status === s ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {s === "all" ? "All" : STATUS_LABEL[s as SubStatus] ?? s}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              No subscriptions yet.
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-2 lg:hidden">
                {rows.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setOpenId(s.id)}
                    className="w-full rounded-xl border bg-card p-3 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {s.customer_name || s.customer_email || s.subscription_no}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {s.plan_snapshot?.name ?? "Plan"} ·{" "}
                          {CYCLE_LABEL[(s.billing_cycle as SubCycle)] ?? s.billing_cycle}
                        </div>
                      </div>
                      <StatusPill status={s.status} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Next: {date(s.next_billing_date)}</span>
                      <span className="font-semibold text-foreground">{money(s.renewal_price ?? s.price)}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-3">Subscriber</th>
                      <th className="p-3">Plan</th>
                      <th className="p-3">Cycle</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Next billing</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => setOpenId(s.id)}
                        className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                      >
                        <td className="p-3">
                          <div className="font-medium">{s.customer_name || s.customer_email || "—"}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">{s.subscription_no}</div>
                        </td>
                        <td className="p-3">{s.plan_snapshot?.name ?? "—"}</td>
                        <td className="p-3">{CYCLE_LABEL[(s.billing_cycle as SubCycle)] ?? s.billing_cycle}</td>
                        <td className="p-3"><StatusPill status={s.status} /></td>
                        <td className="p-3 text-xs text-muted-foreground">{date(s.next_billing_date)}</td>
                        <td className="p-3 text-right font-semibold">{money(s.renewal_price ?? s.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      <SubscriptionDrawer id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
        STATUS_TONE[status as SubStatus] ?? "bg-muted text-muted-foreground",
      )}
    >
      {STATUS_LABEL[status as SubStatus] ?? status}
    </span>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
