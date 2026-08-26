// Status-aware action bar for the customer order details page.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RotateCcw,
  Repeat,
  Truck,
  XCircle,
  ReceiptText,
  ShoppingBag,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ReturnWizard } from "@/components/storefront/order/ReturnWizard";
import { createMyReturnRequest, getReturnContext, listMyOrderReturns } from "@/lib/returns.functions";
import { cancelMyOrder } from "@/lib/customer-account.functions";
import { useCustomerSession } from "@/lib/customer-session";
import { addToCart } from "@/lib/cart";
import { useStoreT } from "@/lib/store-i18n";

const DEFAULT_WINDOW_DAYS = 7;

export function OrderActions({ order, slug }: { order: any; slug: string }) {
  const { t } = useStoreT();
  const { token } = useCustomerSession(slug);
  const qc = useQueryClient();
  const listFn = useServerFn(listMyOrderReturns);
  const contextFn = useServerFn(getReturnContext);
  const createFn = useServerFn(createMyReturnRequest);
  const cancelFn = useServerFn(cancelMyOrder);
  const [type, setType] = useState<"return" | "exchange" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: requests = [] } = useQuery({
    queryKey: ["my-returns", order.id, token],
    queryFn: () => listFn({ data: { storeSlug: slug, token: token!, orderId: order.id } }),
    enabled: !!token,
  });

  const { data: returnCtx } = useQuery({
    queryKey: ["return-context", order.id, token],
    queryFn: () => contextFn({ data: { storeSlug: slug, token: token!, orderId: order.id } }),
    enabled: !!token,
  });
  const returnsEnabled = (returnCtx as any)?.policy?.enabled !== false;
  const windowDays =
    Number((returnCtx as any)?.policy?.eligibility_days) > 0
      ? Number((returnCtx as any).policy.eligibility_days)
      : DEFAULT_WINDOW_DAYS;

  const create = useMutation({
    mutationFn: (payload: any) => createFn({ data: payload }),
    onSuccess: () => {
      toast.success(t("order.actions.toast.requestSubmitted"));
      setType(null);
      qc.invalidateQueries({ queryKey: ["my-returns", order.id] });
      qc.invalidateQueries({ queryKey: ["order", order.id] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("order.actions.toast.requestFailed")),
  });

  const cancel = useMutation({
    mutationFn: () => cancelFn({ data: { storeSlug: slug, token: token!, orderId: order.id } }),
    onSuccess: () => {
      toast.success(t("order.actions.toast.orderCancelled"));
      setConfirmCancel(false);
      qc.invalidateQueries({ queryKey: ["order", order.id] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("order.actions.toast.cancelFailed")),
  });

  const timeline: any[] = Array.isArray(order.timeline) ? order.timeline : [];
  const stages = new Set(timeline.map((t) => t.stage));
  const delivered = timeline.find((t) => t.stage === "delivered");
  const cancelled = order.status === "cancelled" || stages.has("cancelled");
  const shipped = stages.has("shipped") || stages.has("courier_assigned");
  const hasTracking = !!order.courier_tracking_id || !!order.courier_name;
  const openRequest = (requests as any[]).some(
    (r) => r.status === "requested" || r.status === "approved",
  );

  const canCancelNow =
    !cancelled &&
    !shipped &&
    !hasTracking &&
    order.status !== "delivered" &&
    (order.order_type ?? "physical") !== "subscription";

  const returnEligible =
    returnsEnabled &&
    (order.order_type ?? "physical") === "physical" &&
    !cancelled &&
    !!delivered &&
    Date.now() - new Date(delivered.created_at).getTime() <= windowDays * 86_400_000 &&
    !openRequest;

  const canBuyAgain = !!delivered || cancelled || order.status === "delivered";

  function buyAgain() {
    const items = (order.items as any[]) ?? [];
    let added = 0;
    for (const i of items) {
      if (!i.product_id) continue;
      addToCart(slug, {
        productId: i.product_id,
        name: i.name_snapshot,
        price: Number(i.price_snapshot ?? 0),
        image: i.image ?? null,
        qty: Number(i.qty ?? 1),
      });
      added += 1;
    }
    if (added === 0) toast.error(t("order.actions.toast.itemsUnavailable"));
    else toast.success(t("order.actions.toast.addedToCart"));
  }

  function trackShipment() {
    document.getElementById("order-tracking")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mt-4 rounded-xl border bg-card p-4" data-no-print>
      <h2 className="text-sm font-semibold">{t("order.actions.title")}</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {canCancelNow && token && (
          <Button variant="outline" onClick={() => setConfirmCancel(true)}>
            <XCircle className="mr-1 h-4 w-4" /> {t("order.actions.cancelOrder")}
          </Button>
        )}
        {(shipped || hasTracking) && (
          <Button variant="outline" onClick={trackShipment}>
            <Truck className="mr-1 h-4 w-4" /> {t("order.actions.trackShipment")}
          </Button>
        )}
        {returnEligible && token && (
          <>
            <Button variant="outline" onClick={() => setType("return")}>
              <RotateCcw className="mr-1 h-4 w-4" /> {t("order.actions.requestReturn")}
            </Button>
            <Button variant="outline" onClick={() => setType("exchange")}>
              <Repeat className="mr-1 h-4 w-4" /> {t("order.actions.requestExchange")}
            </Button>
          </>
        )}
        <Button variant="outline" onClick={() => window.print()}>
          <ReceiptText className="mr-1 h-4 w-4" /> {t("order.downloadInvoice")}
        </Button>
        {canBuyAgain && (
          <Button variant="outline" onClick={buyAgain}>
            <RefreshCw className="mr-1 h-4 w-4" /> {t("order.actions.buyAgain")}
          </Button>
        )}
        <Link
          to="/store/$slug"
          params={{ slug }}
          className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-md border text-sm font-medium"
        >
          <ShoppingBag className="h-4 w-4" /> {t("order.continueShopping")}
        </Link>
      </div>

      {!token && (canCancelNow || returnEligible) && (
        <p className="mt-3 text-xs text-muted-foreground">
          <Link
            to="/store/$slug/auth/login"
            params={{ slug }}
            className="font-semibold underline"
          >
            {t("order.actions.signIn")}
          </Link>{" "}
          {t("order.actions.signInHint")}
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

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("order.actions.cancelDialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("order.actions.cancelDialogDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("order.actions.keepOrder")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancel.isPending}
              onClick={(e) => {
                e.preventDefault();
                cancel.mutate();
              }}
            >
              {cancel.isPending ? t("order.actions.cancelling") : t("order.actions.yesCancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
