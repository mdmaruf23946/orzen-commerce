import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listSubscriptionStores, extendSubscription, setSubscriptionStatus, assignPackage, listPackages } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/owner/subscriptions")({
  component: SubscriptionsPage,
});

const FILTERS = [
  { v: "all", label: "All" },
  { v: "trialing", label: "Trial" },
  { v: "active", label: "Active" },
  { v: "expired", label: "Expired" },
  { v: "suspended", label: "Suspended" },
];

function SubscriptionsPage() {
  const listFn = useServerFn(listSubscriptionStores);
  const pkgFn = useServerFn(listPackages);
  const extend = useServerFn(extendSubscription);
  const setStatus = useServerFn(setSubscriptionStatus);
  const assign = useServerFn(assignPackage);
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");

  const { data: stores } = useQuery({
    queryKey: ["owner", "subscriptions", filter],
    queryFn: () => listFn({ data: { filter } }),
  });
  const { data: packages } = useQuery({ queryKey: ["owner", "packages"], queryFn: () => pkgFn() });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["owner", "subscriptions"] });
  }
  async function doExtend(id: string) {
    const days = parseInt(prompt("Extend by how many days?", "30") ?? "0", 10);
    if (!days) return;
    await extend({ data: { storeId: id, days } }); toast.success("Extended"); invalidate();
  }
  async function setS(id: string, status: any) {
    await setStatus({ data: { storeId: id, status } }); toast.success("Updated"); invalidate();
  }
  async function setPkg(id: string, pkg: string) {
    if (!pkg) return;
    await assign({ data: { storeId: id, packageId: pkg } }); toast.success("Package assigned"); invalidate();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Subscriptions</h1>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className={`rounded-full border px-3 py-1 text-xs ${filter === f.v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
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
            {(stores ?? []).map((s: any) => {
              const daysLeft = s.expires_at ? Math.ceil((new Date(s.expires_at).getTime() - Date.now()) / 86400000) : null;
              return (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="p-3 font-medium">{s.name}<div className="text-[11px] text-muted-foreground">/{s.slug}</div></td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${
                      s.subscription_status === "active" ? "bg-emerald-100 text-emerald-700" :
                      s.subscription_status === "trialing" ? "bg-amber-100 text-amber-700" :
                      s.subscription_status === "expired" ? "bg-red-100 text-red-700" :
                      "bg-muted"
                    }`}>{s.subscription_status}</span>
                  </td>
                  <td className="p-3">
                    <select value={s.package_id ?? ""} onChange={(e) => setPkg(s.id, e.target.value)}
                      className="h-8 rounded-md border bg-background px-2 text-xs">
                      <option value="">{s.subscription_packages?.name ?? "—"}</option>
                      {(packages ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td className="p-3 text-xs">
                    {s.expires_at ? new Date(s.expires_at).toLocaleDateString() : "—"}
                    {daysLeft !== null && <div className="text-[11px] text-muted-foreground">{daysLeft >= 0 ? `${daysLeft}d left` : `${-daysLeft}d ago`}</div>}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" onClick={() => doExtend(s.id)}>Extend</Button>
                      {s.subscription_status !== "suspended" ? (
                        <Button size="sm" variant="outline" onClick={() => setS(s.id, "suspended")}>Suspend</Button>
                      ) : (
                        <Button size="sm" onClick={() => setS(s.id, "active")}>Reactivate</Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {(stores ?? []).length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">No stores</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
