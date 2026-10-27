import { StoreErrorState } from "@/components/storefront/StoreErrorState";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, Truck, Package, Clock, Download, ReceiptText, ShoppingBag } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrder, verifyOrderPayment } from "@/lib/storefront.functions";
import { getOrderDigitalAccess } from "@/lib/digital.functions";
import { DigitalOrderAccess } from "@/components/storefront/digital/DigitalOrderAccess";
import { fbTrack, purchaseEventId } from "@/lib/fb-track";
import { PaymentTimeline } from "@/components/storefront/PaymentTimeline";
import { ServiceOrderView } from "@/components/storefront/order/ServiceOrderView";
import { SubscriptionOrderView } from "@/components/storefront/order/SubscriptionOrderView";
import { ReturnRequestBlock } from "@/components/storefront/order/ReturnRequestBlock";
import { ReturnStages } from "@/components/storefront/order/ReturnStages";
import { OrderActions } from "@/components/storefront/order/OrderActions";
import { paymentStatusLabel } from "@/lib/order-display";
import { useStoreT } from "@/lib/store-i18n";
import { useCustomerSession } from "@/lib/customer-session";
import { readOrderContact } from "@/lib/order-proof";
import { OrderLockedCard } from "@/components/storefront/order/OrderLockedCard";



const orderQuery = (orderId: string, proof?: { token?: string | null; contact?: string | null }) =>
  queryOptions({
    queryKey: ["order", orderId, proof?.token ?? "", proof?.contact ?? ""],
    queryFn: () =>
      getOrder({
        data: {
          orderId,
          ...(proof?.token ? { token: proof.token } : {}),
          ...(proof?.contact ? { contact: proof.contact } : {}),
        },
      }),

  });

export const Route = createFileRoute("/store/$slug/order/$orderId")({
  head: () => ({ meta: [{ title: "Order confirmed" }] }),
  loader: async ({ context, params }) => {
    const order = await context.queryClient.ensureQueryData(orderQuery(params.orderId));
    if (!order) throw notFound();
    return null;
  },
  errorComponent: ({ error }) => <StoreErrorState error={error} scope="storefront:order" />,
  notFoundComponent: () => <div className="p-6 text-center">Order not found</div>,
  component: OrderConfirmation,
});

const STAGE_KEY: Record<string, string> = {
  placed: "order.stage.placed",
  confirmed: "order.stage.confirmed",
  packed: "order.stage.packed",
  courier_assigned: "order.stage.courier_assigned",
  shipped: "order.stage.shipped",
  delivered: "order.stage.delivered",
  completed: "order.stage.completed",
  returned: "order.stage.returned",
  cancelled: "order.stage.cancelled",
};

const STAGE_ORDER = [
  "placed",
  "confirmed",
  "packed",
  "courier_assigned",
  "shipped",
  "delivered",
  "completed",
];


