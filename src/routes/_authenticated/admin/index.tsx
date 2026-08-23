import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  TrendingUp, ShoppingBag, Users, Clock, ArrowUpRight, ArrowDownRight,
  Package, PackageCheck, PackageX, AlertTriangle,
  CheckCircle2, Truck, Ban, RotateCcw, Loader2, PackageOpen,
  Plus, Share2, ExternalLink, Bell, Star, Sparkles, Bot, MessageSquare,
  Ticket, Image as ImageIcon,
} from "lucide-react";
import { myDashboardOverview } from "@/lib/admin.functions";
import { getInboxStats } from "@/lib/messenger-inbox.functions";
import { AdSlot } from "@/components/admin/AdSlot";
import { WelcomeCard } from "@/components/admin/dashboard/WelcomeCard";
import { cn } from "@/lib/utils";
import { QuickOrderSheet } from "@/components/admin/quick-order/QuickOrderSheet";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ORZEN Store Admin" },
      { name: "description", content: "Your store overview: orders, revenue and quick actions." },
      { property: "og:title", content: "Dashboard — ORZEN Store Admin" },
      { property: "og:description", content: "Your store overview: orders, revenue and quick actions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

type Range = "today" | "7d" | "30d" | "month";
type Metric = "sales" | "orders" | "revenue";
type Point = { date: string; sales: number; orders: number; revenue: number };

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] md:p-6", className)}>
      {children}
    </section>
  );
}

