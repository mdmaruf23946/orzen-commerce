import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyCustomers } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const list = useServerFn(listMyCustomers);
  const { data } = useQuery({ queryKey: ["admin", "customers"], queryFn: () => list() });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <div className="overflow-hidden rounded-xl border bg-card">
        {(data ?? []).length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No customers yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Phone</th>
                <th className="p-3 text-right">Orders</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3">Last order</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((c, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 text-muted-foreground">{c.phone}</td>
                  <td className="p-3 text-right">{c.orders}</td>
                  <td className="p-3 text-right">৳{c.total.toFixed(0)}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(c.last).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
