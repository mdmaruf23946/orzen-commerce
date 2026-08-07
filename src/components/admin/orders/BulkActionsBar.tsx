// Bulk actions bar for the Physical Orders list.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Truck, Printer, FileText, Download, ListChecks, Loader2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminOrderRow } from "@/lib/orders-admin.functions";
import { confirmOrder } from "@/lib/orders-types.functions";
import { updateOrderStatus } from "@/lib/admin.functions";
import { bulkSendParcels, getParcelLabel } from "@/lib/courier-parcels.functions";
import { openPrintWindow } from "@/components/admin/couriers/parcel-ui";
import {
  canCancel, canConfirm, canSendToCourier, downloadCsv, orderLabel, ordersToCsv,
  orderToPrintParcel, splitForCourier, type CourierIssue,
} from "@/lib/orders-bulk";

const STATUSES = ["pending", "confirmed", "processing", "delivered", "cancelled"] as const;

export type BulkSummary = {
  action: string;
  ok: number;
  failures: Array<{ label: string; reason: string }>;
};

export function BulkActionsBar({
  orders,
  onClear,
  onDone,
}: {
  orders: AdminOrderRow[];
  onClear: () => void;
  onDone: (doneIds: string[], summary: BulkSummary) => void;
}) {
  const confirmFn = useServerFn(confirmOrder);
  const statusFn = useServerFn(updateOrderStatus);
  const sendFn = useServerFn(bulkSendParcels);
  const labelFn = useServerFn(getParcelLabel);

  const [busy, setBusy] = useState<string | null>(null);
  const [courierCheck, setCourierCheck] = useState<{
    valid: AdminOrderRow[];
    invalid: CourierIssue[];
  } | null>(null);

  const confirmable = orders.filter(canConfirm);
  const cancellable = orders.filter(canCancel);
  const sendable = orders.filter(canSendToCourier);

  async function runEach(
    action: string,
    list: AdminOrderRow[],
    fn: (o: AdminOrderRow) => Promise<unknown>,
  ) {
    if (!list.length) return;
    setBusy(action);
    const done: string[] = [];
    const failures: Array<{ label: string; reason: string }> = [];
    for (const o of list) {
      try {
        await fn(o);
        done.push(o.id);
      } catch (e) {
        failures.push({ label: orderLabel(o), reason: (e as Error).message });
      }
    }
    setBusy(null);
    onDone(done, { action, ok: done.length, failures });
  }

  async function doSend() {
    const check = courierCheck;
    if (!check) return;
    setCourierCheck(null);
    if (!check.valid.length) {
      onDone([], {
        action: "Send to courier",
        ok: 0,
        failures: check.invalid.map((i) => ({ label: i.label, reason: i.reason })),
      });
      return;
    }
    setBusy("courier");
    try {
      const r: any = await sendFn({ data: { orderIds: check.valid.map((o) => o.id) } });
      const failedIds = new Set<string>((r?.failures ?? []).map((f: any) => f.id));
      const failures = [
        ...check.invalid.map((i) => ({ label: i.label, reason: i.reason })),
        ...(r?.failures ?? []).map((f: any) => ({
          label: check.valid.find((o) => o.id === f.id)?.invoice_no ?? orderLabel(check.valid.find((o) => o.id === f.id) ?? ({ id: f.id } as any)),
          reason: f.message,
        })),
      ];
      const done = check.valid.filter((o) => !failedIds.has(o.id)).map((o) => o.id);
      onDone(done, { action: "Send to courier", ok: done.length, failures });
    } catch (e) {
      onDone([], { action: "Send to courier", ok: 0, failures: [{ label: "All orders", reason: (e as Error).message }] });
    } finally {
      setBusy(null);
    }
  }

  function printInvoices() {
    for (const o of orders) window.open(`/admin/invoice/${o.id}`, "_blank", "noopener");
  }

  async function printLabels() {
    setBusy("label");
    const fallback: AdminOrderRow[] = [];
    for (const o of orders) {
      if (!o.parcel?.id) {
        fallback.push(o);
        continue;
      }
      try {
        const r: any = await labelFn({ data: { id: o.parcel.id } });
        if (r?.url) window.open(r.url, "_blank", "noopener");
        else fallback.push(o);
      } catch {
        fallback.push(o);
      }
    }
    if (fallback.length) {
      openPrintWindow(
        {
          store: null,
          invoiceByOrder: Object.fromEntries(fallback.map((o) => [o.id, o.invoice_no ?? ""])),
          parcels: fallback.map(orderToPrintParcel),
        },
        "label",
      );
    }
    setBusy(null);
  }

  function exportCsv() {
    downloadCsv(`orders-${new Date().toISOString().slice(0, 10)}.csv`, ordersToCsv(orders));
    toast.success(`${orders.length} order(s) exported`);
  }

  return (
    <>
      <div className="sticky top-2 z-20 rounded-2xl border bg-card/95 p-2 shadow-md backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center gap-2">
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {orders.length} selected
          </span>
          <div className="-mx-1 flex flex-1 items-center gap-1.5 overflow-x-auto px-1 py-0.5">
            {confirmable.length > 0 && (
              <BulkBtn
                icon={CheckCircle2}
                label={`Confirm (${confirmable.length})`}
                busy={busy === "confirm"}
                disabled={!!busy}
                onClick={() => runEach("Confirm orders", confirmable, (o) => confirmFn({ data: { orderId: o.id } }))}
              />
            )}
            {cancellable.length > 0 && (
              <BulkBtn
                icon={XCircle}
                label={`Cancel (${cancellable.length})`}
                busy={busy === "cancel"}
                disabled={!!busy}
                onClick={() =>
                  runEach("Cancel orders", cancellable, (o) =>
                    statusFn({ data: { id: o.id, status: "cancelled" as any } }),
                  )
                }
              />
            )}
            {sendable.length > 0 && (
              <BulkBtn
                icon={Truck}
                label={`Send to courier (${sendable.length})`}
                busy={busy === "courier"}
                disabled={!!busy}
                onClick={() => setCourierCheck(splitForCourier(orders))}
              />
            )}
            <BulkBtn icon={FileText} label="Invoice" disabled={!!busy} onClick={printInvoices} />
            <BulkBtn icon={Printer} label="Label" busy={busy === "label"} disabled={!!busy} onClick={printLabels} />
            <BulkBtn icon={Download} label="Export" disabled={!!busy} onClick={exportCsv} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={!!busy}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <ListChecks className="h-3.5 w-3.5" /> Status
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {STATUSES.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    className="text-xs capitalize"
                    onClick={() =>
                      runEach(`Mark ${s}`, orders, (o) => statusFn({ data: { id: o.id, status: s as any } }))
                    }
                  >
                    Mark {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded-lg border p-1.5 text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <Dialog open={!!courierCheck} onOpenChange={(v) => !v && setCourierCheck(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send to courier</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              <strong>{courierCheck?.valid.length ?? 0}</strong> order(s) are ready to dispatch.
            </p>
            {!!courierCheck?.invalid.length && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <p className="mb-1.5 text-xs font-semibold text-destructive">
                  {courierCheck.invalid.length} order(s) will be skipped
                </p>
                <ul className="space-y-1 text-xs">
                  {courierCheck.invalid.map((i) => (
                    <li key={i.id} className="flex justify-between gap-2">
                      <span className="font-mono">{i.label}</span>
                      <span className="text-right text-muted-foreground">{i.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setCourierCheck(null)}>
              Cancel
            </Button>
            <Button disabled={!courierCheck?.valid.length} onClick={doSend}>
              <Truck className="mr-1 h-4 w-4" /> Send {courierCheck?.valid.length ?? 0} order(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BulkBtn({
  icon: Icon, label, onClick, busy, disabled,
}: { icon: any; label: string; onClick: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs transition-colors hover:bg-muted disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />} {label}
    </button>
  );
}

export function BulkSummaryPanel({ summary, onClose }: { summary: BulkSummary; onClose: () => void }) {
  const failed = summary.failures.length;
  return (
    <div
      className={`rounded-2xl border p-3 text-sm ${failed ? "border-amber-500/30 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">
          {summary.action}: {summary.ok} succeeded{failed ? ` · ${failed} failed` : ""}
        </p>
        <button type="button" onClick={onClose} aria-label="Dismiss" className="text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      {failed > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {summary.failures.map((f, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="font-mono">{f.label}</span>
              <span className="text-right text-muted-foreground">{f.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
