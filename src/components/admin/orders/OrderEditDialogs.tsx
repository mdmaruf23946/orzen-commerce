import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, ImageOff, Minus, Plus, Search, Trash2 } from "lucide-react";
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
  const [pickFor, setPickFor] = useState<string | null>(null);

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
              <div key={l.key} className="min-w-0 space-y-3 rounded-xl border bg-card p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPickFor(l.key)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors hover:bg-muted/50"
                  >
                    <Thumb url={p?.image} alt={l.base} className="h-14 w-14" />
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-medium leading-snug">{l.base}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-primary">
                        পণ্য বদলান <ChevronDown className="h-3 w-3" />
                      </div>
                    </div>
                  </button>
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
                <div className="flex items-center gap-2">
                  <div className="flex shrink-0 items-center rounded-md border">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => upd(l.key, { qty: Math.max(1, l.qty - 1) })}><Minus className="h-3 w-3" /></Button>
                    <span className="w-8 text-center text-sm">{l.qty}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => upd(l.key, { qty: l.qty + 1 })}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <span className="text-xs text-muted-foreground">× ৳{l.price.toFixed(0)}</span>
                  <span className="ml-auto shrink-0 text-sm font-semibold">৳{(l.price * l.qty).toFixed(0)}</span>
                </div>
                {p && p.type === "physical" && <div className="text-[11px] text-muted-foreground">Stock: {p.stock}</div>}
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={addLine} disabled={!products.length}><Plus className="mr-1 h-3 w-3" /> Add product</Button>
          <ProductPicker
            open={pickFor !== null}
            onOpenChange={(v) => !v && setPickFor(null)}
            products={products}
            selectedId={lines.find((x) => x.key === pickFor)?.product_id ?? null}
            onPick={(id) => { if (pickFor) changeProduct(pickFor, id); setPickFor(null); }}
          />
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

function imgUrl(url: string | null | undefined) {
  if (!url) return null;
  return url.startsWith("http") ? url : `/api/img/${url}`;
}

function Thumb({ url, alt, className = "" }: { url?: string | null; alt: string; className?: string }) {
  const [err, setErr] = useState(false);
  const src = imgUrl(url);
  return (
    <div className={`shrink-0 overflow-hidden rounded-lg border bg-muted ${className}`}>
      {src && !err ? (
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" onError={() => setErr(true)} />
      ) : (
        <div className="grid h-full w-full place-items-center"><ImageOff className="h-4 w-4 text-muted-foreground" /></div>
      )}
    </div>
  );
}

type PickProduct = { id: string; name: string; price: number; stock: number; type: string; image: string | null };

function ProductPicker({ open, onOpenChange, products, selectedId, onPick }: {
  open: boolean; onOpenChange: (v: boolean) => void; products: PickProduct[]; selectedId: string | null; onPick: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  useEffect(() => { if (open) setQ(""); }, [open]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? products.filter((p) => p.name.toLowerCase().includes(s)) : products;
  }, [q, products]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-1.5rem)] max-w-md flex-col gap-3 overflow-hidden rounded-xl p-4">
        <DialogHeader><DialogTitle className="pr-6 text-left">পণ্য বাছুন</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="পণ্যের নাম লিখে খুঁজুন…" className="h-10 pl-9" />
        </div>
        <div className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
          {list.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">কোনো পণ্য পাওয়া যায়নি</p>}
          {list.map((p) => {
            const active = p.id === selectedId;
            const out = p.type === "physical" && p.stock <= 0;
            return (
              <button key={p.id} type="button" onClick={() => onPick(p.id)}
                className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors ${active ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/60"}`}>
                <Thumb url={p.image} alt={p.name} className="h-12 w-12" />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-medium leading-snug">{p.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">৳{p.price.toFixed(0)}</span>
                    {p.type === "physical"
                      ? <span className={out ? "text-destructive" : ""}>{out ? "স্টক নেই" : `Stock ${p.stock}`}</span>
                      : <span className="capitalize">{p.type}</span>}
                  </div>
                </div>
                {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