function fmtBDT(n: number) {
  return `৳${(n || 0).toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;
}
function relTime(iso?: string | null) {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Dashboard() {
  const overviewFn = useServerFn(myDashboardOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => overviewFn(),
    staleTime: 30_000,
  });

  const inboxStatsFn = useServerFn(getInboxStats);
  const { data: inboxStats } = useQuery({
    queryKey: ["admin", "inbox-stats"],
    queryFn: () => inboxStatsFn(),
    refetchInterval: 30_000,
  });

  const [range, setRange] = useState<Range>("7d");
  const [metric, setMetric] = useState<Metric>("sales");

  const storeUrl = useMemo(() => {
    if (!data?.store) return "";
    if (typeof window === "undefined") return `/store/${data.store.slug}`;
    return `${window.location.origin}/store/${data.store.slug}`;
  }, [data?.store]);

  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const shareStore = async () => {
    if (!storeUrl) return;
    try { await navigator.clipboard.writeText(storeUrl); toast.success("Store link copied"); }
    catch { toast.error("Copy failed"); }
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-40 animate-pulse rounded-2xl border bg-muted/40" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl border bg-muted/40" />)}
        </div>
        <div className="h-72 animate-pulse rounded-2xl border bg-muted/40" />
      </div>
    );
  }

  const store = data.store;
  const series: Point[] = (data.series as any)[range] ?? [];

  return (
    <div className="space-y-6">
      {/* 1. Welcome Card (premium AI overview) */}
      <WelcomeCard
        ownerName={data.owner.name}
        store={store ? {
          slug: store.slug,
          status: store.status,
          package_name: (store as any).package_name ?? null,
          updated_at: store.updated_at,
        } : null}
        storeUrl={storeUrl}
        onCopy={shareStore}
        today={{
          sales: data.today.sales,
          orders: data.today.orders,
          salesPct: data.today.salesPct,
          ordersPct: data.today.ordersPct,
          pendingOrders: data.today.pendingOrders,
        }}
        products={{
          total: data.products?.total ?? 0,
          lowStock: data.products?.lowStock ?? 0,
          outOfStock: data.products?.outOfStock ?? 0,
        }}
        inbox={inboxStats}
        lowStockSample={(() => {
          const n = (data.notifications ?? []).find((x: any) => x.type === "low-stock");
          if (!n) return null;
          const m = /e\.g\.\s+(.+?)\s+·\s+(\d+)\s+left/.exec(n.detail ?? "");
          return m ? { name: m[1], stock: Number(m[2]) } : null;
        })()}
        updatedRel={relTime(store?.updated_at)}
      />


      {/* 2. KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Today's Sales" value={fmtBDT(data.today.sales)}
          trend={data.today.salesPct} trendLabel="vs Yesterday" tone="emerald"
          spark={series.map((p) => p.sales)} />
        <StatCard icon={ShoppingBag} label="Today's Orders" value={data.today.orders}
          trend={data.today.ordersPct} trendLabel="vs Yesterday" tone="blue"
          spark={series.map((p) => p.orders)} />
        <StatCard icon={Users} label="Visitors"
          value={data.visitorsAvailable ? data.today.visitors : "—"}
          trend={null} trendLabel="tracking soon" tone="violet"
          spark={series.map((p) => p.sales / 10)} />
        <StatCard icon={Clock} label="Pending Orders" value={data.today.pendingOrders}
          trend={null} trendLabel="need action" tone="amber"
          spark={series.map((p) => p.orders)} />
      </div>

      {/* 3. Order Status Strip */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Order Status</h2>
          <Link to="/admin/orders" className="text-xs font-medium text-primary hover:underline">View all →</Link>
        </div>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
          <StatusMini icon={Clock} label="Pending" count={data.orderStatus.pending} tone="amber" />
          <StatusMini icon={CheckCircle2} label="Confirmed" count={data.orderStatus.confirmed} tone="blue" />
          <StatusMini icon={PackageOpen} label="Processing" count={data.orderStatus.processing} tone="indigo" />
          <StatusMini icon={Truck} label="Delivered" count={data.orderStatus.delivered} tone="emerald" />
          <StatusMini icon={Ban} label="Cancelled" count={data.orderStatus.cancelled} tone="red" />
          <StatusMini icon={RotateCcw} label="Returned" count={data.orderStatus.returned} tone="slate" />
        </div>
      </Card>

      {/* 4. Sales Analytics + Store Performance */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Sales Analytics</h2>
              <p className="text-xs text-muted-foreground">Track your store's momentum</p>
            </div>
            <Segmented value={range} onChange={setRange} options={[
              { v: "today", l: "Today" }, { v: "7d", l: "7 Days" },
              { v: "30d", l: "30 Days" }, { v: "month", l: "Month" },
            ]} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(["sales", "orders", "revenue"] as Metric[]).map((m) => (
              <button key={m}
                onClick={() => setMetric(m)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs capitalize transition",
                  metric === m ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >{m}</button>
            ))}
          </div>
          <div className="mt-4">
            <LineChart data={series} metric={metric} />
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 text-base font-semibold tracking-tight">Store Health</h2>
          <p className="mb-4 text-xs text-muted-foreground">Performance snapshot</p>
          <div className="grid grid-cols-3 gap-3">
            <Ring label="Conversion" value={data.performance.conversionRate} suffix="%" max={100} />
            <Ring label="Health" value={data.performance.healthScore} suffix="" max={100} />
            <Ring
              label="Rating"
              value={data.performance.customerRating ?? 0}
              suffix=""
              max={5}
              display={data.performance.customerRating ? `${data.performance.customerRating}` : "—"}
              icon={<Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
            />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniStat icon={Package} label="Products" value={data.products.total} tone="text-slate-700" />
            <MiniStat icon={PackageCheck} label="Active" value={data.products.active} tone="text-emerald-600" />
            <MiniStat icon={AlertTriangle} label="Low Stock" value={data.products.lowStock} tone="text-amber-600" />
            <MiniStat icon={PackageX} label="Out" value={data.products.outOfStock} tone="text-red-600" />
          </div>
        </Card>
      </div>

      {/* 5. Recent Orders + Messenger + Notifications */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Recent Orders</h2>
            <Link to="/admin/orders" className="text-xs font-medium text-primary hover:underline">
              View all orders →
            </Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No orders yet</p>
          ) : (
            <div className="overflow-hidden">
              <table className="hidden w-full text-sm md:table">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2.5 pr-3 font-medium">Customer</th>
                    <th className="py-2.5 pr-3 font-medium">Order ID</th>
                    <th className="py-2.5 pr-3 font-medium">Amount</th>
                    <th className="py-2.5 pr-3 font-medium">Status</th>
                    <th className="py-2.5 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentOrders.map((o: any) => (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-3 pr-3 font-medium">{o.customer_name}</td>
                      <td className="py-3 pr-3 text-muted-foreground">#{o.order_number}</td>
                      <td className="py-3 pr-3 font-semibold">{fmtBDT(o.subtotal)}</td>
                      <td className="py-3 pr-3"><OrderStatusPill status={o.status} /></td>
                      <td className="py-3 text-muted-foreground">{relTime(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="space-y-3 md:hidden">
                {data.recentOrders.map((o: any) => (
                  <li key={o.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{o.customer_name}</p>
                        <p className="text-xs text-muted-foreground">#{o.order_number} · {relTime(o.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{fmtBDT(o.subtotal)}</p>
                        <OrderStatusPill status={o.status} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <InboxTile />
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold tracking-tight">Notifications</h2>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
            {data.notifications.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">You're all caught up 🎉</p>
            ) : (
              <ul className="space-y-2.5">
                {data.notifications.slice(0, 4).map((n: any, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    <NotifIcon type={n.type} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{n.detail}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{relTime(n.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <QuickOrderSheet open={quickOrderOpen} onOpenChange={setQuickOrderOpen} />

      {/* 6. Quick Actions */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <QuickAction onClick={() => setQuickOrderOpen(true)} icon={ShoppingBag} label="Create Order" tone="text-primary bg-primary/10" />
          <QuickAction to="/admin/products" icon={Plus} label="Add Product" tone="text-primary bg-primary/10" />
          <QuickAction to="/admin/coupons" icon={Ticket} label="Create Coupon" tone="text-emerald-600 bg-emerald-50" />
          <QuickAction to="/admin/banners" icon={ImageIcon} label="Create Banner" tone="text-violet-600 bg-violet-50" />
          <QuickAction to="/admin/orders" icon={ShoppingBag} label="View Orders" tone="text-blue-600 bg-blue-50" />
          <QuickAction to="/admin/messenger-inbox" icon={MessageSquare} label="Messenger Inbox" tone="text-amber-600 bg-amber-50" />
          <QuickAction onClick={shareStore} icon={Share2} label="Share Store" tone="text-slate-700 bg-slate-100" />
        </div>
      </Card>

      <AdSlot slotKey="admin_dashboard_bottom" />
    </div>
  );
}

/* ---------------- sub components ---------------- */

function StatusPill({ status, sub }: { status: string; sub?: string }) {
  const isActive = status === "active" && (!sub || sub === "active" || sub === "trialing");
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium",
      isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", isActive ? "bg-emerald-500" : "bg-amber-500")} />
      {isActive ? "Active Store" : (sub || status)}
    </span>
  );
}

const toneMap: Record<string, { bg: string; text: string; icon: string }> = {
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", icon: "text-emerald-600 bg-emerald-100" },
  blue:    { bg: "bg-blue-50",    text: "text-blue-600",    icon: "text-blue-600 bg-blue-100" },
  violet:  { bg: "bg-violet-50",  text: "text-violet-600",  icon: "text-violet-600 bg-violet-100" },
  amber:   { bg: "bg-amber-50",   text: "text-amber-600",   icon: "text-amber-600 bg-amber-100" },
  indigo:  { bg: "bg-indigo-50",  text: "text-indigo-600",  icon: "text-indigo-600 bg-indigo-100" },
  red:     { bg: "bg-red-50",     text: "text-red-600",     icon: "text-red-600 bg-red-100" },
  slate:   { bg: "bg-slate-100",  text: "text-slate-700",   icon: "text-slate-700 bg-slate-200" },
};

function StatCard({
  icon: Icon, label, value, trend, trendLabel, tone, spark,
}: {
  icon: any; label: string; value: React.ReactNode;
  trend: number | null; trendLabel: string; tone: keyof typeof toneMap;
  spark?: number[];
}) {
  const up = trend !== null && trend >= 0;
  const t = toneMap[tone];
  return (
    <div className="group rounded-2xl border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("grid h-9 w-9 place-items-center rounded-xl", t.icon)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight md:text-[26px]">{value}</div>
      <div className="mt-1.5 flex items-center gap-1 text-xs">
        {trend !== null ? (
          <>
            <span className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
              up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
            )}>
              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(trend)}%
            </span>
            <span className="text-muted-foreground">{trendLabel}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{trendLabel}</span>
        )}
      </div>
      {spark && spark.length > 1 && (
        <div className={cn("mt-3 h-8 w-full", t.text)}>
          <MiniSpark values={spark} />
        </div>
      )}
    </div>
  );
}

function MiniSpark({ values }: { values: number[] }) {
  const w = 100, h = 28;
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = Math.max(1, max - min);
  const stepX = values.length > 1 ? w / (values.length - 1) : 0;
  const pts = values.map((v, i) => ({ x: i * stepX, y: h - ((v - min) / range) * h }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
      <path d={area} fill="currentColor" opacity="0.12" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Segmented<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <div className="inline-flex rounded-full border bg-muted/40 p-0.5 text-xs">
      {options.map((o) => (
        <button key={o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "rounded-full px-3 py-1 transition",
            value === o.v ? "bg-background shadow-sm font-medium" : "text-muted-foreground",
          )}
        >{o.l}</button>
      ))}
    </div>
  );
}

function LineChart({ data, metric }: { data: Point[]; metric: Metric }) {
  const w = 720, h = 220, pad = 32;
  if (data.length === 0) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">No data for this range</div>;
  }
  const vals = data.map((d) => d[metric]);
  const max = Math.max(1, ...vals);
  const stepX = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const pts = data.map((d, i) => ({
    x: pad + i * stepX,
    y: h - pad - (d[metric] / max) * (h - pad * 2),
    d,
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${path} L${pts[pts.length - 1].x},${h - pad} L${pts[0].x},${h - pad} Z`;
  const gridY = 4;

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chart-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: gridY + 1 }).map((_, i) => {
          const y = pad + (i * (h - pad * 2)) / gridY;
          return <line key={i} x1={pad} x2={w - pad} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.06" />;
        })}
        <path d={area} fill="url(#chart-grad)" className="text-primary" />
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" className="fill-background stroke-primary" strokeWidth="2">
            <title>{`${p.d.date}: ${metric === "sales" || metric === "revenue" ? fmtBDT(p.d[metric]) : p.d[metric]}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        {data.length <= 8 ? data.map((d) => <span key={d.date}>{d.date.slice(5)}</span>) : (
          <>
            <span>{data[0].date.slice(5)}</span>
            <span>{data[Math.floor(data.length / 2)].date.slice(5)}</span>
            <span>{data[data.length - 1].date.slice(5)}</span>
          </>
        )}
      </div>
    </div>
  );
}

function StatusMini({ icon: Icon, label, count, tone }: { icon: any; label: string; count: number; tone: keyof typeof toneMap }) {
  const t = toneMap[tone];
  return (
    <Link
      to="/admin/orders"
      className={cn("group rounded-xl border p-3 transition hover:-translate-y-0.5 hover:shadow-md", t.bg)}
    >
      <div className={cn("flex items-center justify-between", t.text)}>
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium opacity-70">{label}</span>
      </div>
      <div className={cn("mt-2 text-2xl font-bold", t.text)}>{count}</div>
    </Link>
  );
}

function MiniStat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4", tone)} />
      </div>
      <div className={cn("mt-1.5 text-xl font-bold", tone)}>{value}</div>
    </div>
  );
}

function Ring({ label, value, max, suffix = "%", display, icon }: { label: string; value: number; max: number; suffix?: string; display?: string; icon?: React.ReactNode }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const size = 72, stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} stroke="currentColor" strokeOpacity="0.1" strokeWidth={stroke} fill="none" />
          <circle cx={size/2} cy={size/2} r={r} stroke="currentColor" strokeWidth={stroke} fill="none"
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" className="text-primary transition-all" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center gap-0.5 text-sm font-bold">
          {icon}
          {display ?? `${Math.round(value)}${suffix}`}
        </div>
      </div>
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

function OrderStatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    confirmed: "bg-blue-50 text-blue-700 border-blue-200",
    processing: "bg-indigo-50 text-indigo-700 border-indigo-200",
    delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
    returned: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize", map[status] ?? "bg-muted")}>
      {status}
    </span>
  );
}

function NotifIcon({ type }: { type: string }) {
  const cls = "grid h-9 w-9 shrink-0 place-items-center rounded-xl";
  if (type === "order") return <span className={cn(cls, "bg-blue-50 text-blue-600")}><ShoppingBag className="h-4 w-4" /></span>;
  if (type === "low-stock") return <span className={cn(cls, "bg-amber-50 text-amber-600")}><AlertTriangle className="h-4 w-4" /></span>;
  if (type === "subscription") return <span className={cn(cls, "bg-red-50 text-red-600")}><Clock className="h-4 w-4" /></span>;
  return <span className={cn(cls, "bg-muted text-foreground")}><Bell className="h-4 w-4" /></span>;
}

function QuickAction({
  to, href, onClick, external, icon: Icon, label, tone,
}: {
  to?: string; href?: string; onClick?: () => void; external?: boolean;
  icon: any; label: string; tone?: string;
}) {
  const inner = (
    <>
      <span className={cn("grid h-11 w-11 place-items-center rounded-xl", tone ?? "bg-primary/10 text-primary")}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-medium leading-tight">{label}</span>
    </>
  );
  const cls = "flex flex-col items-start gap-2.5 rounded-2xl border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md";
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  if (href) return <a href={href} target={external ? "_blank" : undefined} rel="noreferrer" className={cls}>{inner}</a>;
  return <button type="button" onClick={onClick} className={cn(cls, "text-left")}>{inner}</button>;
}

function InboxTile() {
  const statsFn = useServerFn(getInboxStats);
  const { data } = useQuery({
    queryKey: ["admin", "inbox-stats"],
    queryFn: () => statsFn(),
    refetchInterval: 30_000,
  });
  const items: { label: string; value: number; tone: string }[] = [
    { label: "Unread", value: data?.unread ?? 0, tone: "text-blue-600" },
    { label: "AI", value: data?.ai_replied ?? 0, tone: "text-violet-600" },
    { label: "Human", value: data?.human_replied ?? 0, tone: "text-amber-600" },
    { label: "Failed", value: data?.failed ?? 0, tone: "text-red-600" },
  ];
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-50 text-violet-600">
            <Bot className="h-4 w-4" />
          </span>
          <h2 className="text-base font-semibold tracking-tight">Messenger</h2>
        </div>
        <Link to="/admin/messenger-inbox" className="text-xs font-medium text-primary hover:underline">
          Open Inbox →
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {items.map((i) => (
          <div key={i.label} className="rounded-xl border bg-muted/20 p-2.5 text-center">
            <div className={cn("text-lg font-bold", i.tone)}>{i.value}</div>
            <div className="text-[10px] text-muted-foreground">{i.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
