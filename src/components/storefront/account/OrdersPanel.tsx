// Product-type aware order list for the customer account.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Search,
  Download,
  Truck,
  Wrench,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Package,
  RotateCcw,
  Repeat,
} from "lucide-react";
import { listMyOrders, cancelMyOrder } from "@/lib/customer-account.functions";
import { ReturnStatusCard } from "@/components/storefront/order/ReturnRequestDialog";
import { ReturnWizard } from "@/components/storefront/order/ReturnWizard";
import {
  ORDER_TYPE_ACTION,
  ORDER_TYPE_LABEL,
  ORDER_TYPE_TONE,
  asOrderType,
  canCancel,
  paymentTone,
  statusTone,
  taka,
  type OrderType,
} from "@/lib/order-display";
import { OrderTracker } from "@/components/storefront/account/OrderTracker";
import { Input } from "@/components/ui/input";
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
import { EmptyState } from "./EmptyState";
import { useStoreT } from "@/lib/store-i18n";

function returnStatusLabel(t: (k: string) => string, status: string) {
  const map: Record<string, string> = {
    requested: t("account.returnPending"),
    approved: t("account.returnApproved"),
    rejected: t("account.returnRejected"),
    refunded: t("account.refunded"),
    completed: t("account.returnCompleted"),
  };
  return map[status] ?? status;
}

const RETURN_STATUS_TONE: Record<string, string> = {
  requested: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-blue-50 text-blue-700 ring-blue-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  refunded: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};


function typeTabs(t: (k: string) => string): { key: "all" | OrderType; label: string }[] {
  return [
    { key: "all", label: t("common.all") },
    { key: "physical", label: t("account.typePhysical") },
    { key: "digital", label: t("account.typeDigital") },
    { key: "service", label: t("account.typeService") },
    { key: "subscription", label: t("account.typeSubscription") },
  ];
}

const STATUSES = ["all", "pending", "completed", "cancelled", "active", "expired"] as const;
function statusLabel(t: (k: string) => string, s: string) {
  const map: Record<string, string> = {
    all: t("account.allStatus"),
    pending: t("account.statusPending"),
    completed: t("account.statusCompleted"),
    cancelled: t("account.statusCancelled"),
    active: t("account.statusActive"),
    expired: t("account.statusExpired"),
  };
  return map[s] ?? s;
}

const TYPE_ICON: Record<OrderType, typeof Truck> = {
  physical: Truck,
  digital: Download,
  service: Wrench,
  subscription: RefreshCw,
};

