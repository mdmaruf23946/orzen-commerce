import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { listReturns, upsertReturn } from "@/lib/business.functions";
import { listMyOrders } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STATUSES = ["requested", "approved", "rejected", "refunded", "completed"] as const;

export const Route = createFileRoute("/_authenticated/admin/returns")({
  component: () => <FeatureGate feature="returns"><ReturnsPage /></FeatureGate>,
});

function ReturnsPage() {
  const list = useServerFn(listReturns);
  const save = useServerFn(upsertReturn);
  const ordersFn = useServerFn(listMyOrders);
  const qc = useQueryClient();
  const { data: rows } = useQuery({ queryKey: ["returns"], queryFn: () => list() });
  const { data: orders } = useQuery({ queryKey: ["admin", "orders"], queryFn: () => ordersFn() });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  async function setStatus(r: any, status: string) {
    await save({ data: { id: r.id, order_id: r.order_id, type: r.type, status: status as any, reason: r.reason, refund_amount: Number(r.refund_amount ?? 0), resolution_note: r.resolution_note } });
    qc.invalidateQueries({ queryKey: ["returns"] });
    toast.success("Updated");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Returns & Exchanges</h1>
        <Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />New request</Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        {(rows ?? []).length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No returns yet.</div>
        ) : (
          <ul className="divide-y">
            {(rows ?? []).map((r: any) => (
              <li key={r.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-mono text-muted-foreground">{r.orders?.invoice_no ?? r.order_id.slice(0, 8).toUpperCase()}</div>
                    <div className="text-sm font-medium">{r.orders?.customer_name} · {r.orders?.phone}</div>
                    <div className="text-xs capitalize text-muted-foreground">{r.type} · {r.reason ?? "no reason"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">Refund: ৳{Number(r.refund_amount ?? 0).toFixed(0)}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select value={r.status} onChange={(e) => setStatus(r, e.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs capitalize">
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  {r.resolution_note && <span className="text-xs text-muted-foreground">{r.resolution_note}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent>
            <DialogHeader><DialogTitle>New return request</DialogTitle></DialogHeader>
            <ReturnForm
              orders={orders ?? []}
              onSave={async (d) => { await save({ data: d }); qc.invalidateQueries({ queryKey: ["returns"] }); toast.success("Created"); setOpen(false); }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ReturnForm({ orders, onSave }: { orders: any[]; onSave: (d: any) => Promise<void> }) {
  const [orderId, setOrderId] = useState("");
  const [type, setType] = useState<"return" | "exchange">("return");
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave({ order_id: orderId, type, reason, status: "requested", refund_amount: refund, resolution_note: note }); }
    catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Order</Label>
        <select required value={orderId} onChange={(e) => setOrderId(e.target.value)} className="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">Select order…</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>#{o.id.slice(0, 8)} · {o.customer_name} · ৳{Number(o.subtotal).toFixed(0)}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Type</Label>
        <select value={type} onChange={(e) => setType(e.target.value as any)} className="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
          <option value="return">Return</option>
          <option value="exchange">Exchange</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Reason</Label>
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Refund amount (৳)</Label>
        <Input type="number" min={0} step="0.01" value={refund} onChange={(e) => setRefund(Number(e.target.value))} />
      </div>
      <div className="space-y-1.5">
        <Label>Resolution note</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button type="submit" disabled={saving} className="w-full">{saving ? "Saving…" : "Create"}</Button>
    </form>
  );
}
