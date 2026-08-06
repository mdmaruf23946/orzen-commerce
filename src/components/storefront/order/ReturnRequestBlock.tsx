// Customer-initiated return / exchange request for a delivered order.
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Repeat } from "lucide-react";
import { listMyOrderReturns } from "@/lib/returns.functions";
import { useCustomerSession } from "@/lib/customer-session";
import { Button } from "@/components/ui/button";
import { ReturnStatusCard } from "@/components/storefront/order/ReturnRequestDialog";
import { ReturnWizard } from "@/components/storefront/order/ReturnWizard";

const WINDOW_DAYS = 7;

export function ReturnRequestBlock({ order, slug }: { order: any; slug: string }) {
  const { token } = useCustomerSession(slug);
  const qc = useQueryClient();
  const listFn = useServerFn(listMyOrderReturns);
  const [type, setType] = useState<"return" | "exchange" | null>(null);


  const { data: requests = [] } = useQuery({
    queryKey: ["my-returns", order.id, token],
    queryFn: () => listFn({ data: { storeSlug: slug, token: token!, orderId: order.id } }),
    enabled: !!token,
  });


  const timeline: any[] = Array.isArray(order.timeline) ? order.timeline : [];
  const delivered = timeline.find((t) => t.stage === "delivered");
  const withinWindow = delivered
    ? Date.now() - new Date(delivered.created_at).getTime() <= WINDOW_DAYS * 86_400_000
    : false;
  const open = (requests as any[]).some((r) => r.status === "requested" || r.status === "approved");
  const eligible =
    (order.order_type ?? "physical") === "physical" &&
    order.status !== "cancelled" &&
    !!delivered &&
    withinWindow &&
    !open;

  if (!token) return null;
  if (!delivered && (requests as any[]).length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">Returns &amp; exchanges</h2>

      <div className="mt-3 space-y-2">
        {(requests as any[]).map((r) => (
          <ReturnStatusCard key={r.id} r={r} />
        ))}
      </div>

      {eligible && (requests as any[]).length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Use the buttons in “Order actions” to request a return or exchange within {WINDOW_DAYS}{" "}
          days of delivery.
        </p>
      )}


      {type && token && (
        <ReturnWizard
          slug={slug}
          token={token}
          orderId={order.id}
          initialKind={type === "exchange" ? "exchange_same" : "return"}
          onClose={() => setType(null)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["my-returns", order.id] });
            qc.invalidateQueries({ queryKey: ["my-orders"] });
          }}
        />
      )}
    </div>
  );
}