function OrderConfirmation() {
  const { t } = useStoreT();
  const { slug, orderId } = Route.useParams();
  const { token } = useCustomerSession(slug);
  const [contact, setContact] = useState<string | null>(null);
  useEffect(() => setContact(readOrderContact(orderId)), [orderId]);
  const { data: order } = useSuspenseQuery(orderQuery(orderId, { token, contact }));
  const qc = useQueryClient();
  const verifyPay = useServerFn(verifyOrderPayment);
  const listDigital = useServerFn(getOrderDigitalAccess);
  const { data: digitalItems = [] } = useQuery({
    queryKey: ["digitalAccess", orderId],
    queryFn: () => listDigital({ data: { orderId } }),
    refetchInterval: (q) =>
      ((q.state.data as any[]) ?? []).some((d) => d.status !== "active") ? 10_000 : false,
  });

  // Safety net: if the gateway webhook never arrived, ask the provider
  // directly when the shopper lands back on this page.
  useEffect(() => {
    if (!order) return;
    if ((order as any).payment_method !== "online") return;
    if ((order as any).payment_status === "paid") return;
    let cancelledCheck = false;
    (async () => {
      try {
        await verifyPay({ data: { orderId: (order as any).id, token: token ?? undefined, contact: contact ?? undefined } });
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

  // The link alone is not proof of ownership: the server returns a minimal
  // payload, so ask the shopper to verify instead of rendering a broken page.
  if ((order as any).is_owner === false) {
    return <OrderLockedCard order={order} slug={slug} onVerify={(c) => setContact(c)} />;
  }

  // Type-aware order details: each product type shows only its own workflow.
  const orderType = (order as any).order_type ?? "physical";
  if (orderType === "service") return <ServiceOrderView order={order} slug={slug} />;
  if (orderType === "subscription") return <SubscriptionOrderView order={order} slug={slug} />;

  const timeline: any[] = Array.isArray((order as any).timeline) ? (order as any).timeline : [];
  const reachedStages = new Set(timeline.map((t) => t.stage));
  const cancelled = order.status === "cancelled" || reachedStages.has("cancelled");

  // A digital order has an entitlement for every line it contains.
  const orderItems: any[] = (order.items as any[]) ?? [];
  const dItems = digitalItems as any[];
  const isDigitalOrder = dItems.length > 0 && dItems.length >= orderItems.length;
  const paid = (order as any).payment_status === "paid";
  const accessReady = dItems.some((d) => d.status === "active");
  const digitalStages = [
    { id: "pending", label: t("order.digital.stage.pending"), done: true },
    { id: "paid", label: t("order.digital.stage.paid"), done: paid },
    { id: "processing", label: t("order.digital.stage.processing"), done: paid || dItems.length > 0 },
    { id: "ready", label: t("order.digital.stage.ready"), done: accessReady },
    { id: "completed", label: t("order.digital.stage.completed"), done: dItems.some((d) => d.downloadCount > 0) },
  ];

  return (
    <div className="mx-auto max-w-lg py-8">
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h1 className="mt-3 text-2xl font-semibold">
          {isDigitalOrder
            ? paid
              ? t("order.digital.paymentSuccessTitle")
              : t("order.digital.placedTitle")
            : t("order.digital.placedTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isDigitalOrder
            ? paid
              ? t("order.digital.paidSubtitle")
              : t("order.digital.unpaidSubtitle")
            : t("order.physical.subtitle")}
        </p>
      </div>

      {isDigitalOrder ? (
        <>
          <div className="mt-6 rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t("order.digital.purchaseStatus")}</h2>
              <span className="text-xs uppercase text-muted-foreground">
                {accessReady ? t("order.digital.stage.ready.short") : (order as any).payment_status}
              </span>
            </div>
            <ol className="space-y-3">
              {digitalStages.map((s) => (
                <li key={s.id} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                      s.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/30"
                    }`}
                  >
                    {s.done && <CheckCircle2 className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <p className={`text-sm ${s.done ? "font-semibold" : "text-muted-foreground"}`}>
                    {s.label}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <DigitalOrderAccess orderId={order.id} slug={slug} storeId={order.store_id} />

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              to="/store/$slug/account"
              params={{ slug }}
              search={{ tab: "downloads" as any }}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm font-medium"
            >
              <Download className="h-4 w-4" /> {t("order.myDownloads")}
            </Link>
            <a
              href={`/api/invoice/${order.id}`}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm font-medium"
            >
              <ReceiptText className="h-4 w-4" /> {t("order.viewInvoice")}
            </a>
            <Link
              to="/store/$slug"
              params={{ slug }}
              className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm font-medium"
            >
              <ShoppingBag className="h-4 w-4" /> {t("order.continueShopping")}
            </Link>
          </div>
        </>
      ) : (
      /* Tracking Stepper */
      <div id="order-tracking" className="mt-6 scroll-mt-20 rounded-xl border bg-card p-4">


        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("order.tracking")}</h2>
          <span className="text-xs uppercase text-muted-foreground">{order.status}</span>
        </div>
        {cancelled ? (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {t("order.cancelledNotice")}
          </div>
        ) : (
          <>
          <ol className="space-y-3">
            {STAGE_ORDER.map((stage) => {
              const event = timeline.find((t) => t.stage === stage);
              const done =
                !!event ||
                (stage === "completed" &&
                  reachedStages.has("delivered") &&
                  (order as any).payment_status === "paid");
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
                      {t(STAGE_KEY[stage])}
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
          <ReturnStages order={order} slug={slug} />
          </>
        )}


        {(order as any).courier_name || (order as any).courier_tracking_id ? (
          <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <Truck className="h-3 w-3" /> {t("order.courier")}
            </div>
            <div className="mt-1 space-y-0.5">
              {(order as any).courier_name && <div className="font-medium">{(order as any).courier_name}</div>}
              {(order as any).courier_tracking_id && (
                <div className="text-xs">
                  {t("order.courier.tracking")}{" "}
                  <span className="font-mono">{(order as any).courier_tracking_id}</span>
                </div>
              )}
              {(order as any).courier_status && (
                <div className="text-xs text-muted-foreground">{t("order.courier.status")} {(order as any).courier_status}</div>
              )}
              {(order as any).courier_last_synced_at && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" /> {t("order.courier.updated", { time: new Date((order as any).courier_last_synced_at).toLocaleString() })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
      )}


      <ReturnRequestBlock order={order} slug={slug} />


      <PaymentTimeline orderId={order.id} token={token} contact={contact} refreshKey={String((order as any).payment_status ?? "")} />

      <OrderActions order={order} slug={slug} />


      <div className="mt-4 rounded-xl border bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase text-muted-foreground">
          <Package className="h-3 w-3" /> {t("order.summary")}
        </div>
        <div className="text-xs text-muted-foreground">{t("order.summary.id")}</div>
        <div className="font-mono text-sm">{order.id.slice(0, 8).toUpperCase()}</div>
        <ul className="mt-4 space-y-2 text-sm">
          {orderItems.map((i: any, idx: number) => (
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
            <span>{t("common.subtotal")}</span>
            <span>৳{Number(order.subtotal ?? 0).toFixed(0)}</span>
          </div>
          {Number((order as any).delivery_amount ?? 0) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t("common.delivery")}</span>
              <span>৳{Number((order as any).delivery_amount).toFixed(0)}</span>
            </div>
          )}
          {Number((order as any).discount_amount ?? 0) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t("common.discount")}</span>
              <span>-৳{Number((order as any).discount_amount).toFixed(0)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span>{t("common.total")}</span>
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
          <div>{t("order.summary.name")}</div>
          <div className="text-right text-foreground">{order.customer_name}</div>
          <div>{t("order.summary.phone")}</div>
          <div className="text-right text-foreground">{order.phone}</div>
          <div>{t("order.summary.address")}</div>
          <div className="text-right text-foreground">{order.address}</div>
          <div>{t("order.summary.payment")}</div>
          <div className="text-right text-foreground">
            {String(order.payment_method ?? "cod").toLowerCase() === "cod"
              ? t("order.summary.cod")
              : String(order.payment_method).toUpperCase()}
          </div>
          <div>{t("order.summary.paymentStatus")}</div>
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
              {paymentStatusLabel(
                order.payment_method,
                String((order as any).payment_status ?? "pending"),
              )}
            </span>
          </div>

        </div>
      </div>
      <Link
        to="/store/$slug"
        params={{ slug }}
        className="mt-6 block text-center text-sm font-semibold text-sf-ink transition-colors hover:text-sf-accent"
      >
        {t("order.backToStore")}
      </Link>
    </div>
  );
}
