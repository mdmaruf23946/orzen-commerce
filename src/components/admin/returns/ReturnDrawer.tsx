// Returns & Exchanges — stage-driven admin drawer.
// Only the action for the current stage is offered, so the merchant always has
// exactly one obvious next step.
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  X,
  Package,
  Truck,
  ClipboardCheck,
  Repeat,
  Banknote,
  Flag,
} from "lucide-react";
import {
  runReturnAction,
  repriceReturn,
  setReturnUseGlobal,
} from "@/lib/returns-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { KIND_LABEL, STATUS_LABEL, REFUND_METHOD_LABEL } from "@/lib/returns-pricing";

export function img(p?: string | null) {
  if (!p) return null;
  const raw = String(p).trim();
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw) || raw.startsWith("/")) return raw;
  return `/api/img/${raw}`;
}

const money = (n: any) => `৳${Number(n ?? 0).toFixed(0)}`;

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 text-sm ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Lines({ title, items }: { title: string; items: any[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">{title}</div>
      <ul className="space-y-2">
        {items.map((it: any, i: number) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
              {img(it.image ?? it.image_url) ? (
                <img
                  src={img(it.image ?? it.image_url)!}
                  alt={it.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{it.name}</span>
              {it.variant && <span className="block text-[11px] text-muted-foreground">{it.variant}</span>}
              {it.inspection_result && (
                <span
                  className={`text-[11px] ${
                    it.inspection_result === "passed" ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  Inspection {it.inspection_result}
                </span>
              )}
            </span>
            <span className="shrink-0 text-muted-foreground">
              ×{it.qty} · {money(it.price)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReturnDrawer({ request, onClose }: { request: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const act = useServerFn(runReturnAction);
  const reprice = useServerFn(repriceReturn);
  const setGlobalFn = useServerFn(setReturnUseGlobal);

  const [note, setNote] = useState<string>(request?.resolution_note ?? "");
  const [courier, setCourier] = useState<string>(request?.courier_name ?? "");
  const [tracking, setTracking] = useState<string>(request?.courier_tracking_id ?? "");
  const [restock, setRestock] = useState(true);
  const [dispatchCourier, setDispatchCourier] = useState(true);
  const [refundMethod, setRefundMethod] = useState<string>(request?.refund_method ?? "manual");
  const [refundAmount, setRefundAmount] = useState<number>(Number(request?.refund_amount ?? 0));
  const [retShip, setRetShip] = useState<number>(Number(request?.return_shipping_charge ?? 0));
  const [repShip, setRepShip] = useState<number>(Number(request?.replacement_shipping_charge ?? 0));
  const [fee, setFee] = useState<number>(Number(request?.restocking_fee ?? 0));

  const run = useMutation({
    mutationFn: async (payload: Record<string, any>) =>
      act({ data: { id: request.id, note: note || undefined, ...payload } as any }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["admin", "returns"] });
      if (res?.courier_error) toast.warning(`Courier: ${res.courier_error}`);
      else toast.success("Request updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update"),
  });

  const price = useMutation({
    mutationFn: async () =>
      reprice({
        data: {
          id: request.id,
          return_shipping_charge: Number(retShip) || 0,
          replacement_shipping_charge: Number(repShip) || 0,
          restocking_fee: Number(fee) || 0,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "returns"] });
      toast.success("Amounts recalculated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not reprice"),
  });

  const useGlobal = request?.use_global_settings !== false;
  const toggleGlobal = useMutation({
    mutationFn: async (v: boolean) => setGlobalFn({ data: { id: request.id, use_global: v } }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["admin", "returns"] });
      toast.success(v ? "Using global settings" : "Manual charges enabled");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update"),
  });


  if (!request) return null;

  const r = request;
  const kind = (r.request_kind ?? "return") as keyof typeof KIND_LABEL;
  const isExchange = kind !== "return";
  const s: string = r.status;
  const busy = run.isPending || price.isPending;

  const open = !["completed", "rejected", "cancelled"].includes(s);
  const canApprove = s === "requested";
  const canShip = ["approved", "shipment_created"].includes(s);
  const canTransit = s === "shipment_created";
  const canReceive = ["shipment_created", "in_transit"].includes(s);
  const canInspect = ["received", "in_transit", "shipment_created"].includes(s);
  const canReplace = isExchange && !r.replacement_order_id &&
    ["approved", "received", "inspection_passed"].includes(s);
  const canRefund =
    !isExchange && Number(r.refund_amount ?? 0) >= 0 && r.refund_status !== "paid" &&
    ["inspection_passed", "received", "approved"].includes(s);
  const canComplete = ["refunded", "replacement_created", "inspection_passed", "inspection_failed"].includes(s);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-base">{KIND_LABEL[kind] ?? "Return request"}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5 pb-16">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {r.orders?.invoice_no ?? r.order_id.slice(0, 8).toUpperCase()}
              </span>
              <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium">
                {STATUS_LABEL[s] ?? s}
              </span>
            </div>
            <div className="mt-1 font-medium">{r.customer_name ?? r.orders?.customer_name}</div>
            <div className="text-xs text-muted-foreground">{r.phone ?? r.orders?.phone}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleString()}
            </div>
          </div>

          <Lines title="Returning" items={r.lines ?? []} />
          {isExchange && (
            <Lines
              title="Replacement"
              items={Array.isArray(r.replacement_items) ? r.replacement_items : []}
            />
          )}

          <div className="space-y-1.5 rounded-lg border bg-card p-3">
            <Row label="Returned items value" value={money(r.items_value)} />
            {isExchange && <Row label="Replacement value" value={money(r.replacement_value)} />}
            <Row label="Return shipping" value={money(r.return_shipping_charge)} />
            {isExchange && <Row label="Replacement shipping" value={money(r.replacement_shipping_charge)} />}
            <Row label="Restocking fee" value={money(r.restocking_fee)} />
            <div className="my-1 border-t" />
            {Number(r.extra_payment_due ?? 0) > 0 ? (
              <Row label="Customer pays" value={money(r.extra_payment_due)} strong />
            ) : (
              <Row label="Refund due" value={money(r.refund_amount)} strong />
            )}
            {r.refund_status === "paid" && (
              <p className="text-[11px] text-emerald-600">
                Refunded via {REFUND_METHOD_LABEL[r.refund_method] ?? r.refund_method}
              </p>
            )}
          </div>

          {r.reason && (
            <div>
              <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Reason</div>
              <p className="rounded-md border bg-card p-2 text-sm">{r.reason}</p>
            </div>
          )}

          {(r.images ?? []).length > 0 && (
            <div>
              <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Photos</div>
              <div className="flex flex-wrap gap-2">
                {(r.images as string[]).map((p) => (
                  <a key={p} href={img(p)!} target="_blank" rel="noreferrer">
                    <img src={img(p)!} alt="Return evidence" className="h-20 w-20 rounded-md border object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {(r.timeline ?? []).length > 0 && (
            <div>
              <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Timeline</div>
              <ol className="space-y-2 border-l pl-3">
                {(r.timeline as any[]).map((t, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-medium">{STATUS_LABEL[t.status] ?? t.status}</span>
                    <span className="ml-2 text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                    </span>
                    {t.note && <p className="text-muted-foreground">{t.note}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {open && (
            <>
              <div className="space-y-1.5">
                <Label>Note (added to the timeline)</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>

              {canApprove && (
                <div className="grid grid-cols-2 gap-2">
                  <Button disabled={busy} onClick={() => run.mutate({ action: "approve" })}>
                    <Check className="mr-1 h-4 w-4" /> Approve
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => run.mutate({ action: "reject" })}>
                    <X className="mr-1 h-4 w-4" /> Reject
                  </Button>
                </div>
              )}

              {canShip && (
                <div className="space-y-2 rounded-lg border p-3">
                  <Label className="flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" /> Return shipment
                  </Label>
                  <Input placeholder="Courier name" value={courier} onChange={(e) => setCourier(e.target.value)} />
                  <Input placeholder="Tracking ID" value={tracking} onChange={(e) => setTracking(e.target.value)} />
                  <Button
                    className="w-full"
                    disabled={busy}
                    onClick={() =>
                      run.mutate({
                        action: "create_shipment",
                        courier_name: courier || undefined,
                        courier_tracking_id: tracking || undefined,
                      })
                    }
                  >
                    Save return shipment
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {canTransit && (
                  <Button variant="outline" disabled={busy} onClick={() => run.mutate({ action: "mark_in_transit" })}>
                    Mark in transit
                  </Button>
                )}
                {canReceive && (
                  <Button variant="outline" disabled={busy} onClick={() => run.mutate({ action: "mark_received" })}>
                    Mark received
                  </Button>
                )}
              </div>

              {canInspect && (
                <div className="space-y-2 rounded-lg border p-3">
                  <Label className="flex items-center gap-1">
                    <ClipboardCheck className="h-3.5 w-3.5" /> Inspection
                  </Label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
                    Put good units back into stock
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      disabled={busy}
                      onClick={() => run.mutate({ action: "inspect", inspection: "passed", restock })}
                    >
                      Passed
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => run.mutate({ action: "inspect", inspection: "failed" })}
                    >
                      Failed
                    </Button>
                  </div>
                </div>
              )}

              {canReplace && (
                <div className="space-y-2 rounded-lg border p-3">
                  <Label className="flex items-center gap-1">
                    <Repeat className="h-3.5 w-3.5" /> Replacement order
                  </Label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={dispatchCourier}
                      onChange={(e) => setDispatchCourier(e.target.checked)}
                    />
                    Also create the courier parcel
                  </label>
                  <Button
                    className="w-full"
                    disabled={busy}
                    onClick={() => run.mutate({ action: "create_replacement", dispatch_courier: dispatchCourier })}
                  >
                    Create replacement order
                  </Button>
                </div>
              )}

              {canRefund && (
                <div className="space-y-2 rounded-lg border p-3">
                  <Label className="flex items-center gap-1">
                    <Banknote className="h-3.5 w-3.5" /> Refund
                  </Label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  >
                    {Object.entries(REFUND_METHOD_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(Number(e.target.value))}
                  />
                  <Button
                    className="w-full"
                    disabled={busy}
                    onClick={() =>
                      run.mutate({
                        action: "process_refund",
                        refund_method: refundMethod as any,
                        refund_amount: Number(refundAmount) || 0,
                      })
                    }
                  >
                    Process refund
                  </Button>
                </div>
              )}

              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Label>Use global settings</Label>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Off = enter manual charges for this request only.
                    </p>
                  </div>
                  <Switch
                    checked={useGlobal}
                    disabled={toggleGlobal.isPending}
                    onCheckedChange={(v) => toggleGlobal.mutate(v)}
                  />
                </div>
                <Label>Adjust charges</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={retShip}
                    onChange={(e) => setRetShip(Number(e.target.value))}
                    placeholder="Return ship"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={repShip}
                    onChange={(e) => setRepShip(Number(e.target.value))}
                    placeholder="Repl. ship"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={fee}
                    onChange={(e) => setFee(Number(e.target.value))}
                    placeholder="Fee"
                  />
                </div>
                <Button variant="outline" className="w-full" disabled={busy} onClick={() => price.mutate()}>
                  Recalculate amounts
                </Button>
              </div>

              {canComplete && (
                <Button className="w-full" disabled={busy} onClick={() => run.mutate({ action: "complete" })}>
                  <Flag className="mr-1 h-4 w-4" /> Mark completed
                </Button>
              )}

              <Button
                variant="ghost"
                className="w-full text-destructive"
                disabled={busy}
                onClick={() => run.mutate({ action: "cancel" })}
              >
                Cancel request
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
