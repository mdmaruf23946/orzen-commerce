import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminListCustomerAccounts,
  adminGetCustomerAccount,
  adminSetCustomerActive,
  adminDeleteCustomerAccount,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/customers-accounts")({
  component: CustomerAccountsPage,
});

function CustomerAccountsPage() {
  const list = useServerFn(adminListCustomerAccounts);
  const setActive = useServerFn(adminSetCustomerActive);
  const del = useServerFn(adminDeleteCustomerAccount);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "customer-accounts", search],
    queryFn: () => list({ data: { search: search || undefined } }),
  });

  async function toggleActive(id: string, active: boolean) {
    try {
      await setActive({ data: { customerId: id, active } });
      qc.invalidateQueries({ queryKey: ["admin", "customer-accounts"] });
      toast.success(active ? "Account activated" : "Account deactivated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function remove(id: string) {
    if (!confirm("Delete this customer account? Their orders will be kept.")) return;
    try {
      await del({ data: { customerId: id } });
      qc.invalidateQueries({ queryKey: ["admin", "customer-accounts"] });
      toast.success("Deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Customer Accounts</h1>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone…"
            className="pl-8"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (data ?? []).length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No customer accounts yet.
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <ul className="divide-y sm:hidden">
              {(data ?? []).map((c: any) => (
                <li key={c.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-muted">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.full_name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.email || c.phone}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {c.order_count} orders · {c.is_active ? "Active" : "Disabled"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelected(c.id)}>View</Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(c.id, !c.is_active)}>
                      {c.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(c.id)}>Delete</Button>
                  </div>
                </li>
              ))}
            </ul>
            {/* Desktop table */}
            <table className="hidden w-full text-sm sm:table">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3 text-right">Orders</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((c: any) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{c.full_name}</td>
                    <td className="p-3 text-muted-foreground">
                      <div>{c.email}</div>
                      <div className="text-xs">{c.phone}</div>
                    </td>
                    <td className="p-3 text-right">{c.order_count}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${c.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                        {c.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setSelected(c.id)}>View</Button>
                        <Button size="sm" variant="outline" onClick={() => toggleActive(c.id, !c.is_active)}>
                          {c.is_active ? "Disable" : "Enable"}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(c.id)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {selected && (
        <CustomerDetail id={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function CustomerDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const get = useServerFn(adminGetCustomerAccount);
  const { data } = useQuery({
    queryKey: ["admin", "customer-account", id],
    queryFn: () => get({ data: { customerId: id } }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{data?.full_name ?? "Customer"}</DialogTitle>
        </DialogHeader>
        {!data ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
              <div>
                <div className="text-xs text-muted-foreground">Email</div>
                <div>{data.email ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Phone</div>
                <div>{data.phone ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Joined</div>
                <div>{new Date(data.created_at).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Last login</div>
                <div>{data.last_login_at ? new Date(data.last_login_at).toLocaleString() : "Never"}</div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Recent orders</h3>
              {data.orders.length === 0 ? (
                <p className="text-xs text-muted-foreground">No orders.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {data.orders.map((o: any) => (
                    <li key={o.id} className="flex items-center justify-between p-2 text-xs">
                      <span>{o.invoice_no} · {o.status}</span>
                      <span>৳{Number(o.subtotal).toFixed(0)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Saved addresses</h3>
              {data.addresses.length === 0 ? (
                <p className="text-xs text-muted-foreground">No saved addresses.</p>
              ) : (
                <ul className="space-y-2">
                  {data.addresses.map((a: any) => (
                    <li key={a.id} className="rounded-md border p-2 text-xs">
                      <div className="font-medium">{a.label ?? a.name} {a.is_default && <span className="ml-1 text-muted-foreground">(default)</span>}</div>
                      <div className="text-muted-foreground">{a.address}{a.area ? `, ${a.area}` : ""}</div>
                      <div className="text-muted-foreground">{a.phone}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
