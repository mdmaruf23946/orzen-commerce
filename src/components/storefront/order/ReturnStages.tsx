// Branch lifecycle rows (return / exchange / refund) shown under the tracking ladder.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, RotateCcw, Repeat, Banknote } from "lucide-react";
import { listMyOrderReturns } from "@/lib/returns.functions";
import { useCustomerSession } from "@/lib/customer-session";

const LABEL: Record<string, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  refunded: "Refund processed",
  completed: "Completed",
};

export function ReturnStages({ order, slug }: { order: any; slug: string }) {
  const { token } = useCustomerSession(slug);
  const listFn = useServerFn(listMyOrderReturns);
  const { data: requests = [] } = useQuery({
    queryKey: ["my-returns", order.id, token],
    queryFn: () => listFn({ data: { storeSlug: slug, token: token!, orderId: order.id } }),
    enabled: !!token,
  });

  const rows = (requests as any[]) ?? [];
  if (rows.length === 0) return null;

  return (
    <ol className="mt-4 space-y-3 border-t pt-4">
      {rows.map((r) => {
        const Icon = r.type === "exchange" ? Repeat : RotateCcw;
        const refunded = r.status === "refunded" || Number(r.refund_amount ?? 0) > 0;
        return (
          <li key={r.id} className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-emerald-500 bg-emerald-500 text-white">
                <CheckCircle2 className="h-3 w-3" strokeWidth={3} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Icon className="h-3.5 w-3.5" />
                  {r.type === "exchange" ? "Exchange requested" : "Return requested"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()} · {LABEL[r.status] ?? r.status}
                </p>
              </div>
            </div>
            {refunded && (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-emerald-500 bg-emerald-500 text-white">
                  <CheckCircle2 className="h-3 w-3" strokeWidth={3} />
                </span>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                  <Banknote className="h-3.5 w-3.5" /> Refund processed
                  {Number(r.refund_amount ?? 0) > 0
                    ? ` · ৳${Number(r.refund_amount).toFixed(0)}`
                    : ""}
                </p>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
