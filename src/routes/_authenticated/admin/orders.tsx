import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, SlidersHorizontal, RefreshCw, ShoppingBag, TrendingUp, Wallet, Clock, Plus } from "lucide-react";
import { listAdminOrders, type AdminOrderRow } from "@/lib/orders-admin.functions";
import { updateOrderStatus } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FraudCheckModal } from "@/components/admin/FraudCheckModal";
import { OrderDetailsDrawer } from "@/components/admin/OrderDetailsDrawer";
import { useFeature } from "@/components/admin/FeatureGate";
import { OrderCard, money } from "@/components/admin/orders/OrderCard";
import {
  DigitalOrderCard, ServiceOrderCard, SubscriptionOrderCard,
} from "@/components/admin/orders/TypeOrderCards";
import { TypeFilterTabs } from "@/components/admin/page/TypeFilterTabs";
import { useProductTypeScope } from "@/lib/product-type-scope";
import { typeScopeCounts } from "@/lib/admin.functions";
import type { OrderKind } from "@/lib/orders-admin.functions";
import { confirmOrder, scheduleService, completeService, extendSubscription, cancelSubscription } from "@/lib/orders-types.functions";
import { setDigitalAccess, resendDigitalEmail } from "@/lib/digital-admin.functions";
import { QuickOrderSheet } from "@/components/admin/quick-order/QuickOrderSheet";
import { RouteErrorPanel } from "@/components/admin/RouteErrorPanel";
import { useRouteErrorTracking } from "@/hooks/use-error-tracking";
import { recoverFromChunkError } from "@/lib/chunk-recovery";
import { useRouter } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  head: () => ({
    meta: [
      { title: "Orders — ORZEN Store Admin" },
      { name: "description", content: "Manage, track and fulfil every store order from one premium dashboard." },
      { property: "og:title", content: "Orders — ORZEN Store Admin" },
      { property: "og:description", content: "Manage, track and fulfil every store order from one premium dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
  errorComponent: OrdersErrorComponent,
  notFoundComponent: () => (
    <div className="py-16 text-center text-sm text-muted-foreground">Orders not found.</div>
  ),
});

/** Route-level boundary: shows the real error, stack and user context. */
function OrdersErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const [recovering] = useState(() => recoverFromChunkError(error));
  if (recovering) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Updating to the latest version…
      </div>
    );
  }
  return (
    <RouteErrorPanel
      error={error}
      scope="Admin · Orders"
      onRetry={() => {
        router.invalidate();
        reset();
      }}
    />
  );
}

type TabKey =
  | "all" | "pending" | "confirmed" | "processing"
  | "courier" | "in_transit" | "delivered" | "cancelled" | "returned";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "courier", label: "Courier" },
  { key: "in_transit", label: "In Transit" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
  { key: "returned", label: "Returned" },
];

const TYPE_TABS = [
  { key: "all", label: "All" },
  { key: "physical", label: "Physical" },
  { key: "digital", label: "Digital" },
  { key: "service", label: "Service" },
  { key: "subscription", label: "Subscription" },
] as const;
type TypeKey = (typeof TYPE_TABS)[number]["key"];

/** Status pills per product type. Physical keeps its original set. */
const TYPE_STATUS_TABS: Record<Exclude<TypeKey, "all" | "physical">, { key: string; label: string }[]> = {
  digital: [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "confirmed", label: "Confirmed" },
    { key: "delivered", label: "Access Granted" },
    { key: "cancelled", label: "Refunded" },
  ],
  service: [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "confirmed", label: "Confirmed" },
    { key: "scheduled", label: "Scheduled" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ],
  subscription: [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "confirmed", label: "Confirmed" },
    { key: "active", label: "Active" },
    { key: "expired", label: "Expired" },
    { key: "cancelled", label: "Cancelled" },
  ],
};

function matchesTypeTab(o: AdminOrderRow, type: Exclude<TypeKey, "all" | "physical">, key: string) {
  const f = o.fulfillment ?? {};
  if (key === "all") return true;
  if (key === "pending") return o.confirmation_status !== "confirmed" && o.status !== "cancelled";
  if (key === "confirmed") return o.confirmation_status === "confirmed";
  if (key === "cancelled") return o.status === "cancelled" || f.subscription_state === "cancelled";
  if (type === "digital") return key === "delivered" ? o.access?.status === "active" : true;
  if (type === "service") return f.service_state === key;
  if (type === "subscription") {
    if (key === "active") return f.subscription_state === "active" && (!f.renewal_at || new Date(f.renewal_at) > new Date());
    if (key === "expired") return !!f.renewal_at && new Date(f.renewal_at) <= new Date();
  }
  return true;
}

const COURIER_SENT = new Set(["pending", "pickup_requested", "pickup_completed"]);

