import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck, Lock, Info, RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import { runFraudCheck, getCachedFraudCheck, ensureAutoFraudCheck, resyncFraudCheck } from "@/lib/fraud.functions";
import { amIOwner } from "@/lib/owner.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";


type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  phone: string;
  orderId?: string;
};

export function RiskBadge({ risk }: { risk: "safe" | "medium" | "high" | null | undefined }) {
  if (!risk) return null;
  const cls =
    risk === "safe" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" :
    risk === "medium" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" :
    "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30";
  const Icon = risk === "safe" ? ShieldCheck : risk === "medium" ? AlertTriangle : ShieldAlert;
  const label = risk === "safe" ? "Safe" : risk === "medium" ? "Medium Risk" : "High Risk";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  );
}

// ---------------- Courier catalog ----------------
type CourierKey = "pathao" | "steadfast" | "redx" | "paperfly" | "parceldex" | "ecourier";

const COURIERS: { key: CourierKey; name: string; short: string; color: string; bg: string }[] = [
  { key: "pathao",    name: "Pathao",    short: "path\u00e3o", color: "#e63946", bg: "bg-red-50 dark:bg-red-950/30" },
  { key: "steadfast", name: "Steadfast", short: "SteadFast",   color: "#16a34a", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  { key: "parceldex", name: "Parceldex", short: "parceldex",   color: "#1d4ed8", bg: "bg-blue-50 dark:bg-blue-950/30" },
  { key: "redx",      name: "RedX",      short: "REDX",        color: "#dc2626", bg: "bg-red-50 dark:bg-red-950/30" },
  { key: "paperfly",  name: "Paperfly",  short: "PAPERFLY",    color: "#0ea5e9", bg: "bg-sky-50 dark:bg-sky-950/30" },
  { key: "ecourier",  name: "eCourier",  short: "eCourier",    color: "#7c3aed", bg: "bg-violet-50 dark:bg-violet-950/30" },
];

function CourierLogo({ c }: { c: (typeof COURIERS)[number] }) {
  return (
    <div className={`inline-flex h-8 min-w-[92px] items-center justify-center rounded-md border px-2 ${c.bg}`}>
      <span className="text-[11px] font-bold tracking-tight" style={{ color: c.color }}>
        {c.short}
      </span>
    </div>
  );
}

// ---------------- Doughnut ----------------
function Doughnut({ success, cancelled, size = 180 }: { success: number; cancelled: number; size?: number }) {
  const total = success + cancelled;
  const r = 60;
  const c = 2 * Math.PI * r;
  const successFrac = total > 0 ? success / total : 0;
  const successLen = c * successFrac;
  const rate = total > 0 ? Math.round((success / total) * 100) : 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#ef4444" strokeWidth="20" />
        <circle
          cx="80" cy="80" r={r} fill="none" stroke="#10b981" strokeWidth="20"
          strokeDasharray={`${successLen} ${c - successLen}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-2xl font-bold">{rate}%</div>
          <div className="text-[10px] uppercase text-muted-foreground">Success</div>
        </div>
      </div>
    </div>
  );
}

export function FraudCheckModal({ open, onOpenChange, phone, orderId }: Props) {
  const runFn = useServerFn(runFraudCheck);
  const cacheFn = useServerFn(getCachedFraudCheck);
  const autoFn = useServerFn(ensureAutoFraudCheck);
  const resyncFn = useServerFn(resyncFraudCheck);
  const amIOwnerFn = useServerFn(amIOwner);
  const qc = useQueryClient();

  const { data: ownerInfo } = useQuery({
    queryKey: ["am-i-owner"],
    queryFn: () => amIOwnerFn({}),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const isOwner = !!ownerInfo?.isOwner;


  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["fraud-check", phone, orderId],
    queryFn: async () => {
      const cached = await cacheFn({ data: { phone } });
      if (cached) return cached;
      if (orderId) return await autoFn({ data: { order_id: orderId } });
      return await runFn({ data: { phone } });
    },
    enabled: open && !!phone,
    staleTime: 60_000,
    retry: false,
  });

  const d: any = data ?? {};
  const count = Number(d.check_count ?? 0);
  const max = Number(d.max_checks ?? 2);
  const limitReached = count >= max;

  const total = Number(d.total_orders ?? 0);
  const success = Number(d.successful ?? 0);
  const cancelled = Number(d.cancelled ?? 0);
  const rate = Number(d.cod_success_rate ?? (total > 0 ? Math.round((success / total) * 100) : 0));
  const risk: "safe" | "medium" | "high" | undefined = d.risk;

  const history: any[] = Array.isArray(d.courier_history) ? d.courier_history : [];
  const byKey = new Map<string, any>();
  for (const h of history) byKey.set(String(h.courier).toLowerCase(), h);

  const rows = COURIERS.map((c) => {
    const h = byKey.get(c.key) ?? byKey.get(c.name.toLowerCase());
    return {
      c,
      total: Number(h?.total ?? 0),
      success: Number(h?.success ?? 0),
      cancelled: Number(h?.cancelled ?? (h ? (h.total ?? 0) - (h.success ?? 0) : 0)),
    };
  });

  // Cross-check computed courier totals against the cached summary.
  const computedTotal = rows.reduce((s, r) => s + r.total, 0);
  const computedSuccess = rows.reduce((s, r) => s + r.success, 0);
  const computedCancelled = rows.reduce((s, r) => s + r.cancelled, 0);
  const mismatch = data
    ? computedTotal !== total || computedSuccess !== success || computedCancelled !== cancelled
    : false;

  const recommendation =
    risk === "safe"
      ? { tone: "ok" as const, title: "Safe to proceed", msg: "High delivery success rate. This customer is reliable." }
      : risk === "medium"
      ? { tone: "warn" as const, title: "Review before dispatch", msg: `Moderate delivery success rate (${rate}%). Please communicate with the customer before dispatch.` }
      : risk === "high"
      ? { tone: "bad" as const, title: "Contact customer before courier booking", msg: "Low success rate. High risk of return/cancellation — verify order before shipping." }
      : { tone: "warn" as const, title: "No data", msg: "No delivery history found for this number." };


  async function recheck() {
    if (limitReached) return;
    try {
      await runFn({ data: { phone, order_id: orderId, force: true } });
      qc.invalidateQueries({ queryKey: ["fraud-check", phone, orderId] });
      qc.invalidateQueries({ queryKey: ["fraud-cache", phone] });
      toast.success("Rechecked");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function resync() {
    try {
      await resyncFn({ data: { phone } });
      qc.invalidateQueries({ queryKey: ["fraud-check", phone, orderId] });
      qc.invalidateQueries({ queryKey: ["fraud-cache", phone] });
      toast.success("Fraud check resynced from BD Courier");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" /> Fraud Check Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-4 sm:p-5">
          {isLoading && <div className="py-12 text-center text-sm text-muted-foreground">Loading cached report…</div>}
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {(error as Error).message}
            </div>
          )}

          {data && (
            <>
              {/* Header: phone + risk + last checked */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Customer Phone</div>
                  <div className="truncate font-mono text-lg font-semibold">{phone}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <RiskBadge risk={risk} />
                  <div className="text-[10px] text-muted-foreground">
                    Last checked · {d.checked_at ? new Date(d.checked_at).toLocaleString() : "—"}
                  </div>
                </div>
              </div>

              {/* Warning/info banner */}
              <div
                className={`flex items-start gap-2 rounded-2xl border p-3 text-xs ${
                  recommendation.tone === "ok"
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-500"
                    : recommendation.tone === "warn"
                    ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-500"
                    : "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-500"
                }`}
              >
                {recommendation.tone === "ok" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : recommendation.tone === "warn" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <div>
                  <div className="font-semibold">{recommendation.title}</div>
                  <div className="opacity-90">{recommendation.msg}</div>
                </div>
              </div>

              {/* Totals validation banner */}
              {mismatch && (
                <div className="flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-500">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">Totals mismatch detected</div>
                    <div className="opacity-90">
                      Cached summary (Total {total} · Success {success} · Cancel {cancelled}) does not match the sum of
                      courier rows (Total {computedTotal} · Success {computedSuccess} · Cancel {computedCancelled}).
                      {isOwner
                        ? " Click Resync Fraud Check to recalculate from the latest BD Courier data."
                        : " Ask a Winner Admin to resync this fraud check."}
                    </div>
                  </div>
                </div>
              )}


              {/* Stats cards */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
                <StatCard label="Total Orders" value={total} sub="All time" tone="blue" />
                <StatCard label="Successful" value={success} sub="Delivered" tone="green" />
                <StatCard label="Cancelled" value={cancelled} sub="Failed" tone="red" />
                <StatCard label="Success Rate" value={`${rate}%`} sub="COD" tone="violet" />
              </div>

              {/* Courier table + Doughnut */}
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                  <div className="bg-primary px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
                    <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,0.7fr)_minmax(0,0.7fr)] gap-2">
                      <span>Courier</span>
                      <span className="text-right">Total</span>
                      <span className="text-right">Success</span>
                      <span className="text-right">Cancel</span>
                    </div>
                  </div>
                  <ul className="divide-y">
                    {rows.map((r) => (
                      <li
                        key={r.c.key}
                        className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,0.7fr)_minmax(0,0.7fr)] items-center gap-2 px-3 py-2.5 text-sm"
                      >
                        <CourierLogo c={r.c} />
                        <span className="text-right tabular-nums">{r.total}</span>
                        <span className="text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{r.success}</span>
                        <span className="text-right font-medium tabular-nums text-red-600 dark:text-red-400">{r.cancelled}</span>
                      </li>
                    ))}
                    <li className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,0.7fr)_minmax(0,0.7fr)] items-center gap-2 bg-muted/40 px-3 py-2.5 text-sm font-semibold">
                      <span>Total</span>
                      <span className="text-right tabular-nums">{total}</span>
                      <span className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">{success}</span>
                      <span className="text-right tabular-nums text-red-600 dark:text-red-400">{cancelled}</span>
                    </li>
                  </ul>
                </div>

                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-4 shadow-sm lg:min-w-[260px]">
                  <div className="w-full text-sm font-semibold">Delivery Status</div>
                  <Doughnut success={success} cancelled={cancelled} />
                  <div className="flex items-center gap-4 text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Successful ({success})
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Cancelled ({cancelled})
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom summary */}
              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Info className="h-4 w-4 text-primary" /> Summary
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-3">
                  <SummaryItem label="Success Rate" value={`${rate}%`} />
                  <SummaryItem label="Risk Status" value={risk ? risk.toUpperCase() : "—"} />
                  <SummaryItem label="Last Delivery" value={d.last_delivery ? new Date(d.last_delivery).toLocaleDateString() : "—"} />
                </div>
                <div className="mt-3 text-xs text-muted-foreground">{recommendation.msg}</div>
              </div>

              {/* Footer actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <div className="text-[10px] text-muted-foreground">
                  First checked: {d.first_checked_at ? new Date(d.first_checked_at).toLocaleString() : "—"}
                  {" · "}Source: <span className="capitalize">{d.last_check_source ?? "system"}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isOwner && (
                    <Button
                      size="sm"
                      variant={mismatch ? "default" : "outline"}
                      onClick={resync}
                      disabled={isFetching}
                      title="Owner-only: recalculate totals from BD Courier and update the cached result"
                    >
                      <RotateCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                      Resync Fraud Check
                    </Button>
                  )}
                  {limitReached ? (
                    <div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-500">
                      <Lock className="h-3.5 w-3.5" /> Maximum Fraud Check limit reached
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={recheck} disabled={isFetching}>
                      <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                      Re-check ({count}/{max})
                    </Button>
                  )}
                </div>
              </div>

            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({
  label, value, sub, tone,
}: {
  label: string; value: any; sub?: string; tone: "blue" | "green" | "red" | "violet";
}) {
  const toneCls =
    tone === "blue"   ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-400" :
    tone === "green"  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400" :
    tone === "red"    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400" :
                        "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-400";
  return (
    <div className={`rounded-2xl border p-3 text-center shadow-sm ${toneCls}`}>
      <div className="text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-0.5 text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] opacity-70">{sub}</div>}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2.5">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
