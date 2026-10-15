import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Package, User, ScrollText, Truck, ShieldCheck, Phone, MapPin,
  Trash2, Printer, ImageOff, Pencil, Lock, MessageCircle, Copy, ClipboardList,
  ArrowLeft, Download, ChevronDown, RefreshCw, ShoppingBag, CalendarDays, Globe,
  LayoutGrid, Clock, Check, PhoneCall,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDuration } from "@/lib/call-center";
import { Link } from "@tanstack/react-router";
import { getOrderDetails, addInternalNote, deleteInternalNote } from "@/lib/business.functions";
import { updateOrderCourierInfo } from "@/lib/ai-review.functions";
import { setOrderAllowDuplicate, updateOrderStatus } from "@/lib/admin.functions";
import { getOrderCustomerStats } from "@/lib/orders-admin.functions";
import { getCachedFraudCheck, ensureAutoFraudCheck } from "@/lib/fraud.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FraudCheckModal, RiskBadge } from "@/components/admin/FraudCheckModal";
import { ServiceWorkflowPanel } from "@/components/admin/service/ServiceWorkflowPanel";
import { SubscriptionOrderPanel } from "@/components/admin/subscriptions/SubscriptionOrderPanel";
import { CallHistoryList } from "@/components/admin/calls/CallHistoryList";
import { getCallsForOrder } from "@/lib/call-center.functions";

