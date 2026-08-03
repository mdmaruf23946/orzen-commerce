// Product-type aware order list for the customer account.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Download, Truck, Wrench, RefreshCw, ChevronRight, Package } from "lucide-react";
import { listMyOrders, cancelMyOrder } from "@/lib/customer-account.functions";
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

const TYPE_TABS: { key: "all" | OrderType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "physical", label: "Physical" },
  { key: "digital", label: "Digital" },
  { key: "service", label: "Service" },
  { key: "subscription", label: "Subscription" },
];

const STATUSES = ["all", "pending", "completed", "cancelled", "active", "expired"] as const;

const TYPE_ICON: Record<OrderType, typeof Truck> = {
  physical: Truck,
  digital: Download,
  service: Wrench,
  subscription: RefreshCw,
};

export function OrdersPanel({ slug, token }: { slug: string; token: string }) {
  const listFn = useServerFn(listMyOrders);
  const cancelFn = useServerFn(cancelMyOrder);
  const qc = useQueryClient();

  const [type, setType] = useState<"all" | OrderType>("all");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [search, setSearch] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function doCancel() {
    if (!cancelId) return;
    setBusy(true);
    try {
      await cancelFn({ data: { storeSlug: slug, token, orderId: cancelId } });
      toast.success("Order cancelled");
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      setCancelId(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not cancel this order");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TYPE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              type === t.key
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order or product"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-xs font-medium capitalize"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All status" : s}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-xs font-medium"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-sm text-neutral-500">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No orders yet."
          hint="Your purchases will appear here."
          action={
            <Link
              to="/store/$slug"
              params={{ slug }}
              className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white"
            >
              Start shopping
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((o) => {
            const t = asOrderType(o.order_type);
            const Icon = TYPE_ICON[t];
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
                          <span className="text-neutral-500"> +{o.extra_items} more</span>
                        )}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${ORDER_TYPE_TONE[t]}`}
                      >
                        {ORDER_TYPE_LABEL[t]}
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
                    View details <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    to="/store/$slug/order/$orderId"
                    params={{ slug, orderId: o.id }}
                    className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700"
                  >
                    <Icon className="h-3.5 w-3.5" /> {ORDER_TYPE_ACTION[t]}
                  </Link>
                  {canCancel(o) && (
                    <button
                      type="button"
                      onClick={() => setCancelId(o.id)}
                      className="ml-auto text-[11px] font-semibold text-rose-600 hover:underline"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Orders can only be cancelled before they are confirmed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); doCancel(); }}>
              {busy ? "Cancelling…" : "Yes, cancel"}
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
  const cancelFn = useServerFn(cancelMyOrder);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!token || !canCancel(order)) return null;

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
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
              onClick={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await cancelFn({ data: { storeSlug: slug, token, orderId: order.id } });
                  toast.success("Order cancelled");
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
