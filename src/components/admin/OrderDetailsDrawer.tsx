import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Package, User, ScrollText, Truck, ShieldCheck, Phone, MapPin,
  Trash2, Printer, ImageOff,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getOrderDetails, addInternalNote, deleteInternalNote } from "@/lib/business.functions";
import { updateOrderCourierInfo } from "@/lib/ai-review.functions";
import { setOrderAllowDuplicate } from "@/lib/admin.functions";
import { getCachedFraudCheck, ensureAutoFraudCheck } from "@/lib/fraud.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FraudCheckModal, RiskBadge } from "@/components/admin/FraudCheckModal";
import { toast } from "sonner";

function resolveProductImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `/api/img/${url}`;
}

function ProductImage({ url, alt }: { url: string | null | undefined; alt: string }) {
  const [error, setError] = useState(false);
  const src = resolveProductImageUrl(url);
  if (!src || error) {
    return (
      <div className="grid h-full w-full place-items-center bg-muted">
        <ImageOff className="h-5 w-5 text-muted-foreground" />
        <span className="sr-only">{alt}</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setError(true)} />;
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
};

const STAGE_LABEL: Record<string, string> = {
  placed: "Order Placed", confirmed: "Confirmed", packed: "Packed",
  courier_assigned: "Courier Assigned", shipped: "Shipped",
  delivered: "Delivered", returned: "Returned", cancelled: "Cancelled",
};

export function OrderDetailsDrawer({ open, onOpenChange, orderId }: Props) {
  const fn = useServerFn(getOrderDetails);
  const cacheFn = useServerFn(getCachedFraudCheck);
  const autoFn = useServerFn(ensureAutoFraudCheck);
  const addNote = useServerFn(addInternalNote);
  const delNote = useServerFn(deleteInternalNote);
  const saveCourier = useServerFn(updateOrderCourierInfo);
  const allowDupFn = useServerFn(setOrderAllowDuplicate);
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [fraudOpen, setFraudOpen] = useState(false);
  const [courier, setCourier] = useState({ name: "", tracking: "", status: "" });
  const [savingCourier, setSavingCourier] = useState(false);
  const [savingAllowDup, setSavingAllowDup] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["order-drawer", orderId],
    queryFn: () => fn({ data: { orderId } }),
    enabled: open,
  });

  const phone = data?.order?.phone ?? "";
  const { data: cachedFraud } = useQuery({
    queryKey: ["fraud-cache", phone, orderId],
    queryFn: async () => {
      const cached = await cacheFn({ data: { phone } });
      if (cached) return cached;
      return await autoFn({ data: { order_id: orderId } });
    },
    enabled: open && !!phone,
    staleTime: 60_000,
    retry: false,
  });

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    await addNote({ data: { order_id: orderId, body: note.trim() } });
    setNote("");
    qc.invalidateQueries({ queryKey: ["order-drawer", orderId] });
  }
  async function remove(id: string) {
    await delNote({ data: { id } });
    qc.invalidateQueries({ queryKey: ["order-drawer", orderId] });
  }

  async function submitCourier(e: React.FormEvent) {
    e.preventDefault();
    setSavingCourier(true);
    try {
      await saveCourier({ data: {
        order_id: orderId,
        courier_name: courier.name || null,
        courier_tracking_id: courier.tracking || null,
        courier_status: courier.status || null,
      } });
      qc.invalidateQueries({ queryKey: ["order-drawer", orderId] });
      toast.success("Courier updated");
    } catch (err) { toast.error((err as Error).message); }
    finally { setSavingCourier(false); }
  }

  const order: any = data?.order;
  const items: any[] = data?.items ?? [];
  const timeline: any[] = data?.timeline ?? [];
  const notes: any[] = data?.notes ?? [];

  const subtotal = Number(order?.subtotal ?? 0);
  const discount = Number(order?.discount_amount ?? 0);
  const delivery = Number(order?.delivery_amount ?? 0);
  const total = subtotal + delivery - discount;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 sm:max-w-lg"
        >
          <SheetHeader className="sticky top-0 z-10 border-b bg-background px-4 py-3">
            <SheetTitle className="flex items-center justify-between gap-2 text-base">
              <span className="truncate">Order Details</span>
              {order?.invoice_no && (
                <Link
                  to="/admin/invoice/$orderId"
                  params={{ orderId }}
                  target="_blank"
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-normal hover:bg-muted"
                >
                  <Printer className="h-3 w-3" /> Invoice
                </Link>
              )}
            </SheetTitle>
          </SheetHeader>

          {isLoading || !order ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="space-y-3 p-4">
              {/* Products */}
              <Section icon={Package} title="Product">
                <ul className="divide-y">
                  {items.map((it, i) => (
                    <li key={i} className="space-y-3 py-3">
                      <div className="mx-auto h-32 w-32 shrink-0 overflow-hidden rounded-xl border bg-muted sm:h-36 sm:w-36">
                        <ProductImage url={it.products?.primary_image_url} alt={it.name_snapshot} />
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium">{it.name_snapshot}</div>
                        {it.products?.sku && <div className="text-[10px] text-muted-foreground">SKU: {it.products.sku}</div>}
                        <div className="mt-1 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                          <span>Qty {it.qty} · ৳{Number(it.price_snapshot).toFixed(0)}</span>
                          <span className="font-semibold text-foreground">৳{(Number(it.price_snapshot) * it.qty).toFixed(0)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 space-y-1 border-t pt-2 text-xs">
                  <Row label="Subtotal" value={`৳${subtotal.toFixed(0)}`} />
                  {discount > 0 && <Row label="Discount" value={`− ৳${discount.toFixed(0)}`} />}
                  <Row label="Delivery" value={`৳${delivery.toFixed(0)}`} />
                  <div className="flex items-center justify-between border-t pt-1 text-sm font-semibold">
                    <span>Total</span><span>৳{total.toFixed(0)}</span>
                  </div>
                </div>
              </Section>

              {/* Customer */}
              <Section icon={User} title="Customer">
                <div className="space-y-1 text-sm">
                  <div className="font-medium">{order.customer_name}</div>
                  <a href={`tel:${order.phone}`} className="flex items-center gap-1.5 text-xs text-primary">
                    <Phone className="h-3 w-3" /> {order.phone}
                  </a>
                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {order.address}
                  </div>
                </div>
              </Section>

              {/* Order info */}
              <Section icon={ScrollText} title="Order">
                <dl className="grid grid-cols-2 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Invoice</dt>
                  <dd className="text-right font-mono">{order.invoice_no ?? `#${orderId.slice(0, 8).toUpperCase()}`}</dd>
                  <dt className="text-muted-foreground">Date</dt>
                  <dd className="text-right">{new Date(order.created_at).toLocaleString()}</dd>
                  <dt className="text-muted-foreground">Payment</dt>
                  <dd className="text-right uppercase">{order.payment_method}</dd>
                  {order.txn_id && <><dt className="text-muted-foreground">Txn ID</dt><dd className="text-right font-mono">{order.txn_id}</dd></>}
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="text-right capitalize">{order.status}</dd>
                </dl>
              </Section>

              {/* Courier + fraud */}
              <Section icon={Truck} title="Courier & Risk">
                <div className="flex items-center justify-between gap-2">
                  {cachedFraud ? <RiskBadge risk={(cachedFraud as any).risk} /> : <span className="text-xs text-muted-foreground">Checking…</span>}
                  <Button size="sm" variant="outline" onClick={() => setFraudOpen(true)}>
                    <ShieldCheck className="mr-1 h-3 w-3" /> {cachedFraud ? "View / Re-check" : "Fraud Check"}
                  </Button>
                </div>
                {cachedFraud && (
                  <>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <MiniStat label="Total Orders" value={(cachedFraud as any).total_orders ?? 0} />
                      <MiniStat label="Successful" value={(cachedFraud as any).successful ?? 0} />
                      <MiniStat label="Returned" value={(cachedFraud as any).returned ?? 0} />
                      <MiniStat label="Cancelled" value={(cachedFraud as any).cancelled ?? 0} />
                      <MiniStat label="COD Success" value={`${(cachedFraud as any).cod_success_rate ?? 0}%`} />
                      <MiniStat label="Last Delivery" value={(cachedFraud as any).last_delivery ? new Date((cachedFraud as any).last_delivery).toLocaleDateString() : "—"} />
                    </div>
                    {Array.isArray((cachedFraud as any).courier_history) && (cachedFraud as any).courier_history.length > 0 && (
                      <details className="mt-2 rounded-lg border p-2.5">
                        <summary className="cursor-pointer text-[11px] font-medium">Courier History</summary>
                        <ul className="mt-1.5 space-y-1 text-[11px]">
                          {(cachedFraud as any).courier_history.map((c: any, i: number) => (
                            <li key={i} className="flex items-center justify-between">
                              <span className="capitalize">{c.courier}</span>
                              <span className="text-muted-foreground">{c.success}/{c.total} · {c.rate}%</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10px] text-muted-foreground">
                      <span>Last Checked: {new Date((cachedFraud as any).checked_at).toLocaleString()}</span>
                      <span>
                        {Math.min((cachedFraud as any).check_count ?? 1, (cachedFraud as any).max_checks ?? 2)}/{(cachedFraud as any).max_checks ?? 2} · <span className="capitalize">{(cachedFraud as any).last_check_source ?? "system"}</span>
                      </span>
                    </div>
                  </>
                )}
              </Section>

              {/* Timeline */}
              <Section icon={ScrollText} title="Timeline">
                <ol className="space-y-2">
                  {timeline.map((t) => (
                    <li key={t.id} className="flex items-start gap-2 text-xs">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <div>
                        <div className="font-medium">{STAGE_LABEL[t.stage] ?? t.stage}</div>
                        <div className="text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                      </div>
                    </li>
                  ))}
                  {timeline.length === 0 && <li className="text-xs text-muted-foreground">No events yet.</li>}
                </ol>
              </Section>

              {/* Courier tracking editor */}
              <Section icon={Truck} title="Courier tracking">
                {(order.courier_name || order.courier_tracking_id || order.courier_status) && (
                  <div className="mb-2 rounded-md bg-muted/40 p-2 text-xs">
                    {order.courier_name && <div><span className="text-muted-foreground">Courier:</span> {order.courier_name}</div>}
                    {order.courier_tracking_id && <div><span className="text-muted-foreground">Tracking:</span> <span className="font-mono">{order.courier_tracking_id}</span></div>}
                    {order.courier_status && <div><span className="text-muted-foreground">Status:</span> {order.courier_status}</div>}
                    {order.courier_last_synced_at && <div className="text-[10px] text-muted-foreground">Updated {new Date(order.courier_last_synced_at).toLocaleString()}</div>}
                  </div>
                )}
                <form onSubmit={submitCourier} className="space-y-2">
                  <Input placeholder="Courier (e.g. Pathao, Steadfast)" value={courier.name} onChange={(e) => setCourier((c) => ({ ...c, name: e.target.value }))} className="h-8 text-xs" />
                  <Input placeholder="Tracking ID" value={courier.tracking} onChange={(e) => setCourier((c) => ({ ...c, tracking: e.target.value }))} className="h-8 text-xs" />
                  <Input placeholder="Status (e.g. In Transit)" value={courier.status} onChange={(e) => setCourier((c) => ({ ...c, status: e.target.value }))} className="h-8 text-xs" />
                  <Button type="submit" size="sm" variant="outline" disabled={savingCourier}>{savingCourier ? "Saving…" : "Update courier"}</Button>
                </form>
              </Section>

              {/* Notes */}
              <Section icon={ScrollText} title="Internal Notes">
                <ul className="space-y-1.5">
                  {notes.map((n) => (
                    <li key={n.id} className="group flex items-start justify-between gap-2 rounded bg-muted/40 p-2 text-xs">
                      <div>
                        <div>{n.body}</div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
                      </div>
                      <button onClick={() => remove(n.id)} className="opacity-60 hover:opacity-100"><Trash2 className="h-3 w-3 text-destructive" /></button>
                    </li>
                  ))}
                  {notes.length === 0 && <li className="text-xs text-muted-foreground">No notes yet.</li>}
                </ul>
                <form onSubmit={submitNote} className="mt-2 space-y-2">
                  <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add internal note…" className="text-xs" />
                  <Button type="submit" size="sm" variant="outline" disabled={!note.trim()}>Add note</Button>
                </form>
              </Section>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {phone && (
        <FraudCheckModal open={fraudOpen} onOpenChange={setFraudOpen} phone={phone} orderId={orderId} />
      )}
    </>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details open className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">{title}</span>
      </summary>
      <div className="border-t px-3 py-3">{children}</div>
    </details>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
function MiniStat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
