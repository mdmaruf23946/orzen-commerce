import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";
import { runFraudCheck, getCachedFraudCheck, ensureAutoFraudCheck } from "@/lib/fraud.functions";
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
    risk === "safe" ? "bg-emerald-500/10 text-emerald-600" :
    risk === "medium" ? "bg-amber-500/10 text-amber-600" :
    "bg-red-500/10 text-red-600";
  const Icon = risk === "safe" ? ShieldCheck : risk === "medium" ? AlertTriangle : ShieldAlert;
  const label = risk === "safe" ? "Safe" : risk === "medium" ? "Medium Risk" : "High Risk";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  );
}

export function FraudCheckModal({ open, onOpenChange, phone, orderId }: Props) {
  const runFn = useServerFn(runFraudCheck);
  const qc = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["fraud-check", phone, orderId],
    queryFn: () => runFn({ data: { phone, order_id: orderId } }),
    enabled: open && !!phone,
    staleTime: 5 * 60_000,
    retry: false,
  });

  async function recheck() {
    try {
      await runFn({ data: { phone, order_id: orderId, force: true } });
      qc.invalidateQueries({ queryKey: ["fraud-check", phone, orderId] });
      toast.success("Rechecked");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fraud Check</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">Phone: <span className="font-mono">{phone}</span></div>
          {isLoading && <div className="py-8 text-center text-sm text-muted-foreground">Checking…</div>}
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {(error as Error).message}
            </div>
          )}
          {data && (
            <>
              <div className="flex items-center justify-between rounded-xl border p-3">
                <RiskBadge risk={(data as any).risk} />
                {(data as any).cached && (
                  <span className="text-[10px] text-muted-foreground">Cached · {new Date((data as any).checked_at).toLocaleString()}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Stat label="Total Orders" value={(data as any).total_orders} />
                <Stat label="Successful" value={(data as any).successful} tone="ok" />
                <Stat label="Returned" value={(data as any).returned} tone="bad" />
                <Stat label="Cancelled" value={(data as any).cancelled} />
                <Stat label="COD Success" value={`${(data as any).cod_success_rate ?? 0}%`} />
                <Stat label="Last Delivery" value={(data as any).last_delivery ? new Date((data as any).last_delivery).toLocaleDateString() : "—"} />
              </div>
              {Array.isArray((data as any).courier_history) && (data as any).courier_history.length > 0 && (
                <details className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-xs font-medium">Courier History</summary>
                  <ul className="mt-2 space-y-1.5 text-xs">
                    {(data as any).courier_history.map((c: any, i: number) => (
                      <li key={i} className="flex items-center justify-between">
                        <span className="capitalize">{c.courier}</span>
                        <span className="text-muted-foreground">
                          {c.success}/{c.total} · {c.rate}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <Button size="sm" variant="outline" onClick={recheck} disabled={isFetching} className="w-full">
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Re-check
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: any; tone?: "ok" | "bad" }) {
  const cls = tone === "ok" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "";
  return (
    <div className="rounded-lg border bg-muted/30 p-2.5">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