export function OrdersPanel({ slug, token }: { slug: string; token: string }) {
  const { t } = useStoreT();
  const TYPE_TABS = typeTabs(t);
  const listFn = useServerFn(listMyOrders);
  const cancelFn = useServerFn(cancelMyOrder);
  const qc = useQueryClient();

  const [type, setType] = useState<"all" | OrderType>("all");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [search, setSearch] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [returnFor, setReturnFor] = useState<{ order: any; type: "return" | "exchange" } | null>(
    null,
  );
  const [returnBusy, setReturnBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});


  const { data, isLoading } = useQuery({
    queryKey: ["my-orders", slug, token, type, status, sort, search],
    queryFn: () =>
      listFn({
        data: {
          storeSlug: slug,
          token,
          type: type === "all" ? undefined : type,
          status: status === "all" ? undefined : status,
          sort,
          search: search.trim() || undefined,
        },
      }),
  });

  const rows = useMemo(() => (data ?? []) as any[], [data]);
  // Type filter only appears when this customer actually has non-physical orders.
  const [hasOtherTypes, setHasOtherTypes] = useState(false);
  useEffect(() => {
    if (rows.some((o) => o.order_type && o.order_type !== "physical")) setHasOtherTypes(true);
  }, [rows]);

  async function doCancel() {
    if (!cancelId) return;
    setBusy(true);
    try {
      await cancelFn({ data: { storeSlug: slug, token, orderId: cancelId } });
      toast.success(t("account.orderCancelled"));
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      setCancelId(null);
    } catch (e: any) {
      toast.error(e?.message ?? t("account.cancelError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <OrderTracker slug={slug} compact showDetailLink />

      {hasOtherTypes && (
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TYPE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-colors ${
              type === t.key
                ? "bg-sf-accent text-white ring-sf-accent"
                : "bg-white text-neutral-600 ring-neutral-200 hover:bg-neutral-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("account.searchOrderPlaceholder")}
            className="h-9 rounded-full border-neutral-200 pl-9 text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-xs font-medium capitalize outline-none focus:border-sf-accent"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(t, s)}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-xs font-medium outline-none focus:border-sf-accent"
        >
          <option value="newest">{t("account.newest")}</option>
          <option value="oldest">{t("account.oldest")}</option>
        </select>
      </div>


      {isLoading ? (
        <div className="py-10 text-center text-sm text-neutral-500">{t("common.loading")}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={t("account.noOrders")}
          hint={t("account.noOrdersDesc")}
          action={
            <Link
              to="/store/$slug"
              params={{ slug }}
              className="rounded-full bg-sf-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sf-accent-hover"
            >
              {t("account.startShopping")}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((o) => {
            const ot = asOrderType(o.order_type);
            const Icon = TYPE_ICON[ot];
            return (
              <li
                key={o.id}
                className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm"
              >
                <div className="flex gap-3 p-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                    {o.product_image ? (
                      <img
                        src={o.product_image}
                        alt={o.product_name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-neutral-400">
                        <Package className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-semibold text-neutral-900">
                        {o.product_name}
                        {o.extra_items > 0 && (
                          <span className="text-neutral-500"> +{o.extra_items} {t("account.moreItems")}</span>
                        )}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${ORDER_TYPE_TONE[ot]}`}
                      >
                        {ORDER_TYPE_LABEL[ot]}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-500">
                      <span className="font-mono">
                        {o.invoice_no ?? o.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span>·</span>
                      <span>{new Date(o.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${statusTone(o.status)}`}
                      >
                        {o.status}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${paymentTone(o.payment_status)}`}
                      >
                        {o.payment_status}
                      </span>
                      <span className="ml-auto text-sm font-bold text-neutral-900">
                        {taka(o.total)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t border-neutral-100 px-3 py-2">
                  <Link
                    to="/store/$slug/order/$orderId"
                    params={{ slug, orderId: o.id }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-900 hover:underline"
                  >
                    {t("account.viewDetails")} <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    to="/store/$slug/order/$orderId"
                    params={{ slug, orderId: o.id }}
                    className="inline-flex items-center gap-1 rounded-full bg-sf-accent px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-sf-accent-hover"
                  >
                    <Icon className="h-3.5 w-3.5" /> {ORDER_TYPE_ACTION[ot]}
                  </Link>
                  {canCancel(o) && (
                    <button
                      type="button"
                      onClick={() => setCancelId(o.id)}
                      className="ml-auto text-[11px] font-semibold text-rose-600 hover:underline"
                    >
                      {t("common.cancel")}
                    </button>
                  )}
                </div>

                {(o.return_eligible || (o.returns ?? []).length > 0) && (
                  <div className="border-t border-neutral-100 px-3 py-2">
                    {(o.returns ?? []).length > 0 && (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setExpanded((p) => ({ ...p, [o.id]: !p[o.id] }))}
                          className="flex w-full items-center gap-2"
                        >
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${
                              RETURN_STATUS_TONE[o.returns[0].status] ??
                              "bg-neutral-100 text-neutral-600 ring-neutral-200"
                            }`}
                          >
                            {returnStatusLabel(t, o.returns[0].status)}
                          </span>
                          <ChevronDown
                            className={`ml-auto h-4 w-4 text-neutral-400 transition-transform ${
                              expanded[o.id] ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {expanded[o.id] && (
                          <div className="space-y-2">
                            {(o.returns as any[]).map((r) => (
                              <ReturnStatusCard key={r.id} r={r} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {o.return_eligible && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-sf-accent text-[11px] text-sf-accent hover:bg-sf-accent-soft hover:text-sf-accent"
                          onClick={() => setReturnFor({ order: o, type: "return" })}
                        >
                          <RotateCcw className="mr-1 h-3.5 w-3.5" /> {t("account.requestReturn")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-sf-accent text-[11px] text-sf-accent hover:bg-sf-accent-soft hover:text-sf-accent"
                          onClick={() => setReturnFor({ order: o, type: "exchange" })}
                        >
                          <Repeat className="mr-1 h-3.5 w-3.5" /> {t("account.requestExchange")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

              </li>
            );
          })}
        </ul>
      )}

      {returnFor && token && (
        <ReturnWizard
          slug={slug}
          token={token}
          orderId={returnFor.order.id}
          initialKind={returnFor.type === "exchange" ? "exchange_same" : "return"}
          onClose={() => setReturnFor(null)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["my-orders"] });
            qc.invalidateQueries({ queryKey: ["my-returns"] });
          }}
        />
      )}

      <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("account.cancelOrderTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("account.cancelOrderDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("account.keepOrder")}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} className="bg-rose-600 text-white hover:bg-rose-700" onClick={(e) => { e.preventDefault(); doCancel(); }}>
              {busy ? t("account.cancelling") : t("account.yesCancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function OrderCancelButton({
  slug,
  token,
  order,
  onDone,
}: {
  slug: string;
  token: string | null;
  order: { id: string; order_type: string; status: string; confirmation_status?: string };
  onDone?: () => void;
}) {
  const { t } = useStoreT();
  const cancelFn = useServerFn(cancelMyOrder);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!token || !canCancel(order)) return null;

  return (
    <>
      <Button variant="outline" className="w-full border-rose-600 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => setOpen(true)}>
        Cancel order
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              You can only cancel before the order is confirmed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await cancelFn({ data: { storeSlug: slug, token, orderId: order.id } });
                  toast.success(t("account.orderCancelled"));
                  setOpen(false);
                  onDone?.();
                } catch (err: any) {
                  toast.error(err?.message ?? "Could not cancel");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Cancelling…" : "Yes, cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
