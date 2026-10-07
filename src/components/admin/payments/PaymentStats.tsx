import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPaymentGatewayStats, type GatewayStat } from "@/lib/payment-gateway-stats.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const RANGES = [7, 30, 90, 365] as const;

export function usePaymentStats(storeId: string | null, days: number, gatewayId?: string) {
  const fn = useServerFn(getPaymentGatewayStats);
  return useQuery({
    enabled: !!storeId,
    queryKey: ["payment-gateway-stats", storeId, gatewayId ?? "all", days],
    queryFn: () => fn({ data: { storeId: storeId!, days, gatewayId } }),
    staleTime: 60_000,
  });
}

export function sumStats(list: GatewayStat[]): GatewayStat {
  return list.reduce(
    (a, s) => ({
      gateway: "all",
      total: a.total + s.total,
      successful: a.successful + s.successful,
      failed: a.failed + s.failed,
      pending: a.pending + s.pending,
      amount: a.amount + s.amount,
      refunds: a.refunds + s.refunds,
      refundAmount: a.refundAmount + s.refundAmount,
    }),
    { gateway: "all", total: 0, successful: 0, failed: 0, pending: 0, amount: 0, refunds: 0, refundAmount: 0 },
  );
}

export const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-US")}`;

export function RangePicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <div className="inline-flex rounded-lg border bg-card p-0.5 text-xs">
      {RANGES.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className={cn("rounded-md px-2.5 py-1", value === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {d === 365 ? "1 year" : `${d} days`}
        </button>
      ))}
    </div>
  );
}

export function PaymentKpis({ s, loading }: { s: GatewayStat; loading?: boolean }) {
  const items = [
    { label: "Total Payments", value: s.total.toLocaleString() },
    { label: "Successful", value: s.successful.toLocaleString() },
    { label: "Failed", value: s.failed.toLocaleString() },
    { label: "Pending", value: s.pending.toLocaleString() },
    { label: "Total Amount", value: taka(s.amount) },
    { label: "Refunds", value: s.refunds ? `${s.refunds} · ${taka(s.refundAmount)}` : "0" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border bg-card p-3">
          <div className="text-[11px] text-muted-foreground">{it.label}</div>
          {loading ? <Skeleton className="mt-1 h-6 w-16" /> : <div className="mt-0.5 text-lg font-semibold">{it.value}</div>}
        </div>
      ))}
    </div>
  );
}
