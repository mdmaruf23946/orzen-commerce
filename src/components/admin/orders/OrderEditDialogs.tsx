import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { updateOrderCustomer, updateOrderItems, listEditableProducts, listOrderDeliveryZones } from "@/lib/order-edit.functions";

export function EditCustomerDialog({ open, onOpenChange, order, isPhysical, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; order: any; isPhysical: boolean; onSaved: () => void;
}) {
  const save = useServerFn(updateOrderCustomer);
  const [f, setF] = useState({ customer_name: "", phone: "", email: "", address: "", area: "", notes: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open && order) setF({
      customer_name: order.customer_name ?? "", phone: order.phone ?? "", email: order.email ?? "",
      address: order.address ?? "", area: order.area ?? "", notes: order.notes ?? "",
    });
  }, [open, order]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ data: { order_id: order.id, ...f } });
      toast.success("কাস্টমারের তথ্য সেভ হয়েছে");
      onSaved(); onOpenChange(false);
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1"><Label>Name</Label><Input value={f.customer_name} onChange={set("customer_name")} required /></div>
          <div className="space-y-1"><Label>Phone</Label><Input value={f.phone} onChange={set("phone")} inputMode="tel" required /></div>
          <div className="space-y-1"><Label>Email</Label><Input type="email" value={f.email} onChange={set("email")} /></div>
          {isPhysical && (
            <>
              <div className="space-y-1"><Label>Delivery address</Label><Textarea rows={2} value={f.address} onChange={set("address")} /></div>
              <div className="space-y-1"><Label>Area / City</Label><Input value={f.area} onChange={set("area")} /></div>
            </>
          )}
          <div className="space-y-1"><Label>Order note</Label><Textarea rows={2} value={f.notes} onChange={set("notes")} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Line = { key: string; product_id: string | null; base: string; variant: string; price: number; qty: number };

