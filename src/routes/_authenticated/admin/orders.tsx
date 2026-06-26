import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listMyOrders, updateOrderStatus } from "@/lib/admin.functions";

const STATUSES = ["pending", "confirmed", "processing", "delivered", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  const list = useServerFn(listMyOrders);
  const update = useServerFn(updateOrderStatus);
  const qc = useQueryClient();
  const { data: orders } = useQuery({ queryKey: ["admin", "orders"], queryFn: () => list() });
  const [filter, setFilter] = useState<Status | "all">("all");

  async function setStatus(id: string, status: Status) {
    try {
      await update({ data: { id, status } });
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast.success("Updated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const filtered = (orders ?? []).filter((o) => filter === "all" || o.status === filter);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Orders</h1>
      <div className="flex flex-wrap gap-2">
        {(["all", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s as any)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${filter === s ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No orders.</div>
        ) : (
          <ul className="divide-y">
            {filtered.map((o) => (
              <li key={o.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">#{o.id.slice(0, 8).toUpperCase()}</div>
                    <div className="text-sm font-medium">{o.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{o.phone} · {o.address}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold">৳{Number(o.subtotal).toFixed(0)}</div>
                    <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <ul className="mt-2 text-xs text-muted-foreground">
                  {(o as any).order_items?.map((it: any, idx: number) => (
                    <li key={idx}>
                      {it.name_snapshot} × {it.qty} — ৳{(Number(it.price_snapshot) * it.qty).toFixed(0)}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <select
                    value={o.status}
                    onChange={(e) => setStatus(o.id, e.target.value as Status)}
                    className="h-8 rounded-md border bg-background px-2 text-xs capitalize"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase">{o.payment_method}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
