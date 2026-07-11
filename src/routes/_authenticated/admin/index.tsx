import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  TrendingUp, ShoppingBag, Users, Clock, ArrowUpRight, ArrowDownRight,
  Package, PackageCheck, PackageX, AlertTriangle,
  CheckCircle2, Truck, Ban, RotateCcw, Loader2,
  Plus, Share2, ExternalLink, Bell, Star,
} from "lucide-react";
import { myDashboardOverview } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

type Range = "today" | "7d" | "30d" | "month";
type Metric = "sales" | "orders" | "revenue";
type Point = { date: string; sales: number; orders: number; revenue: number };

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-[18px] border bg-background p-5 shadow-sm md:p-6", className)}>
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

  const [range, setRange] = useState<Range>("7d");
  const [metric, setMetric] = useState<Metric>("sales");

  const storeUrl = useMemo(() => {
    if (!data?.store) return "";
    if (typeof window === "undefined") return `/store/${data.store.slug}`;
    return `${window.location.origin}/store/${data.store.slug}`;
  }, [data?.store]);

  const shareStore = async () => {
    if (!storeUrl) return;
    try {
      await navigator.clipboard.writeText(storeUrl);
      toast.success("Store link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-[18px] border bg-muted/40" />
        ))}
      </div>
    );
  }

  const store = data.store;
  const series: Point[] = (data.series as any)[range] ?? [];

  return (
    <div className="space-y-6">
      {/* 1. Welcome Header */}
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              Welcome back, {data.owner.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <StatusPill status={store?.status ?? "active"} sub={store?.subscription_status} />
              {store?.package_name && (
                <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium">
                  {store.package_name}
                </span>
              )}
              {store && (
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full border px-2.5 py-1 text-muted-foreground hover:text-foreground"
                >
                  /store/{store.slug}
                </a>
              )}
              <span className="text-muted-foreground">
                Updated {relTime(store?.updated_at)}
              </span>
            </div>
          </div>
          {store && (
            <a
              href={storeUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
            >
              Open Store <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </Card>

      {/* 2. Business Overview */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Today's Sales" value={fmtBDT(data.today.sales)}
          trend={data.today.salesPct} trendLabel="vs Yesterday" tone="text-emerald-600 bg-emerald-50" />
        <StatCard icon={ShoppingBag} label="Today's Orders" value={data.today.orders}
          trend={data.today.ordersPct} trendLabel="vs Yesterday" tone="text-blue-600 bg-blue-50" />
        <StatCard icon={Users} label="Today's Visitors"
          value={data.visitorsAvailable ? data.today.visitors : "—"}
          trend={null} trendLabel="analytics coming soon" tone="text-purple-600 bg-purple-50" />
        <StatCard icon={Clock} label="Pending Orders" value={data.today.pendingOrders}
          trend={null} trendLabel="need action" tone="text-amber-600 bg-amber-50" />
      </div>

      {/* 3. Sales Analytics */}
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Sales Analytics</h2>
            <p className="text-xs text-muted-foreground">Track your store's momentum over time</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented value={range} onChange={setRange} options={[
              { v: "today", l: "Today" }, { v: "7d", l: "7 Days" },
              { v: "30d", l: "30 Days" }, { v: "month", l: "This Month" },
            ]} />
          </div>
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

      {/* 4. Order Status */}
      <Card>
        <h2 className="mb-4 text-base font-semibold tracking-tight">Order Status</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatusMini icon={Clock} label="Pending" count={data.orderStatus.pending} tone="text-amber-700 bg-amber-50 border-amber-100" />
          <StatusMini icon={CheckCircle2} label="Confirmed" count={data.orderStatus.confirmed} tone="text-blue-700 bg-blue-50 border-blue-100" />
          <StatusMini icon={Loader2} label="Processing" count={data.orderStatus.processing} tone="text-indigo-700 bg-indigo-50 border-indigo-100" />
          <StatusMini icon={Truck} label="Delivered" count={data.orderStatus.delivered} tone="text-emerald-700 bg-emerald-50 border-emerald-100" />
          <StatusMini icon={Ban} label="Cancelled" count={data.orderStatus.cancelled} tone="text-red-700 bg-red-50 border-red-100" />
          <StatusMini icon={RotateCcw} label="Returned" count={data.orderStatus.returned} tone="text-slate-700 bg-slate-50 border-slate-100" />
        </div>
      </Card>

      {/* 5 + 6 side-by-side on lg */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 5. Product Summary */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Product Summary</h2>
            <Link to="/admin/products" className="text-xs text-muted-foreground hover:text-foreground">Manage →</Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MiniStat icon={Package} label="Total" value={data.products.total} tone="text-slate-700" />
            <MiniStat icon={PackageCheck} label="Active" value={data.products.active} tone="text-emerald-600" />
            <MiniStat icon={AlertTriangle} label="Low Stock" value={data.products.lowStock} tone="text-amber-600" />
            <MiniStat icon={PackageX} label="Out of Stock" value={data.products.outOfStock} tone="text-red-600" />
          </div>
        </Card>

        {/* 6. Store Performance */}
        <Card>
          <h2 className="mb-4 text-base font-semibold tracking-tight">Store Performance</h2>
          <div className="grid grid-cols-3 gap-3">
            <Ring label="Conversion" value={data.performance.conversionRate} suffix="%" max={100} />
            <Ring label="Health Score" value={data.performance.healthScore} suffix="" max={100} />
            <Ring label="Rating" value={data.performance.customerRating ?? 0} suffix={data.performance.customerRating ? "" : ""} max={5} display={data.performance.customerRating ? `${data.performance.customerRating}` : "—"} icon={<Star className="h-3 w-3 fill-amber-400 text-amber-400" />} />
          </div>
        </Card>
      </div>

      {/* 7. Recent Orders */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Recent Orders</h2>
          <Link to="/admin/orders" className="text-xs font-medium text-primary hover:underline">
            View All Orders →
          </Link>
        </div>
        {data.recentOrders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No orders yet</p>
        ) : (
          <div className="overflow-hidden">
            {/* Desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2.5 pr-3 font-medium">Customer</th>
                  <th className="py-2.5 pr-3 font-medium">Order #</th>
                  <th className="py-2.5 pr-3 font-medium">Amount</th>
                  <th className="py-2.5 pr-3 font-medium">Status</th>
                  <th className="py-2.5 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((o: any) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="py-3 pr-3 font-medium">{o.customer_name}</td>
                    <td className="py-3 pr-3 text-muted-foreground">#{o.order_number}</td>
                    <td className="py-3 pr-3">{fmtBDT(o.subtotal)}</td>
                    <td className="py-3 pr-3"><OrderStatusPill status={o.status} /></td>
                    <td className="py-3 text-muted-foreground">{relTime(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Mobile list */}
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

      {/* 8. Notifications */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Notifications</h2>
          <Bell className="h-4 w-4 text-muted-foreground" />
        </div>
        {data.notifications.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">You're all caught up 🎉</p>
        ) : (
          <ul className="space-y-3">
            {data.notifications.map((n: any, i: number) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border p-3">
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

      {/* 9. Quick Actions */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QuickAction to="/admin/products" icon={Plus} label="Add Product" />
        <QuickAction to="/admin/orders" icon={ShoppingBag} label="View Orders" />
        <QuickAction onClick={shareStore} icon={Share2} label="Share Store" />
        <QuickAction href={storeUrl} external icon={ExternalLink} label="Open Store" />
      </div>
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
      {isActive ? "Active" : (sub || status)}
    </span>
  );
}

function StatCard({
  icon: Icon, label, value, trend, trendLabel, tone,
}: {
  icon: any; label: string; value: React.ReactNode;
  trend: number | null; trendLabel: string; tone: string;
}) {
  const up = trend !== null && trend >= 0;
  return (
    <div className="rounded-[18px] border bg-background p-4 shadow-sm md:p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tone)}>
          <Icon className="h-4.5 w-4.5" />
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
    </div>
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
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
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

function StatusMini({ icon: Icon, label, count, tone }: { icon: any; label: string; count: number; tone: string }) {
  return (
    <div className={cn("rounded-xl border p-3", tone)}>
      <Icon className="h-4 w-4" />
      <div className="mt-2 text-xl font-bold">{count}</div>
      <div className="text-[11px] font-medium opacity-80">{label}</div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4", tone)} />
      </div>
      <div className={cn("mt-1.5 text-2xl font-bold", tone)}>{value}</div>
    </div>
  );
}

function Ring({ label, value, max, suffix = "%", display, icon }: { label: string; value: number; max: number; suffix?: string; display?: string; icon?: React.ReactNode }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const size = 68, stroke = 6;
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
    pending: "bg-amber-50 text-amber-700 border-amber-100",
    confirmed: "bg-blue-50 text-blue-700 border-blue-100",
    processing: "bg-indigo-50 text-indigo-700 border-indigo-100",
    delivered: "bg-emerald-50 text-emerald-700 border-emerald-100",
    cancelled: "bg-red-50 text-red-700 border-red-100",
    returned: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize", map[status] ?? "bg-muted")}>
      {status}
    </span>
  );
}

function NotifIcon({ type }: { type: string }) {
  const cls = "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl";
  if (type === "order") return <span className={cn(cls, "bg-blue-50 text-blue-600")}><ShoppingBag className="h-4 w-4" /></span>;
  if (type === "low-stock") return <span className={cn(cls, "bg-amber-50 text-amber-600")}><AlertTriangle className="h-4 w-4" /></span>;
  if (type === "subscription") return <span className={cn(cls, "bg-red-50 text-red-600")}><Clock className="h-4 w-4" /></span>;
  return <span className={cn(cls, "bg-muted text-foreground")}><Bell className="h-4 w-4" /></span>;
}

function QuickAction({
  to, href, onClick, external, icon: Icon, label,
}: {
  to?: string; href?: string; onClick?: () => void; external?: boolean;
  icon: any; label: string;
}) {
  const inner = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-medium">{label}</span>
    </>
  );
  const cls = "flex items-center gap-3 rounded-[18px] border bg-background p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md";
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  if (href) return <a href={href} target={external ? "_blank" : undefined} rel="noreferrer" className={cls}>{inner}</a>;
  return <button type="button" onClick={onClick} className={cn(cls, "text-left")}>{inner}</button>;
}
