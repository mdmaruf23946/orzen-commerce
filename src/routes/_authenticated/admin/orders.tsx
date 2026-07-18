import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Printer, Trash2, ShieldCheck, Eye } from "lucide-react";
import { listMyOrders, updateOrderStatus } from "@/lib/admin.functions";
import { getOrderDetails, addInternalNote, deleteInternalNote } from "@/lib/business.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FraudCheckModal } from "@/components/admin/FraudCheckModal";
import { OrderDetailsDrawer } from "@/components/admin/OrderDetailsDrawer";
import { useFeature } from "@/components/admin/FeatureGate";

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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fraudFor, setFraudFor] = useState<{ id: string; phone: string } | null>(null);
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const { allowed: fraudAllowed } = useFeature("fraud_checker");

  async function setStatus(id: string, status: Status) {
    try {
      await update({ data: { id, status } });
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast.success("Updated");
    } catch (e) { toast.error((e as Error).message); }
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
            {filtered.map((o: any) => (
              <li key={o.id}>
                <div className="p-4">
                  <button onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="flex w-full items-start justify-between gap-3 text-left">
                    <div className="flex items-start gap-2">
                      {expanded === o.id ? <ChevronDown className="mt-0.5 h-4 w-4" /> : <ChevronRight className="mt-0.5 h-4 w-4" />}
                      <div>
                        <div className="font-mono text-xs text-muted-foreground">{o.invoice_no ?? `#${o.id.slice(0, 8).toUpperCase()}`}</div>
                        <div className="text-sm font-medium">{o.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{o.phone} · {o.address}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold">৳{Number(o.subtotal).toFixed(0)}</div>
                      <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
                    </div>
                  </button>
                  <ul className="ml-6 mt-2 text-xs text-muted-foreground">
                    {o.order_items?.map((it: any, idx: number) => (
                      <li key={idx}>{it.name_snapshot} × {it.qty} — ৳{(Number(it.price_snapshot) * it.qty).toFixed(0)}</li>
                    ))}
                  </ul>
                  <div className="ml-6 mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value as Status)} className="h-8 rounded-md border bg-background px-2 text-xs capitalize">
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase">{o.payment_method}</span>
                    <Link to="/admin/invoice/$orderId" params={{ orderId: o.id }} target="_blank" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted">
                      <Printer className="h-3 w-3" /> Invoice
                    </Link>
                    <button
                      onClick={() => setDetailsFor(o.id)}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                    >
                      <Eye className="h-3 w-3" /> Details
                    </button>
                    <button
                      onClick={() => fraudAllowed
                        ? setFraudFor({ id: o.id, phone: o.phone })
                        : toast.error("Upgrade your plan to use Fraud Checker")}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${fraudAllowed ? "hover:bg-muted" : "opacity-60"}`}
                      title={fraudAllowed ? "Check customer risk" : "আপগ্রেড প্রয়োজন"}
                    >
                      <ShieldCheck className="h-3 w-3" /> Fraud Check
                    </button>
                  </div>
                </div>
                {expanded === o.id && <OrderDetails orderId={o.id} />}
              </li>
            ))}
          </ul>
        )}
      </div>
      {fraudFor && (
        <FraudCheckModal
          open={!!fraudFor}
          onOpenChange={(v) => !v && setFraudFor(null)}
          phone={fraudFor.phone}
          orderId={fraudFor.id}
        />
      )}
      {detailsFor && (
        <OrderDetailsDrawer
          open={!!detailsFor}
          onOpenChange={(v) => !v && setDetailsFor(null)}
          orderId={detailsFor}
        />
      )}
    </div>
  );
}

const STAGE_LABEL: Record<string, string> = {
  placed: "Order Placed", confirmed: "Confirmed", packed: "Packed",
  courier_assigned: "Courier Assigned", shipped: "Shipped",
  delivered: "Delivered", returned: "Returned", cancelled: "Cancelled",
};

function OrderDetails({ orderId }: { orderId: string }) {
  const fn = useServerFn(getOrderDetails);
  const addNote = useServerFn(addInternalNote);
  const delNote = useServerFn(deleteInternalNote);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["order-details", orderId], queryFn: () => fn({ data: { orderId } }) });
  const [note, setNote] = useState("");

  if (!data) return <div className="border-t bg-muted/20 p-4 text-xs text-muted-foreground">Loading…</div>;

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    await addNote({ data: { order_id: orderId, body: note.trim() } });
    setNote("");
    qc.invalidateQueries({ queryKey: ["order-details", orderId] });
  }
  async function remove(id: string) {
    await delNote({ data: { id } });
    qc.invalidateQueries({ queryKey: ["order-details", orderId] });
  }

  return (
    <div className="grid gap-4 border-t bg-muted/20 p-4 sm:grid-cols-2">
      <div className="rounded-lg border bg-card p-3">
        <div className="text-xs font-semibold uppercase text-muted-foreground">Timeline</div>
        <ol className="mt-2 space-y-2">
          {data.timeline.map((t: any) => (
            <li key={t.id} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-primary" />
              <div>
                <div className="font-medium">{STAGE_LABEL[t.stage] ?? t.stage}</div>
                <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
              </div>
            </li>
          ))}
          {data.timeline.length === 0 && <li className="text-xs text-muted-foreground">No timeline yet.</li>}
        </ol>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="text-xs font-semibold uppercase text-muted-foreground">Internal notes (owner-only)</div>
        <ul className="mt-2 space-y-2">
          {data.notes.map((n: any) => (
            <li key={n.id} className="group flex items-start justify-between gap-2 rounded bg-muted/50 p-2 text-xs">
              <div>
                <div>{n.body}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
              </div>
              <button onClick={() => remove(n.id)} className="opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3 text-destructive" /></button>
            </li>
          ))}
          {data.notes.length === 0 && <li className="text-xs text-muted-foreground">No notes yet.</li>}
        </ul>
        <form onSubmit={submitNote} className="mt-2 space-y-2">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add internal note…" className="text-xs" />
          <Button type="submit" size="sm" variant="outline" disabled={!note.trim()}>Add note</Button>
        </form>
      </div>
    </div>
  );
}
