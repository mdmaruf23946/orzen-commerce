// Shared courier parcel UI: status chips, parcel drawer, pickup, logs, printing.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PARCEL_STATUSES,
  STATUS_LABEL,
  STATUS_TONE,
  type ParcelStatus,
} from "@/lib/couriers/status";
import { COURIERS, type CourierKey } from "@/components/admin/couriers/providers";
import {
  getParcel,
  refreshParcelStatus,
  cancelParcel,
  recreateParcel,
  updateParcelManual,
  requestPickup,
  listPickupHistory,
  listCourierLogs,
} from "@/lib/courier-parcels.functions";

export const money = (n: unknown) => `৳${Number(n ?? 0).toLocaleString("en-BD")}`;

export function courierLabel(key: string) {
  return COURIERS.find((c) => c.key === key)?.label ?? key;
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs transition ${
        active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

export function StatusPill({ status }: { status: string }) {
  const s = (status ?? "pending") as ParcelStatus;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[s] ?? "bg-muted"}`}>
      {STATUS_LABEL[s] ?? status}
    </span>
  );
}
export function Two({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}
export function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
/* ------------------------------ drawer ------------------------------ */

export function ParcelDrawer({
  id,
  onClose,
  onChanged,
  onPrint,
}: {
  id: string | null;
  onClose: () => void;
  onChanged: () => void;
  onPrint: (ids: string[], kind: "invoice" | "label" | "packing") => void;
}) {
  const fetchOne = useServerFn(getParcel);
  const refresh = useServerFn(refreshParcelStatus);
  const cancel = useServerFn(cancelParcel);
  const recreate = useServerFn(recreateParcel);
  const manualUpdate = useServerFn(updateParcelManual);

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["parcel", id],
    queryFn: () => fetchOne({ data: { id: id! } }),
    enabled: !!id,
  });

  const p: any = data?.parcel;
  const [manualStatus, setManualStatus] = useState<string>("");
  const [manualTracking, setManualTracking] = useState<string>("");

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      refetch();
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Sheet open={!!id} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Parcel details</SheetTitle>
        </SheetHeader>
        {!p ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-4 py-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={p.status} />
              <span className="text-xs text-muted-foreground">{courierLabel(p.courier_key)}</span>
              {p.tracking_url && (
                <a href={p.tracking_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary">
                  Track <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div className="rounded-xl border p-3">
              <p className="font-medium">{p.recipient_name}</p>
              <p className="text-xs text-muted-foreground">{p.recipient_phone}</p>
              <p className="mt-1 text-xs text-muted-foreground">{p.recipient_address}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <span>COD: {money(p.cod_amount)}</span>
                <span>Delivery: {money(p.delivery_charge)}</span>
                <span>Return charge: {money(p.return_charge)}</span>
                <span>Collection: {p.collection_status ?? "pending"}</span>
                {p.tracking_code && <span className="col-span-2">Tracking: {p.tracking_code}</span>}
              </div>
            </div>

            {Array.isArray(p.items) && p.items.length > 0 && (
              <div className="rounded-xl border p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Items</p>
                {p.items.map((i: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="truncate">{i.name} × {i.qty}</span>
                    <span>{money(i.price)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={isFetching} onClick={() => run(() => refresh({ data: { ids: [p.id] } }), "Status refreshed")}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
              </Button>
              <Button size="sm" variant="outline" onClick={() => onPrint([p.id], "label")}>
                <Printer className="mr-1 h-3.5 w-3.5" /> Label
              </Button>
              <Button size="sm" variant="outline" onClick={() => onPrint([p.id], "invoice")}>
                Invoice
              </Button>
              <Button size="sm" variant="outline" onClick={() => run(() => recreate({ data: { id: p.id, send: true } }), "Parcel recreated")}>
                Recreate
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => run(() => cancel({ data: { id: p.id } }), "Parcel cancelled")}>
                Cancel
              </Button>
            </div>

            <div className="rounded-xl border p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Manual update</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Select value={manualStatus} onValueChange={setManualStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {PARCEL_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="h-9"
                  placeholder="Tracking / consignment no."
                  value={manualTracking}
                  onChange={(e) => setManualTracking(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                className="mt-2"
                onClick={() =>
                  run(
                    () =>
                      manualUpdate({
                        data: {
                          id: p.id,
                          status: (manualStatus || undefined) as any,
                          trackingCode: manualTracking || undefined,
                        },
                      }),
                    "Parcel updated",
                  )
                }
              >
                Save
              </Button>
            </div>

            <div className="rounded-xl border p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Timeline</p>
              <div className="space-y-2">
                {(data?.events ?? []).map((e: any) => (
                  <div key={e.id} className="flex gap-2 text-xs">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <div>
                      <p className="font-medium">{STATUS_LABEL[e.status as ParcelStatus] ?? e.status}</p>
                      {e.message && <p className="text-muted-foreground">{e.message}</p>}
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()} · {e.source}
                      </p>
                    </div>
                  </div>
                ))}
                {(data?.events ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">No events yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">API logs</p>
              {(data?.logs ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No API calls recorded.</p>
              ) : (
                (data?.logs ?? []).map((l: any) => (
                  <details key={l.id} className="border-b py-1 text-xs last:border-0">
                    <summary className="cursor-pointer">
                      {l.action} · {l.ok ? "OK" : "Error"} · {l.http_status ?? "-"} · {l.duration_ms}ms
                    </summary>
                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-[10px]">
                      {JSON.stringify({ request: l.request, response: l.response, error: l.error }, null, 2)}
                    </pre>
                  </details>
                ))
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------ pickup ------------------------------ */

export function PickupTab({ courier }: { courier?: CourierKey }) {
  const ask = useServerFn(requestPickup);
  const fetchHistory = useServerFn(listPickupHistory);
  const qc = useQueryClient();
  const { data: history } = useQuery({
    queryKey: ["pickup-history", courier],
    queryFn: () => fetchHistory({ data: { courierKey: courier } }),
  });
  const [key, setKey] = useState<CourierKey>(courier ?? "steadfast");
  const [date, setDate] = useState("");
  const [count, setCount] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-xl border p-4">
        <p className="text-sm font-medium">Request pickup</p>
        <F label="Courier">
          <Select value={key} onValueChange={(v) => setKey(v as CourierKey)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COURIERS.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </F>
        <Two>
          <F label="Pickup date">
            <Input className="h-9" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </F>
          <F label="Parcel count">
            <Input className="h-9" type="number" value={count} onChange={(e) => setCount(e.target.value)} />
          </F>
        </Two>
        <F label="Note">
          <Input className="h-9" value={note} onChange={(e) => setNote(e.target.value)} />
        </F>
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r: any = await ask({
                data: {
                  courierKey: key,
                  pickupDate: date || undefined,
                  parcelCount: Number(count || 0),
                  note: note || undefined,
                },
              });
              r.ok ? toast.success(r.message) : toast.error(r.message);
              qc.invalidateQueries({ queryKey: ["pickup-history"] });
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Request pickup
        </Button>
      </div>

      <div className="rounded-xl border p-4">
        <p className="mb-2 text-sm font-medium">History</p>
        {((history ?? []) as any[]).length === 0 ? (
          <p className="text-xs text-muted-foreground">No pickup requests yet.</p>
        ) : (
          ((history ?? []) as any[]).map((h) => (
            <div key={h.id} className="border-b py-2 text-xs last:border-0">
              <div className="flex justify-between">
                <span className="font-medium">{courierLabel(h.courier_key)}</span>
                <span className={h.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
                  {h.status}
                </span>
              </div>
              <p className="text-muted-foreground">
                {h.pickup_date ?? "—"} · {h.parcel_count} parcel(s)
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ------------------------------- logs ------------------------------- */

export function LogsTab({ courier }: { courier?: CourierKey }) {
  const fetchLogs = useServerFn(listCourierLogs);
  const { data } = useQuery({
    queryKey: ["courier-logs", courier],
    queryFn: () => fetchLogs({ data: { courierKey: courier, limit: 50 } }),
  });
  const logs = (data ?? []) as any[];
  if (!logs.length) return <p className="text-sm text-muted-foreground">No API calls recorded yet.</p>;
  return (
    <div className="rounded-xl border">
      {logs.map((l) => (
        <details key={l.id} className="border-b p-3 text-xs last:border-0">
          <summary className="cursor-pointer">
            <span className="font-medium">{courierLabel(l.courier_key)}</span> · {l.action} ·{" "}
            <span className={l.ok ? "text-emerald-600" : "text-destructive"}>{l.ok ? "OK" : "Error"}</span> ·{" "}
            {new Date(l.created_at).toLocaleString()}
          </summary>
          <pre className="mt-2 max-h-56 overflow-auto rounded bg-muted p-2 text-[10px]">
            {JSON.stringify({ endpoint: l.endpoint, request: l.request, response: l.response, error: l.error }, null, 2)}
          </pre>
        </details>
      ))}
    </div>
  );
}

/* ------------------------------- print ------------------------------ */

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function openPrintWindow(d: any, kind: "invoice" | "label" | "packing") {
  const store = d.store ?? {};
  const title = kind === "label" ? "Shipping Label" : kind === "invoice" ? "Invoice" : "Packing Slip";
  const blocks = (d.parcels ?? [])
    .map((p: any) => {
      const inv = d.invoiceByOrder?.[p.order_id] ?? String(p.id).slice(0, 8).toUpperCase();
      const items = (Array.isArray(p.items) ? p.items : [])
        .map(
          (i: any) =>
            `<tr><td>${esc(i.name)}</td><td style="text-align:center">${esc(i.qty)}</td><td style="text-align:right">${esc(i.price ?? 0)}</td></tr>`,
        )
        .join("");
      return `<section class="doc">
        <header>
          <div><strong>${esc(store.name ?? "Store")}</strong><div class="muted">${esc(store.phone ?? "")}</div></div>
          <div style="text-align:right"><strong>${esc(title)}</strong><div class="muted">${esc(inv)}</div></div>
        </header>
        <div class="grid">
          <div><div class="muted">Deliver to</div><strong>${esc(p.recipient_name)}</strong><div>${esc(p.recipient_phone)}</div><div>${esc(p.recipient_address)}</div></div>
          <div style="text-align:right"><div class="muted">Courier</div><strong>${esc(p.courier_key)}</strong><div>${esc(p.tracking_code ?? "")}</div><div class="cod">COD ৳${esc(p.cod_amount)}</div></div>
        </div>
        ${kind !== "label" ? `<table><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>${items}</tbody></table>` : ""}
        ${p.note ? `<p class="muted">Note: ${esc(p.note)}</p>` : ""}
      </section>`;
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>
    body{font-family:system-ui,sans-serif;margin:0;padding:16px;color:#111}
    .doc{border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:12px;page-break-inside:avoid}
    header{display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:8px}
    .grid{display:flex;justify-content:space-between;gap:16px;font-size:13px}
    .muted{color:#666;font-size:12px}
    .cod{font-weight:700;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
    th,td{border-bottom:1px solid #eee;padding:4px 0;text-align:left}
    @media print{body{padding:0}.doc{border:none}}
  </style></head><body>${blocks}<script>window.onload=()=>window.print()</script></body></html>`;

  const w = window.open("", "_blank");
  if (!w) return toast.error("Allow pop-ups to print");
  w.document.write(html);
  w.document.close();
}
