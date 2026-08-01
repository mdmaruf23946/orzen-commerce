import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { CheckCircle2, Truck, Package, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrder, verifyOrderPayment } from "@/lib/storefront.functions";
import { fbTrack, purchaseEventId } from "@/lib/fb-track";
import { PaymentTimeline } from "@/components/storefront/PaymentTimeline";
import { DownloadsPanel } from "@/components/storefront/DownloadsPanel";

const orderQuery = (orderId: string) =>
  queryOptions({
    queryKey: ["order", orderId],
    queryFn: () => getOrder({ data: { orderId } }),
    refetchInterval: 30_000,
  });

export const Route = createFileRoute("/store/$slug/order/$orderId")({
  head: () => ({ meta: [{ title: "Order confirmed" }] }),
  loader: async ({ context, params }) => {
    const order = await context.queryClient.ensureQueryData(orderQuery(params.orderId));
    if (!order) throw notFound();
    return null;
  },
  errorComponent: () => <div className="p-6 text-center">Something went wrong.</div>,
  notFoundComponent: () => <div className="p-6 text-center">Order not found</div>,
  component: OrderConfirmation,
});

const STAGE_LABEL: Record<string, string> = {
  placed: "Order Placed",
  confirmed: "Confirmed",
  packed: "Packed",
  courier_assigned: "Courier Assigned",
  shipped: "Shipped",
  delivered: "Delivered",
  returned: "Returned",
  cancelled: "Cancelled",
};

const STAGE_ORDER = ["placed", "confirmed", "packed", "courier_assigned", "shipped", "delivered"];

function OrderConfirmation() {
  const { slug, orderId } = Route.useParams();
  const { data: order } = useSuspenseQuery(orderQuery(orderId));
  const qc = useQueryClient();
  const verifyPay = useServerFn(verifyOrderPayment);
  // Safety net: if the gateway webhook never arrived, ask the provider
  // directly when the shopper lands back on this page.
  useEffect(() => {
    if (!order) return;
    if ((order as any).payment_method !== "online") return;
    if ((order as any).payment_status === "paid") return;
    let cancelledCheck = false;
    (async () => {
      try {
        await verifyPay({ data: { orderId: (order as any).id } });
        if (!cancelledCheck) qc.invalidateQueries({ queryKey: ["order", orderId] });
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelledCheck = true;
    };
  }, [order?.id, (order as any)?.payment_status]);
  useEffect(() => {
    if (!order) return;
    const key = `fb:purchase:${order.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    const items = (order.items as any[]) ?? [];
    fbTrack(
      "Purchase",
      {
        value: Number(order.subtotal),
        currency: "BDT",
        content_ids: items.map((i) => i.product_id ?? i.name_snapshot),
        contents: items.map((i) => ({ id: i.product_id, quantity: i.qty, item_price: Number(i.price_snapshot) })),
        num_items: items.reduce((a, i) => a + i.qty, 0),
      },
      {
        eventId: purchaseEventId(order.id),
        userData: { phone: order.phone },
      },
    );
  }, [order?.id]);
  if (!order) return null;

  const timeline: any[] = Array.isArray((order as any).timeline) ? (order as any).timeline : [];
  const reachedStages = new Set(timeline.map((t) => t.stage));
  const cancelled = order.status === "cancelled" || reachedStages.has("cancelled");

  return (
    <div className="mx-auto max-w-lg py-8">
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h1 className="mt-3 text-2xl font-semibold">Order placed</h1>
        <p className="mt-1 text-sm text-muted-foreground">We'll contact you shortly to confirm.</p>
      </div>

      {/* Tracking Stepper */}
      <div className="mt-6 rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Order tracking</h2>
          <span className="text-xs uppercase text-muted-foreground">{order.status}</span>
        </div>
        {cancelled ? (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            This order has been cancelled.
          </div>
        ) : (
          <ol className="space-y-3">
            {STAGE_ORDER.map((stage) => {
              const event = timeline.find((t) => t.stage === stage);
              const done = !!event;
              return (
                <li key={stage} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                      done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/30"
                    }`}
                  >
                    {done && <CheckCircle2 className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${done ? "font-semibold" : "text-muted-foreground"}`}>
                      {STAGE_LABEL[stage]}
                    </p>
                    {event && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.created_at).toLocaleString()}
                        {event.note ? ` · ${event.note}` : ""}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {(order as any).courier_name || (order as any).courier_tracking_id ? (
          <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <Truck className="h-3 w-3" /> Courier
            </div>
            <div className="mt-1 space-y-0.5">
              {(order as any).courier_name && <div className="font-medium">{(order as any).courier_name}</div>}
              {(order as any).courier_tracking_id && (
                <div className="text-xs">
                  Tracking:{" "}
                  <span className="font-mono">{(order as any).courier_tracking_id}</span>
                </div>
              )}
              {(order as any).courier_status && (
                <div className="text-xs text-muted-foreground">Status: {(order as any).courier_status}</div>
              )}
              {(order as any).courier_last_synced_at && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" /> Updated {new Date((order as any).courier_last_synced_at).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <DownloadsPanel orderId={order.id} />

      <PaymentTimeline orderId={order.id} refreshKey={String((order as any).payment_status ?? "")} />

      <div className="mt-4 rounded-xl border bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase text-muted-foreground">
          <Package className="h-3 w-3" /> Order summary
        </div>
        <div className="text-xs text-muted-foreground">Order ID</div>
        <div className="font-mono text-sm">{order.id.slice(0, 8).toUpperCase()}</div>
        <ul className="mt-4 space-y-2 text-sm">
          {(order.items as any[]).map((i: any, idx: number) => (
            <li key={idx} className="flex justify-between gap-3">
              <span>
                {i.name_snapshot} × {i.qty}
              </span>
              <span>৳{(Number(i.price_snapshot) * i.qty).toFixed(0)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>৳{Number(order.subtotal ?? 0).toFixed(0)}</span>
          </div>
          {Number((order as any).delivery_amount ?? 0) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Delivery</span>
              <span>৳{Number((order as any).delivery_amount).toFixed(0)}</span>
            </div>
          )}
          {Number((order as any).discount_amount ?? 0) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span>-৳{Number((order as any).discount_amount).toFixed(0)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span>Total</span>
            <span className="text-lg font-bold">
              ৳{(
                Number(order.subtotal ?? 0) +
                Number((order as any).delivery_amount ?? 0) -
                Number((order as any).discount_amount ?? 0)
              ).toFixed(0)}
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>Name</div>
          <div className="text-right text-foreground">{order.customer_name}</div>
          <div>Phone</div>
          <div className="text-right text-foreground">{order.phone}</div>
          <div>Address</div>
          <div className="text-right text-foreground">{order.address}</div>
          <div>Payment</div>
          <div className="text-right text-foreground uppercase">{order.payment_method}</div>
          <div>Payment status</div>
          <div className="text-right">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                (order as any).payment_status === "paid"
                  ? "bg-emerald-100 text-emerald-700"
                  : (order as any).payment_status === "failed"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
              }`}
            >
              {String((order as any).payment_status ?? "pending").toUpperCase()}
            </span>
          </div>
        </div>
      </div>
      <Link
        to="/store/$slug"
        params={{ slug }}
        className="mt-6 block text-center text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to store
      </Link>
    </div>
  );
}