import { toast } from "sonner";
import { EditCustomerDialog, EditItemsDialog } from "@/components/admin/orders/OrderEditDialogs";
import { OrderEditHistory } from "@/components/admin/orders/OrderEditHistory";

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
  const [editCustomer, setEditCustomer] = useState(false);
  const [editItems, setEditItems] = useState(false);

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

  const kind: string = order?.order_type ?? "physical";
  const isPhysical = kind === "physical";
  const fulfil: any = order?.fulfillment_meta ?? {};
  const canEdit = order?.status === "pending" && !order?.courier_tracking_id;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["order-drawer", orderId] });
    qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    qc.invalidateQueries({ queryKey: ["order-edit-history", orderId] });
  };
  const editBtn = (onClick: () => void) => canEdit ? (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-normal hover:bg-muted">
      <Pencil className="h-3 w-3" /> Edit
    </button>
  ) : (
    <span title="শুধু Pending অর্ডার এডিট করা যায়" className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
      <Lock className="h-3 w-3" /> Locked
    </span>
  );

  // orders.subtotal already holds the grand total (items + delivery − discount)
  // for storefront, quick and chat orders — never add delivery to it again.
  const discount = Number(order?.discount_amount ?? 0);
  const delivery = Number(order?.delivery_amount ?? 0);
  const itemsTotal = items.reduce(
    (sum, it) => sum + Number(it.price_snapshot ?? 0) * Number(it.qty ?? 0),
    0,
  );
  const total = Number(order?.subtotal ?? 0);
  const subtotal = items.length ? itemsTotal : Math.max(total - delivery + discount, 0);

  const statusFn = useServerFn(updateOrderStatus);
  const [tab, setTab] = useState<"timeline" | "tracking" | "notes">("timeline");
  async function changeStatus(s: string) {
    try {
      await statusFn({ data: { id: orderId, status: s as any } });
      toast.success("Status updated");
      refresh();
    } catch (err) { toast.error((err as Error).message); }
  }
  const invoiceLabel = order ? (order.invoice_no ?? `#${orderId.slice(0, 8).toUpperCase()}`) : "";
  const itemCount = items.reduce((s, it) => s + Number(it.qty ?? 0), 0);
  const paid = order?.payment_status === "paid" || (!!order?.txn_id && order?.payment_method !== "cod");
  const copyText = order ? [
    order.customer_name, order.phone, isPhysical ? [order.address, order.area].filter(Boolean).join(", ") : null,
    items.map((it) => `${it.name_snapshot} x${it.qty}`).join(", "),
    `Total: ৳${total.toFixed(0)}`,
  ].filter(Boolean).join("\n") : "";

  return (
    <>
      {order && (
        <>
          <EditCustomerDialog open={editCustomer} onOpenChange={setEditCustomer} order={order} isPhysical={isPhysical} onSaved={refresh} />
          <EditItemsDialog open={editItems} onOpenChange={setEditItems} order={order} items={items} isPhysical={isPhysical} onSaved={refresh} />
        </>
      )}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-muted/40 p-0 sm:max-w-full lg:max-w-[1280px]">
          <SheetHeader className="sr-only"><SheetTitle>Order Details</SheetTitle></SheetHeader>

          <div className="space-y-4 p-3 sm:p-5 lg:p-6">
            {/* Page header */}
            <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <button type="button" onClick={() => onOpenChange(false)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Orders
                </button>
                <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Order Details</h2>
                <p className="text-xs text-muted-foreground sm:text-sm">View complete information about this order, products, customer and delivery status.</p>
              </div>
              {order && (
                <div className="flex flex-wrap gap-2">
                  <Link to="/admin/invoice/$orderId" params={{ orderId }} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium shadow-sm hover:bg-muted">
                    <Printer className="h-4 w-4" /> Print
                  </Link>
                  <Link to="/admin/invoice/$orderId" params={{ orderId }} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium shadow-sm hover:bg-muted">
                    <Download className="h-4 w-4" /> Download Invoice
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="h-9 gap-1.5"><RefreshCw className="h-4 w-4" /> Update Status <ChevronDown className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {STATUS_OPTIONS.map((s) => (
                        <DropdownMenuItem key={s} disabled={s === order.status} onClick={() => changeStatus(s)} className="capitalize">
                          {s.replace(/_/g, " ")}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            {isLoading || !order ? (
              <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-5">
                {/* LEFT */}
                <div className="min-w-0 space-y-4 lg:space-y-5">
                  {/* Summary */}
                  <Card className="p-4 sm:p-5">
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_1fr_1fr] sm:divide-x">
                      <div className="flex gap-3">
                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                          <ShoppingBag className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-base font-bold">Order {invoiceLabel}</span>
                            <Pill tone="primary">{String(order.status).replace(/_/g, " ")}</Pill>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Ordered on {fmtDate(order.created_at)}</div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Globe className="h-3.5 w-3.5" /> Source: <span className="font-medium capitalize text-foreground">{order.source ?? order.order_source ?? "Website"}</span></div>
                        </div>
                      </div>
                      <div className="space-y-2 sm:pl-4">
                        <div>
                          <div className="text-[11px] text-muted-foreground">Payment Status</div>
                          <Pill tone={paid ? "primary" : "muted"}>{paid ? "Paid" : "Unpaid"}</Pill>
                        </div>
                        <div>
                          <div className="text-[11px] text-muted-foreground">Payment Method</div>
                          <div className="text-sm font-medium">{payLabel(order.payment_method)}</div>
                        </div>
                      </div>
                      <div className="sm:pl-4">
                        <div className="text-[11px] text-muted-foreground">Total Amount</div>
                        <div className="text-2xl font-bold tracking-tight">৳ {total.toLocaleString("en-BD")}</div>
                        <div className="text-xs text-muted-foreground">({itemCount} items)</div>
                      </div>
                    </div>
                  </Card>

                  {/* Products */}
                  <Card>
                    <CardHead icon={LayoutGrid} title={`Ordered Products (${items.length})`} action={editBtn(() => setEditItems(true))} />
                    <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                      <div className="overflow-hidden rounded-xl border">
                        <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_60px_90px_90px] gap-3 bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid">
                          <span>Product</span><span>Variant</span><span className="text-center">Qty</span><span>Unit Price</span><span className="text-right">Subtotal</span>
                        </div>
                        <ul className="divide-y">
                          {items.map((it, i) => {
                            const variant = variantPairs(it);
                            return (
                              <li key={i} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 px-3 py-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_60px_90px_90px] md:items-center md:px-4">
                                <div className="flex min-w-0 items-center gap-3 md:col-span-1">
                                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
                                    <ProductImage url={it.products?.primary_image_url} alt={it.name_snapshot} />
                                  </div>
                                  <div className="hidden min-w-0 md:block">
                                    <div className="line-clamp-2 text-sm font-semibold">{it.name_snapshot}</div>
                                    {it.products?.sku && <div className="mt-0.5 text-[11px] text-muted-foreground">SKU: {it.products.sku}</div>}
                                  </div>
                                </div>
                                <div className="min-w-0 md:hidden">
                                  <div className="line-clamp-2 text-sm font-semibold">{it.name_snapshot}</div>
                                  {it.products?.sku && <div className="text-[11px] text-muted-foreground">SKU: {it.products.sku}</div>}
                                  {variant.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{variant.map(([k, v]) => <span key={k} className="rounded bg-muted px-1.5 py-0.5 text-[11px]"><span className="text-muted-foreground">{k}:</span> {v}</span>)}</div>}
                                  <div className="mt-1 flex items-center justify-between text-xs"><span className="text-muted-foreground">৳{Number(it.price_snapshot).toLocaleString("en-BD")} × {it.qty}</span><span className="text-sm font-semibold">৳{(Number(it.price_snapshot) * it.qty).toLocaleString("en-BD")}</span></div>
                                </div>
                                <div className="hidden space-y-1 text-xs md:block">
                                  {variant.length ? variant.map(([k, v]) => <div key={k}><span className="text-muted-foreground">{k}:</span> <span className="font-medium">{v}</span></div>) : <span className="text-muted-foreground">—</span>}
                                </div>
                                <div className="hidden text-center text-sm md:block">{it.qty}</div>
                                <div className="hidden text-sm md:block">৳ {Number(it.price_snapshot).toLocaleString("en-BD")}</div>
                                <div className="hidden text-right text-sm font-semibold md:block">৳ {(Number(it.price_snapshot) * it.qty).toLocaleString("en-BD")}</div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-primary/5 p-4 sm:grid-cols-[1fr_1fr_1fr_1.3fr] sm:divide-x sm:divide-primary/10">
                        <SumCell label="Subtotal" value={`৳ ${subtotal.toLocaleString("en-BD")}`} />
                        <SumCell label="Discount" value={`৳ ${discount.toLocaleString("en-BD")}`} />
                        <SumCell label="Delivery Charge" value={`৳ ${delivery.toLocaleString("en-BD")}`} />
                        <div className="sm:pl-4 sm:text-right">
                          <div className="text-xs text-muted-foreground">Grand Total</div>
                          <div className="text-2xl font-bold text-primary">৳ {total.toLocaleString("en-BD")}</div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {kind === "digital" && (
                    <Card><CardHead icon={ScrollText} title="Digital delivery" />
                      <dl className="grid grid-cols-2 gap-y-1 px-4 pb-4 text-xs">
                        <dt className="text-muted-foreground">Access</dt><dd className="text-right">{order.confirmation_status === "confirmed" ? "Granted" : "Locked"}</dd>
                        <dt className="text-muted-foreground">Delivery email</dt><dd className="text-right">{order.email ?? "—"}</dd>
                      </dl>
                    </Card>
                  )}
                  {kind === "service" && <Card><CardHead icon={ScrollText} title="Service workflow" /><div className="px-4 pb-4"><ServiceWorkflowPanel orderId={order.id} open={true} /></div></Card>}
                  {kind === "subscription" && <Card><CardHead icon={ScrollText} title="Subscription" /><div className="px-4 pb-4"><SubscriptionOrderPanel orderId={order.id} fallback={fulfil} /></div></Card>}

                  {/* Tabs */}
                  <Card>
                    <div className="flex gap-1 overflow-x-auto border-b px-3 sm:px-4">
                      {([["timeline", "Order Timeline", Clock], ["tracking", "Courier Tracking", RefreshCw], ["notes", "Internal Notes", ScrollText]] as const).map(([k, l, I]) => (
                        <button key={k} type="button" onClick={() => setTab(k)} className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium ${tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                          <I className="h-4 w-4" /> {l}
                        </button>
                      ))}
                    </div>
                    <div className="p-4">
                      {tab === "timeline" && (
                        <ol className="relative">
                          {timeline.map((t, i) => (
                            <li key={t.id} className="relative flex gap-3 pb-5 last:pb-0">
                              {i < timeline.length - 1 && <span className="absolute left-[11px] top-6 h-full w-0.5 bg-primary/30" />}
                              <span className="relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" /></span>
                              <div className="grid min-w-0 flex-1 gap-0.5 sm:grid-cols-[1fr_1.2fr_auto] sm:gap-3">
                                <div>
                                  <div className="text-sm font-semibold">{STAGE_LABEL[t.stage] ?? t.stage}</div>
                                  <div className="text-[11px] text-muted-foreground">{fmtDate(t.created_at)}</div>
                                </div>
                                <div className="text-xs text-muted-foreground">{t.note ?? t.message ?? ""}</div>
                                <div className="text-[11px] capitalize text-muted-foreground">{t.actor ?? t.source ?? "System"}</div>
                              </div>
                            </li>
                          ))}
                          {timeline.length === 0 && <li className="text-xs text-muted-foreground">No events yet.</li>}
                        </ol>
                      )}
                      {tab === "tracking" && (
                        <div className="space-y-4">
                          <CourierTrackingCard order={order} />
                          {isPhysical && (
                            <form onSubmit={submitCourier} className="grid gap-2 sm:grid-cols-3">
                              <Input placeholder="Courier (e.g. Pathao)" value={courier.name} onChange={(e) => setCourier((c) => ({ ...c, name: e.target.value }))} className="h-9 text-xs" />
                              <Input placeholder="Tracking ID" value={courier.tracking} onChange={(e) => setCourier((c) => ({ ...c, tracking: e.target.value }))} className="h-9 text-xs" />
                              <Input placeholder="Status (e.g. In Transit)" value={courier.status} onChange={(e) => setCourier((c) => ({ ...c, status: e.target.value }))} className="h-9 text-xs" />
                              <Button type="submit" size="sm" variant="outline" disabled={savingCourier} className="sm:col-span-3 sm:justify-self-start">{savingCourier ? "Saving…" : "Update courier"}</Button>
                            </form>
                          )}
                        </div>
                      )}
                      {tab === "notes" && (
                        <div className="space-y-4">
                          <ul className="space-y-1.5">
                            {notes.map((n) => (
                              <li key={n.id} className="flex items-start justify-between gap-2 rounded-lg bg-muted/50 p-2.5 text-xs">
                                <div><div>{n.body}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{fmtDate(n.created_at)}</div></div>
                                <button onClick={() => remove(n.id)} className="opacity-60 hover:opacity-100"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                              </li>
                            ))}
                            {notes.length === 0 && <li className="text-xs text-muted-foreground">No notes yet.</li>}
                          </ul>
                          <form onSubmit={submitNote} className="space-y-2">
                            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add internal note…" className="text-xs" />
                            <Button type="submit" size="sm" variant="outline" disabled={!note.trim()}>Add note</Button>
                          </form>
                          <div className="border-t pt-3">
                            <div className="mb-2 text-sm font-semibold">Edit History</div>
                            <OrderEditHistory orderId={orderId} enabled={open} />
                          </div>
                          {isPhysical && (
                            <label className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2.5 text-xs">
                              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={!!order.allow_duplicate} disabled={savingAllowDup}
                                onChange={async (e) => {
                                  const allow = e.target.checked;
                                  setSavingAllowDup(true);
                                  try { await allowDupFn({ data: { id: orderId, allow } }); qc.invalidateQueries({ queryKey: ["order-drawer", orderId] }); toast.success(allow ? "Duplicate override enabled" : "Override removed"); }
                                  catch (err) { toast.error((err as Error).message); } finally { setSavingAllowDup(false); }
                                }} />
                              <span><span className="font-medium">Allow duplicate purchase</span><span className="mt-0.5 block text-[11px] text-muted-foreground">Let this customer order the same product again even if another order exists.</span></span>
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                {/* RIGHT */}
                <aside className="order-first min-w-0 space-y-4 lg:order-none lg:space-y-5">
                  <Card>
                    <CardHead icon={User} title="Customer Details" action={editBtn(() => setEditCustomer(true))} />
                    <div className="px-4 pb-4">
                      <div className="flex gap-3">
                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                          {(order.customer_name ?? "?").trim().charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-base font-semibold">{order.customer_name}</span>
                            <CustomerBadge phone={order.phone} enabled={open} />
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {order.phone}
                          </div>
                          {order.email && <div className="text-xs text-muted-foreground">{order.email}</div>}
                          {isPhysical && order.address && (
                            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${order.address} ${order.area ?? ""}`)}`} target="_blank" rel="noreferrer" className="flex items-start gap-1.5 text-xs text-muted-foreground hover:text-primary">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{[order.address, order.area].filter(Boolean).join(", ")}</span>
                            </a>
                          )}
                        </div>
                      </div>
                      <ContactButtons phone={order.phone} copyText={copyText} />
                      <CustomerStats phone={order.phone} enabled={open} />
                    </div>
                  </Card>

                  {isPhysical && (
                    <Card>
                      <CardHead icon={Truck} title="Courier Performance" sub="(This Customer)" action={
                        <button type="button" onClick={() => setFraudOpen(true)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"><ShieldCheck className="h-3 w-3" /> {cachedFraud ? "Re-check" : "Check"}</button>
                      } />
                      <div className="px-4 pb-4">
                        {cachedFraud ? (
                          <>
                            <div className="mb-3 flex items-center justify-between text-xs">
                              <RiskBadge risk={(cachedFraud as any).risk} />
                              <span className="text-muted-foreground">Checked {fmtDate((cachedFraud as any).checked_at)}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                              {((cachedFraud as any).courier_history ?? []).map((c: any) => (
                                <div key={c.courier} className="rounded-xl border p-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-[11px] font-bold uppercase text-primary">{String(c.courier).slice(0, 2)}</span>
                                    <div className="min-w-0"><div className="truncate text-xs font-semibold capitalize">{c.courier}</div><div className="text-[10px] text-muted-foreground">Total: {c.total}</div></div>
                                  </div>
                                  <div className="mt-2 text-[10px] text-muted-foreground">Delivered: <span className="text-primary">{c.success}</span> | Cancelled: <span className="text-destructive">{c.cancelled ?? Math.max(0, c.total - c.success)}</span></div>
                                  <div className="mt-1.5 flex items-baseline gap-1"><span className="text-sm font-bold">{c.rate}%</span><span className="text-[10px] text-muted-foreground">Success</span></div>
                                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${c.rate}%` }} /></div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : <div className="text-xs text-muted-foreground">Checking courier history…</div>}
                      </div>
                    </Card>
                  )}

                  <Card>
                    <CardHead icon={PhoneCall} title="AI Calling & Conversation History" />
                    <div className="px-4 pb-4"><CallsHistory orderId={orderId} enabled={open} /></div>
                  </Card>
                </aside>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {phone && <FraudCheckModal open={fraudOpen} onOpenChange={setFraudOpen} phone={phone} orderId={orderId} />}
    </>
  );
}

const STATUS_OPTIONS = ["pending", "no_response", "on_hold", "confirmed", "processing", "cancelled"];

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function payLabel(m?: string | null) {
  if (!m) return "—";
  return m === "cod" ? "Cash on Delivery" : m.charAt(0).toUpperCase() + m.slice(1);
}
function variantPairs(it: any): [string, string][] {
  const o = it.options ?? it.variant_options ?? it.variant ?? null;
  if (o && typeof o === "object") return Object.entries(o).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)]);
  if (it.variant_label) return [["Variant", String(it.variant_label)]];
  return [];
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border bg-card shadow-sm ${className}`}>{children}</section>;
}
function CardHead({ icon: Icon, title, sub, action }: { icon: any; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3.5">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="flex-1 text-sm font-semibold">{title} {sub && <span className="font-normal text-muted-foreground">{sub}</span>}</h3>
      {action}
    </div>
  );
}
function Pill({ children, tone }: { children: React.ReactNode; tone: "primary" | "muted" }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${tone === "primary" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{children}</span>;
}
function SumCell({ label, value }: { label: string; value: string }) {
  return <div className="sm:pl-4 first:sm:pl-0"><div className="text-xs text-muted-foreground">{label}</div><div className="text-base font-semibold">{value}</div></div>;
}

function CourierTrackingCard({ order }: { order: any }) {
  if (!order.courier_name && !order.courier_tracking_id) {
    return <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">এখনো কুরিয়ারে পাঠানো হয়নি।</div>;
  }
  const s = String(order.courier_status ?? order.status ?? "").toLowerCase();
  const steps = ["Picked Up", "In Transit", "Out for Delivery", "Delivered"];
  const reached = s.includes("deliver") && !s.includes("out") ? 4 : s.includes("out") ? 3 : s.includes("transit") || s.includes("ship") ? 2 : s.includes("pick") ? 1 : 0;
  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-sm font-bold uppercase text-primary">{String(order.courier_name ?? "C").slice(0, 2)}</span>
          <div>
            <div className="text-sm font-semibold capitalize">{order.courier_name ?? "Courier"}</div>
            {order.courier_tracking_id && <div className="text-xs text-muted-foreground">Tracking No: <span className="font-mono">{order.courier_tracking_id}</span></div>}
          </div>
        </div>
        {order.courier_status && <Pill tone="primary">{order.courier_status}</Pill>}
      </div>
      <div className="mt-4 grid grid-cols-4">
        {steps.map((st, i) => (
          <div key={st} className="relative flex flex-col items-center text-center">
            {i > 0 && <span className={`absolute right-1/2 top-2.5 h-0.5 w-full ${i < reached ? "bg-primary" : "bg-muted"}`} />}
            <span className={`relative z-10 grid h-5 w-5 place-items-center rounded-full ${i < reached ? "bg-primary text-primary-foreground" : "border bg-card"}`}>{i < reached && <Check className="h-3 w-3" />}</span>
            <span className="mt-1.5 text-[10px] text-muted-foreground">{st}</span>
          </div>
        ))}
      </div>
      {order.courier_last_synced_at && <div className="mt-3 text-[10px] text-muted-foreground">Updated {fmtDate(order.courier_last_synced_at)}</div>}
    </div>
  );
}

function useCustomerStats(phone: string, enabled: boolean) {
  const statsFn = useServerFn(getOrderCustomerStats);
  return useQuery({
    queryKey: ["order-customer-stats", phone],
    queryFn: () => statsFn({ data: { phone } }),
    enabled: enabled && !!phone,
    staleTime: 60_000,
  }).data;
}
function CustomerBadge({ phone, enabled }: { phone: string; enabled: boolean }) {
  const data = useCustomerStats(phone, enabled);
  if (!data) return null;
  return <Pill tone={data.total > 1 ? "primary" : "muted"}>{data.total > 1 ? "Returning Customer" : "New Customer"}</Pill>;
}

/** Lifetime history for this customer (read-only, by phone). */
function CustomerStats({ phone, enabled }: { phone: string; enabled: boolean }) {
  const data = useCustomerStats(phone, enabled);
  if (!data) return null;
  const rate = data.total ? Math.round((data.delivered / data.total) * 100) : 0;
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border p-3 sm:grid-cols-4 sm:divide-x">
      <Stat label="Total Orders" value={data.total} />
      <Stat label="Delivered" value={data.delivered} tone="text-primary" />
      <Stat label="Cancelled" value={data.cancelled} tone="text-destructive" />
      <div className="flex items-center justify-between gap-2 sm:pl-3">
        <Stat label="Success Rate" value={`${rate}%`} tone="text-primary" />
        <Ring pct={rate} />
      </div>
      <div className="col-span-2 border-t pt-2 text-[11px] text-muted-foreground sm:col-span-4">
        Lifetime value ৳{Number(data.lifetime).toLocaleString("en-BD")} · since {new Date(data.since).toLocaleDateString()}
      </div>
    </div>
  );
}
function Stat({ label, value, tone = "" }: { label: string; value: any; tone?: string }) {
  return <div className="sm:pl-3 first:sm:pl-0"><div className="text-[11px] text-muted-foreground">{label}</div><div className={`text-xl font-bold ${tone}`}>{value}</div></div>;
}
function Ring({ pct }: { pct: number }) {
  const r = 14, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0 -rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
      <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-primary" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} />
    </svg>
  );
}

function ContactButtons({ phone, copyText }: { phone: string; copyText: string }) {
  const digits = phone.replace(/\D/g, "");
  const wa = digits.startsWith("880") ? digits : digits.startsWith("0") ? `88${digits}` : digits;
  const btn = "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-medium hover:bg-muted";
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <a href={`tel:${phone}`} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><Phone className="h-4 w-4" /> Call</a>
      <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className={btn}><MessageCircle className="h-4 w-4" /> WhatsApp</a>
      <button type="button" className={btn} onClick={() => { navigator.clipboard.writeText(phone); toast.success("ফোন নম্বর কপি হয়েছে"); }}><Copy className="h-4 w-4" /> Copy phone</button>
      <button type="button" className={btn} onClick={() => { navigator.clipboard.writeText(copyText); toast.success("অর্ডারের তথ্য কপি হয়েছে"); }}><ClipboardList className="h-4 w-4" /> Copy info</button>
    </div>
  );
}

function CallsHistory({ orderId, enabled }: { orderId: string; enabled: boolean }) {
  const listFn = useServerFn(getCallsForOrder);
  const { data } = useQuery({
    queryKey: ["order-calls", orderId],
    queryFn: () => listFn({ data: { orderId } }),
    enabled: enabled && !!orderId,
  });
  const calls = (data ?? []) as any[];
  if (!calls.length) return <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">এই অর্ডারে এখনো কোনো কল হয়নি।</div>;
  const last = calls[0];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-primary/5 p-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground"><PhoneCall className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold capitalize text-primary">Call {String(last.status).replace(/_/g, " ")}</div>
          <div className="text-[11px] text-muted-foreground">{fmtDate(last.created_at)}</div>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          <div>Duration: {formatDuration(last.duration_sec)}</div>
          <div>Attempts: {calls.length}</div>
        </div>
      </div>
      {last.result && (
        <div className="flex items-center gap-3 text-xs"><span className="text-muted-foreground">Customer Interest</span><Pill tone="primary">{String(last.result).replace(/_/g, " ")}</Pill></div>
      )}
      {last.note && (
        <div className="rounded-xl border p-3">
          <div className="text-xs font-semibold">Call Summary</div>
          <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{last.note}</p>
        </div>
      )}
      {calls.length > 1 && (
        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer text-xs font-semibold">Previous calls ({calls.length - 1})</summary>
          <div className="mt-2"><CallHistoryList calls={calls.slice(1)} empty="" /></div>
        </details>
      )}
    </div>
  );
}
