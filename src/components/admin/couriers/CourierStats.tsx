import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { parcelStatusCounts } from "@/lib/courier-parcels.functions";
import type { CourierKey } from "./providers";

export type ParcelSummary = { total: number; active: number; delivered: number; returned: number; failed: number };

export function summarize(counts: Record<string, number> | undefined): ParcelSummary {
  const c = counts ?? {};
  const n = (k: string) => c[k] ?? 0;
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  return {
    total,
    active: n("pending") + n("pickup_requested") + n("pickup_completed") + n("in_transit") + n("hold"),
    delivered: n("delivered") + n("partial_delivered"),
    returned: n("returned"),
    failed: n("cancelled") + n("failed"),
  };
}

export function useCourierCounts(key: CourierKey, enabled = true) {
  const fn = useServerFn(parcelStatusCounts);
  return useQuery({
    queryKey: ["parcel-counts", key],
    queryFn: () => fn({ data: { courierKey: key } }),
    enabled,
    staleTime: 60_000,
  });
}

export function StatGrid({ s }: { s: ParcelSummary }) {
  const items = [
    { label: "Total parcels", value: s.total },
    { label: "In progress", value: s.active },
    { label: "Delivered", value: s.delivered },
    { label: "Returned", value: s.returned },
    { label: "Cancelled / failed", value: s.failed },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {items.map((i) => (
        <div key={i.label} className="rounded-xl border bg-card p-3">
          <div className="text-xs text-muted-foreground">{i.label}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{i.value}</div>
        </div>
      ))}
    </div>
  );
}
