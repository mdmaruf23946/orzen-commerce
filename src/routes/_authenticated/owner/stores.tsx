import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listAllStores, setStoreStatus, deleteStore, assignPackage, listPackages } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/owner/stores")({
  component: OwnerStores,
});

function OwnerStores() {
  const list = useServerFn(listAllStores);
  const setStatus = useServerFn(setStoreStatus);
  const del = useServerFn(deleteStore);
  const assign = useServerFn(assignPackage);
  const pkgFn = useServerFn(listPackages);
  const qc = useQueryClient();

  const { data: stores } = useQuery({ queryKey: ["owner", "stores"], queryFn: () => list() });
  const { data: packages } = useQuery({ queryKey: ["owner", "packages"], queryFn: () => pkgFn() });

  async function toggle(id: string, current: string) {
    const next = current === "active" ? "suspended" : "active";
    await setStatus({ data: { id, status: next as any } });
    qc.invalidateQueries({ queryKey: ["owner", "stores"] });
  }
  async function remove(id: string) {
    if (!confirm("Delete store and all its data?")) return;
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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Stores</h1>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Store</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Status</th>
              <th className="p-3">Package</th>
              <th className="p-3">Expires</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(stores ?? []).map((s: any) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3 font-mono text-xs text-muted-foreground">/{s.slug}</td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${s.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="p-3">
                  <select
                    value={s.package_id ?? ""}
                    onChange={(e) => setPkg(s.id, e.target.value)}
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                  >
                    <option value="">{s.subscription_packages?.name ?? "No package"}</option>
                    {(packages ?? []).map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {s.expires_at ? new Date(s.expires_at).toLocaleDateString() : "—"}
                </td>
                <td className="p-3 text-right">
                  <Button variant="outline" size="sm" onClick={() => toggle(s.id, s.status)}>
                    {s.status === "active" ? "Suspend" : "Activate"}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(s.id)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
            {(stores ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-sm text-muted-foreground">
                  No stores yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