function matchesTab(o: AdminOrderRow, tab: TabKey) {
  const p = o.parcel?.status;
  switch (tab) {
    case "all": return true;
    case "courier": return !!p && COURIER_SENT.has(p);
    case "in_transit": return p === "in_transit";
    case "returned": return p === "returned" || p === "partial_delivered";
    case "delivered": return o.status === "delivered" || p === "delivered";
    case "cancelled": return o.status === "cancelled" || p === "cancelled";
    default: return o.status === tab;
  }
}

/** Plan label for a subscription order (used by the Subscription tab filters). */
function subPlanName(o: AdminOrderRow): string {
  return (o.fulfillment as any)?.plan_name ?? o.items?.[0]?.name ?? "";
}

function OrdersPage() {
  useRouteErrorTracking("Admin · Orders");

  const list = useServerFn(listAdminOrders);
  const update = useServerFn(updateOrderStatus);
  const qc = useQueryClient();
  const [quickOpen, setQuickOpen] = useState(false);
  const { scope, setScope, filter } = useProductTypeScope();
  const countsFn = useServerFn(typeScopeCounts);
  const { data: orders, isFetching, refetch, error: ordersError } = useQuery({
    queryKey: ["admin", "orders", "rich", filter ?? "all"],
    queryFn: () => list({ data: { product_type: filter } } as any),
    retry: 1,
  });
  const { data: orderTypeCounts, error: countsError } = useQuery({
    queryKey: ["admin", "counts", "orders"],
    queryFn: () => countsFn({ data: { entity: "orders" } }),
    retry: 1,
  });
  const dataError = ordersError ?? countsError;

  const type = scope as TypeKey;
  const [tab, setTab] = useState<TabKey>("all");
  const [typeTab, setTypeTab] = useState("all");
  const [q, setQ] = useState("");
  const [payment, setPayment] = useState("all");
  const [courier, setCourier] = useState("all");
  const [range, setRange] = useState("all");
  const [subPlan, setSubPlan] = useState("all");
  const [subCustomer, setSubCustomer] = useState("all");
  const [renewFrom, setRenewFrom] = useState("");
  const [renewTo, setRenewTo] = useState("");
  const [sort, setSort] = useState("new");

  const [fraudFor, setFraudFor] = useState<{ id: string; phone: string } | null>(null);
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const { allowed: fraudAllowed } = useFeature("fraud_checker");

  const confirm = useServerFn(confirmOrder);
  const schedule = useServerFn(scheduleService);
  const complete = useServerFn(completeService);
  const extend = useServerFn(extendSubscription);
  const cancelSub = useServerFn(cancelSubscription);
  const grantAccess = useServerFn(setDigitalAccess);
  const resendMail = useServerFn(resendDigitalEmail);

  const all = useMemo(() => orders ?? [], [orders]);
  const rows = useMemo(
    () => (type === "all" ? all : all.filter((o) => (o.order_type ?? "physical") === type)),
    [all, type],
  );
  const physicalView = type === "all" || type === "physical";

  const typeCounts: Record<string, number> = orderTypeCounts ?? { all: all.length };

  async function run(fn: () => Promise<any>, msg: string) {
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast.success(msg);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of TABS) c[t.key] = rows.filter((o) => matchesTab(o, t.key)).length;
    return c;
  }, [rows]);

  const summary = useMemo(() => {
    const today = new Date().toDateString();
    const todays = rows.filter((o) => new Date(o.created_at).toDateString() === today);
    const revenue = rows.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
    return {
      today: todays.length,
      revenue,
      pending: rows.filter((o) =>
        physicalView ? o.status === "pending" : o.confirmation_status !== "confirmed",
      ).length,
      cod: rows.filter((o) => o.status !== "cancelled" && o.status !== "delivered").reduce((s, o) => s + o.cod_amount, 0),
      accessGranted: rows.filter((o) => o.access?.status === "active").length,
      downloads: rows.reduce((s, o) => s + (o.access?.downloads ?? 0), 0),
      scheduled: rows.filter((o) => o.fulfillment?.service_state === "scheduled").length,
      completed: rows.filter((o) => o.fulfillment?.service_state === "completed").length,
      activeSubs: rows.filter((o) => o.fulfillment?.subscription_state === "active").length,
      dueSoon: rows.filter((o) => {
        const r = o.fulfillment?.renewal_at;
        return !!r && new Date(r).getTime() - Date.now() < 7 * 864e5 && new Date(r) > new Date();
      }).length,
    };
  }, [rows, physicalView]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const cutoff =
      range === "today" ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
      : range === "7d" ? Date.now() - 7 * 864e5
      : range === "30d" ? Date.now() - 30 * 864e5
      : 0;
    const out = rows.filter((o) => {
      if (physicalView ? !matchesTab(o, tab) : !matchesTypeTab(o, type as any, typeTab)) return false;
      if (cutoff && new Date(o.created_at).getTime() < cutoff) return false;
      if (payment === "cod" && o.payment_method !== "cod") return false;
      if (payment === "paid" && !(o.payment_method !== "cod" && o.payment_status === "paid")) return false;
      if (payment === "unpaid" && o.payment_status === "paid") return false;
      if (courier === "none" && o.courier_key) return false;
      if (courier !== "all" && courier !== "none" && o.courier_key !== courier) return false;
      if (type === "subscription") {
        if (subPlan !== "all" && subPlanName(o) !== subPlan) return false;
        if (subCustomer !== "all" && o.customer_name !== subCustomer) return false;
        const r = o.fulfillment?.renewal_at ? new Date(o.fulfillment.renewal_at).getTime() : null;
        if (renewFrom && (!r || r < new Date(renewFrom).getTime())) return false;
        if (renewTo && (!r || r > new Date(renewTo).getTime() + 864e5 - 1)) return false;
      }
      if (term) {
        const hay = `${o.customer_name} ${o.phone} ${o.invoice_no ?? ""} ${o.id} ${o.items.map((i) => i.name).join(" ")}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    out.sort((a, b) =>
      sort === "old" ? +new Date(a.created_at) - +new Date(b.created_at)
      : sort === "high" ? b.total - a.total
      : sort === "low" ? a.total - b.total
      : +new Date(b.created_at) - +new Date(a.created_at),
    );
    return out;
  }, [rows, tab, typeTab, type, physicalView, q, payment, courier, range, sort, subPlan, subCustomer, renewFrom, renewTo]);

  const planOptions = useMemo(
    () => Array.from(new Set(rows.map(subPlanName).filter(Boolean))) as string[],
    [rows],
  );
  const customerOptions = useMemo(
    () => Array.from(new Set(rows.map((o) => o.customer_name).filter(Boolean))) as string[],
    [rows],
  );


  const courierOptions = useMemo(
    () => Array.from(new Set(rows.map((o) => o.courier_key).filter(Boolean))) as string[],
    [rows],
  );

  async function setStatus(id: string, status: string) {
    try {
      const result: any = await update({ data: { id, status: status as any } });
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      if (result?.messenger?.failed) toast.warning(result.messenger.error || "Order updated, Messenger message pending.");
      else if (result?.messenger?.sent) toast.success("Updated and Messenger notified");
      else toast.success("Updated");
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Orders</h1>
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {rows.length} orders
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setQuickOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Create order
          </Button>
        </div>
      </header>

      <QuickOrderSheet open={quickOpen} onOpenChange={setQuickOpen} />

      {/* Summary */}
      <TypeFilterTabs
        tabs={TYPE_TABS.map((t) => ({
          key: t.key,
          label: `${t.label} (${typeCounts[t.key] ?? 0})`,
        }))}
        value={type}
        onChange={(k) => { setScope(k as any); setTab("all"); setTypeTab("all"); }}
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi icon={ShoppingBag} label="Today's orders" value={String(summary.today)} />
        <Kpi icon={TrendingUp} label="Order value" value={money(summary.revenue)} />
        <Kpi icon={Clock} label="Pending" value={String(summary.pending)} />
        {type === "digital" ? (
          <Kpi icon={Wallet} label="Downloads" value={String(summary.downloads)} />
        ) : type === "service" ? (
          <Kpi icon={Wallet} label="Completed" value={String(summary.completed)} />
        ) : type === "subscription" ? (
          <Kpi icon={Wallet} label="Active subs" value={String(summary.activeSubs)} />
        ) : (
          <Kpi icon={Wallet} label="COD to collect" value={money(summary.cod)} />
        )}
      </div>

      {/* Status tabs */}
      {!physicalView ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {TYPE_STATUS_TABS[type as Exclude<TypeKey, "all" | "physical">].map((t) => (
            <button
              key={t.key}
              onClick={() => setTypeTab(t.key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                typeTab === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
              }`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-[10px] ${typeTab === t.key ? "bg-primary-foreground/20" : "bg-muted"}`}>
                {rows.filter((o) => matchesTypeTab(o, type as any, t.key)).length}
              </span>
            </button>
          ))}
        </div>
      ) : (
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
              tab === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 text-[10px] ${tab === t.key ? "bg-primary-foreground/20" : "bg-muted"}`}>
              {counts[t.key] ?? 0}
            </span>
          </button>
        ))}
      </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search invoice, name, phone or product"
            className="pl-8"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="shrink-0 gap-1.5">
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3">
            <Field label="Payment">
              <Select value={payment} onChange={setPayment} options={[
                ["all", "All payments"], ["cod", "COD"], ["paid", "Online paid"], ["unpaid", "Unpaid"],
              ]} />
            </Field>
            {physicalView && (
            <Field label="Courier">
              <Select value={courier} onChange={setCourier} options={[
                ["all", "All couriers"], ["none", "Not sent"],
                ...courierOptions.map((c) => [c, c.replace(/_/g, " ")] as [string, string]),
              ]} />
            </Field>
            )}
            <Field label="Date range">
              <Select value={range} onChange={setRange} options={[
                ["all", "All time"], ["today", "Today"], ["7d", "Last 7 days"], ["30d", "Last 30 days"],
              ]} />
            </Field>
            {type === "subscription" && (
              <>
                <Field label="Plan">
                  <Select value={subPlan} onChange={setSubPlan} options={[
                    ["all", "All plans"],
                    ...planOptions.map((p) => [p, p] as [string, string]),
                  ]} />
                </Field>
                <Field label="Customer">
                  <Select value={subCustomer} onChange={setSubCustomer} options={[
                    ["all", "All customers"],
                    ...customerOptions.map((c) => [c, c] as [string, string]),
                  ]} />
                </Field>
                <Field label="Renews from">
                  <input
                    type="date"
                    value={renewFrom}
                    onChange={(e) => setRenewFrom(e.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  />
                </Field>
                <Field label="Renews to">
                  <input
                    type="date"
                    value={renewTo}
                    onChange={(e) => setRenewTo(e.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  />
                </Field>
              </>
            )}
            <Field label="Sort">
              <Select value={sort} onChange={setSort} options={[
                ["new", "Newest first"], ["old", "Oldest first"], ["high", "Highest value"], ["low", "Lowest value"],
              ]} />
            </Field>

          </PopoverContent>
        </Popover>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 p-12 text-center">
          <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No orders here</p>
          <p className="text-xs text-muted-foreground">Try a different tab or clear your filters.</p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {filtered.map((o) => {
            const kind: OrderKind = o.order_type ?? "physical";
            const actions = {
              onView: () => setDetailsFor(o.id),
              onConfirm: () => run(() => confirm({ data: { orderId: o.id } }), "Order confirmed"),
              onGrantAccess: () =>
                o.access?.entitlementId
                  ? run(
                      () => grantAccess({ data: { entitlementId: o.access!.entitlementId!, enabled: true } }),
                      "Access granted",
                    )
                  : run(() => confirm({ data: { orderId: o.id } }), "Access granted"),
              onResendEmail: () => run(() => resendMail({ data: { orderId: o.id } }), "Email sent"),
              onRefund: () => setStatus(o.id, "cancelled"),
              onSchedule: () => {
                const date = window.prompt("Booking date (YYYY-MM-DD)", o.fulfillment?.booking_date ?? "");
                if (date === null) return;
                const time = window.prompt("Booking time (e.g. 15:30)", o.fulfillment?.booking_time ?? "") ?? "";
                run(() => schedule({ data: { orderId: o.id, booking_date: date, booking_time: time } }), "Service scheduled");
              },
              onComplete: () => run(() => complete({ data: { orderId: o.id } }), "Service completed"),
              onExtend: () => {
                const days = Number(window.prompt("Extend by how many days?", "30"));
                if (!days || days < 1) return;
                run(() => extend({ data: { orderId: o.id, days } }), "Subscription extended");
              },
              onCancel: () => run(() => cancelSub({ data: { orderId: o.id } }), "Subscription cancelled"),
            };
            if (kind === "digital") return <DigitalOrderCard key={o.id} order={o} a={actions} />;
            if (kind === "service") return <ServiceOrderCard key={o.id} order={o} a={actions} />;
            if (kind === "subscription") return <SubscriptionOrderCard key={o.id} order={o} a={actions} />;
            return (
              <OrderCard
                key={o.id}
                order={o}
                onView={() => setDetailsFor(o.id)}
                onStatus={(s) => setStatus(o.id, s)}
                onFraud={() =>
                  fraudAllowed
                    ? setFraudFor({ id: o.id, phone: o.phone })
                    : toast.error("Upgrade your plan to use Fraud Checker")
                }
              />
            );
          })}
        </div>
      )}

      {fraudFor && (
        <FraudCheckModal
          open={!!fraudFor}
          onOpenChange={(v) => !v && setFraudFor(null)}
          phone={fraudFor.phone}
          orderId={fraudFor.id}
        />
      )}
      {detailsFor && (
        <OrderDetailsDrawer
          open={!!detailsFor}
          onOpenChange={(v) => !v && setDetailsFor(null)}
          orderId={detailsFor}
        />
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate text-lg font-bold">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium uppercase text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border bg-background px-2 text-xs capitalize"
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
