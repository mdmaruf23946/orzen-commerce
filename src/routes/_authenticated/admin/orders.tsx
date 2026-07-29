import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, SlidersHorizontal, RefreshCw, ShoppingBag, TrendingUp, Wallet, Clock } from "lucide-react";
import { listAdminOrders, type AdminOrderRow } from "@/lib/orders-admin.functions";
import { updateOrderStatus } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FraudCheckModal } from "@/components/admin/FraudCheckModal";
import { OrderDetailsDrawer } from "@/components/admin/OrderDetailsDrawer";
import { useFeature } from "@/components/admin/FeatureGate";
import { OrderCard, money } from "@/components/admin/orders/OrderCard";

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
});

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

function OrdersPage() {
  const list = useServerFn(listAdminOrders);
  const update = useServerFn(updateOrderStatus);
  const qc = useQueryClient();
  const { data: orders, isFetching, refetch } = useQuery({
    queryKey: ["admin", "orders", "rich"],
    queryFn: () => list(),
  });

  const [tab, setTab] = useState<TabKey>("all");
  const [q, setQ] = useState("");
  const [payment, setPayment] = useState("all");
  const [courier, setCourier] = useState("all");
  const [range, setRange] = useState("all");
  const [sort, setSort] = useState("new");
  const [fraudFor, setFraudFor] = useState<{ id: string; phone: string } | null>(null);
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const { allowed: fraudAllowed } = useFeature("fraud_checker");

  const rows = useMemo(() => orders ?? [], [orders]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of TABS) c[t.key] = rows.filter((o) => matchesTab(o, t.key)).length;
    return c;
  }, [rows]);

  const summary = useMemo(() => {
    const today = new Date().toDateString();
    const todays = rows.filter((o) => new Date(o.created_at).toDateString() === today);
    return {
      today: todays.length,
      revenue: rows.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0),
      pending: rows.filter((o) => o.status === "pending").length,
      cod: rows.filter((o) => o.status !== "cancelled" && o.status !== "delivered").reduce((s, o) => s + o.cod_amount, 0),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const cutoff =
      range === "today" ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
      : range === "7d" ? Date.now() - 7 * 864e5
      : range === "30d" ? Date.now() - 30 * 864e5
      : 0;
    const out = rows.filter((o) => {
      if (!matchesTab(o, tab)) return false;
      if (cutoff && new Date(o.created_at).getTime() < cutoff) return false;
      if (payment === "cod" && o.payment_method !== "cod") return false;
      if (payment === "paid" && !(o.payment_method !== "cod" && o.payment_status === "paid")) return false;
      if (payment === "unpaid" && o.payment_status === "paid") return false;
      if (courier === "none" && o.courier_key) return false;
      if (courier !== "all" && courier !== "none" && o.courier_key !== courier) return false;
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
  }, [rows, tab, q, payment, courier, range, sort]);

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
        <Button variant="outline" size="sm" onClick={() => refetch()} className="shrink-0 gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi icon={ShoppingBag} label="Today's orders" value={String(summary.today)} />
        <Kpi icon={TrendingUp} label="Order value" value={money(summary.revenue)} />
        <Kpi icon={Clock} label="Pending" value={String(summary.pending)} />
        <Kpi icon={Wallet} label="COD to collect" value={money(summary.cod)} />
      </div>

      {/* Tabs */}
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
            <Field label="Courier">
              <Select value={courier} onChange={setCourier} options={[
                ["all", "All couriers"], ["none", "Not sent"],
                ...courierOptions.map((c) => [c, c.replace(/_/g, " ")] as [string, string]),
              ]} />
            </Field>
            <Field label="Date range">
              <Select value={range} onChange={setRange} options={[
                ["all", "All time"], ["today", "Today"], ["7d", "Last 7 days"], ["30d", "Last 30 days"],
              ]} />
            </Field>
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
          {filtered.map((o) => (
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
          ))}
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