export function EditItemsDialog({ open, onOpenChange, order, items, isPhysical, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; order: any; items: any[]; isPhysical: boolean; onSaved: () => void;
}) {
  const save = useServerFn(updateOrderItems);
  const listFn = useServerFn(listEditableProducts);
  const { data: products = [] } = useQuery({ queryKey: ["order-edit-products"], queryFn: () => listFn(), enabled: open, staleTime: 60_000 });
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const zonesFn = useServerFn(listOrderDeliveryZones);
  const { data: zones = [] } = useQuery({ queryKey: ["order-edit-zones"], queryFn: () => zonesFn(), enabled: open && isPhysical, staleTime: 60_000 });
  const [lines, setLines] = useState<Line[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLines(items.map((it, i) => ({
      key: String(i), product_id: it.product_id ?? null, base: it.name_snapshot, variant: "",
      price: Number(it.price_snapshot ?? 0), qty: Number(it.qty ?? 1),
    })));
    setZoneId(order?.delivery_zone_id ?? "");
    setDiscount(Number(order?.discount_amount ?? 0));
  }, [open, items, order]);

  const zone = zones.find((z) => z.id === zoneId);
  const delivery = isPhysical ? (zone ? zone.charge : Number(order?.delivery_amount ?? 0)) : Number(order?.delivery_amount ?? 0);
  const upd = (k: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...patch } : l)));
  const itemsTotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const total = Math.max(itemsTotal + delivery - discount, 0);

  function changeProduct(k: string, id: string) {
    const p = byId.get(id); if (!p) return;
    upd(k, { product_id: p.id, base: p.name, variant: "", price: p.price });
  }
  function changeVariant(l: Line, vid: string) {
    const p = l.product_id ? byId.get(l.product_id) : null; if (!p) return;
    const v = p.variants.find((x) => x.id === vid);
    upd(l.key, v ? { base: p.name, variant: v.label, price: v.price } : { base: p.name, variant: "", price: p.price });
  }
  function addLine() {
    const p = products[0];
    setLines((ls) => [...ls, { key: crypto.randomUUID(), product_id: p?.id ?? null, base: p?.name ?? "Item", variant: "", price: p?.price ?? 0, qty: 1 }]);
  }

  async function submit() {
    if (!lines.length) return toast.error("অন্তত একটি পণ্য রাখুন");
    setBusy(true);
    try {
      await save({ data: {
        order_id: order.id, delivery_zone_id: isPhysical && zone ? zone.id : null, discount_amount: discount,
        items: lines.map((l) => ({ product_id: l.product_id, name: l.variant ? `${l.base} — ${l.variant}` : l.base, price: l.price, qty: l.qty })),
      } });
      toast.success("পণ্যের তথ্য সেভ হয়েছে");
      onSaved(); onOpenChange(false);
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto overflow-x-hidden rounded-lg p-4 sm:p-6">
        <DialogHeader><DialogTitle className="pr-6 text-left">Edit Products</DialogTitle></DialogHeader>
        <div className="min-w-0 space-y-3">
          {lines.map((l) => {
            const p = l.product_id ? byId.get(l.product_id) : null;
            return (
              <div key={l.key} className="min-w-0 space-y-2 rounded-lg border p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <select
                    className="h-9 w-full min-w-0 truncate rounded-md border bg-background px-2 text-sm"
                    value={l.product_id ?? ""}
                    onChange={(e) => changeProduct(l.key, e.target.value)}
                  >
                    {!p && <option value="">{l.base}</option>}
                    {products.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.type})</option>)}
                  </select>
                  <Button size="icon" variant="ghost" className="shrink-0" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remove">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                {p && p.variants.length > 0 && (
                  <select
                    className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm"
                    value={p.variants.find((v) => v.label === l.variant)?.id ?? ""}
                    onChange={(e) => changeVariant(l, e.target.value)}
                  >
                    <option value="">Variant বাছুন</option>
                    {p.variants.map((v) => <option key={v.id} value={v.id}>{v.label} · ৳{v.price}</option>)}
                  </select>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex shrink-0 items-center rounded-md border">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => upd(l.key, { qty: Math.max(1, l.qty - 1) })}><Minus className="h-3 w-3" /></Button>
                    <span className="w-8 text-center text-sm">{l.qty}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => upd(l.key, { qty: l.qty + 1 })}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="text-xs text-muted-foreground">৳</span>
                    <Input type="number" min={0} className="h-8 w-20" value={l.price} onChange={(e) => upd(l.key, { price: Number(e.target.value) || 0 })} />
                  </div>
                  <span className="ml-auto shrink-0 text-sm font-semibold">৳{(l.price * l.qty).toFixed(0)}</span>
                </div>
                {p && p.type === "physical" && <div className="text-[11px] text-muted-foreground">Stock: {p.stock}</div>}
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={addLine} disabled={!products.length}><Plus className="mr-1 h-3 w-3" /> Add product</Button>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {isPhysical && (
              <div className="min-w-0 space-y-1">
                <Label>Delivery zone</Label>
                {zones.length ? (
                  <select
                    className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm"
                    value={zoneId}
                    onChange={(e) => setZoneId(e.target.value)}
                  >
                    {!zoneId && <option value="">জোন বাছুন (বর্তমান ৳{delivery.toFixed(0)})</option>}
                    {zones.map((z) => <option key={z.id} value={z.id}>{z.name} — ৳{z.charge}</option>)}
                  </select>
                ) : (
                  <p className="text-xs text-muted-foreground">কোনো ডেলিভারি জোন যোগ করা নেই — Delivery Zones পেজ থেকে যোগ করুন।</p>
                )}
              </div>
            )}
            <div className="min-w-0 space-y-1"><Label>Discount</Label><Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} /></div>
          </div>
          <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
            <div className="flex justify-between gap-2"><span>Subtotal</span><span>৳{itemsTotal.toFixed(0)}</span></div>
            {isPhysical && <div className="flex justify-between gap-2"><span>Delivery</span><span>৳{delivery.toFixed(0)}</span></div>}
            {discount > 0 && <div className="flex justify-between gap-2"><span>Discount</span><span>− ৳{discount.toFixed(0)}</span></div>}
            <div className="flex justify-between gap-2 border-t pt-1 font-semibold"><span>Total</span><span>৳{total.toFixed(0)}</span></div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
