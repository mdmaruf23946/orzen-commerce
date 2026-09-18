import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users, Store as StoreIcon, CheckCircle2, Pause, Wallet, Sparkles,
  Clock, AlertTriangle, TrendingUp, Receipt,
} from "lucide-react";
import { ownerControlCenter } from "@/lib/owner.functions";
import { GitHubDeployment } from "@/components/owner/GitHubDeployment";

export const Route = createFileRoute("/_authenticated/owner/")({
  component: OwnerDashboard,
});

function OwnerDashboard() {
  const fn = useServerFn(ownerControlCenter);
  const { data, isLoading } = useQuery({
    queryKey: ["owner", "control-center"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  const fmt = (n: number) => `৳${(n ?? 0).toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;

  const kpis = [
    { label: "MRR (this month)", value: fmt(data?.revenue.month ?? 0), icon: TrendingUp, tone: "text-emerald-600" },
    { label: "Revenue today", value: fmt(data?.revenue.today ?? 0), icon: Wallet, tone: "text-blue-600" },
    { label: "Total revenue", value: fmt(data?.revenue.total ?? 0), icon: Receipt, tone: "text-purple-600" },
    { label: "Active stores", value: data?.stores.active ?? 0, icon: CheckCircle2, tone: "text-emerald-600" },
    { label: "Trials", value: data?.stores.trialing ?? 0, icon: Clock, tone: "text-amber-600" },
    { label: "Expiring in 7d", value: data?.stores.expiringSoon ?? 0, icon: AlertTriangle, tone: "text-orange-600" },
    { label: "Total stores", value: data?.stores.total ?? 0, icon: StoreIcon, tone: "text-slate-600" },
    { label: "Total users", value: data?.users ?? 0, icon: Users, tone: "text-slate-600" },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Platform Overview</h1>
          <p className="text-sm text-muted-foreground">Live pulse of your SaaS platform.</p>
        </div>
        {(data?.pendingPayments ?? 0) > 0 && (
          <Link
            to="/owner/billing"
            className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {data?.pendingPayments} pending payment{(data?.pendingPayments ?? 0) > 1 ? "s" : ""}
          </Link>
        )}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.map((c) => (
          <div key={c.label} className="min-w-0 rounded-xl border bg-card p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</span>
              <c.icon className={`h-4 w-4 flex-shrink-0 ${c.tone}`} />
            </div>
            <div className="mt-1.5 truncate text-xl font-bold sm:text-2xl">
              {isLoading ? "—" : c.value}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue sparkline + AI + activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 rounded-xl border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Revenue · last 7 days</h2>
            <span className="text-xs text-muted-foreground">
              Total: {fmt((data?.revenue.spark ?? []).reduce((a, b) => a + b.total, 0))}
            </span>
          </div>
          <Sparkline data={data?.revenue.spark ?? []} />
        </div>

        <div className="min-w-0 rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <h2 className="text-sm font-semibold">AI usage (30d)</h2>
          </div>
          <dl className="space-y-2 text-sm">
            <Row label="Requests" value={(data?.ai.requests ?? 0).toLocaleString()} />
            <Row label="Tokens" value={(data?.ai.tokens ?? 0).toLocaleString()} />
            <Row label="Est. cost" value={`$${(data?.ai.cost ?? 0).toFixed(2)}`} />
          </dl>
          <Link to="/owner/ai-usage" className="mt-3 inline-block text-xs text-primary hover:underline">
            View details →
          </Link>
        </div>
      </div>

      {/* Activity + store health */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
          {(data?.activity ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <ul className="space-y-2">
              {data!.activity.map((a: any, i: number) => (
                <li key={i} className="flex items-start gap-3 border-b pb-2 last:border-0 last:pb-0">
                  <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${
                    a.type === "payment" ? "bg-emerald-500" : a.type === "store" ? "bg-blue-500" : "bg-amber-500"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{a.text}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(a.at).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-w-0 rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Store health</h2>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="New (7d)" value={data?.stores.new7d ?? 0} tone="text-emerald-600" />
            <MiniStat label="Expired" value={data?.stores.expired ?? 0} tone="text-red-600" />
            <MiniStat label="Suspended" value={data?.stores.suspended ?? 0} tone="text-amber-600" />
            <MiniStat label="Trials" value={data?.stores.trialing ?? 0} tone="text-blue-600" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/owner/stores" className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">Manage stores</Link>
            <Link to="/owner/subscriptions" className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">Subscriptions</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-bold ${tone}`}>{value}</div>
    </div>
  );
}

function Sparkline({ data }: { data: { date: string; total: number }[] }) {
  const w = 600, h = 120, pad = 24;
  const max = Math.max(1, ...data.map((d) => d.total));
  const stepX = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = pad + i * stepX;
    const y = h - pad - (d.total / max) * (h - pad * 2);
    return { x, y, ...d };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = points.length
    ? `${path} L${points[points.length - 1]!.x},${h - pad} L${points[0]!.x},${h - pad} Z`
    : "";

  if (points.length === 0) {
    return (
      <div className="flex h-32 w-full items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
        No revenue data yet
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="spark" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#spark)" className="text-primary" />
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" className="fill-primary" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        {data.map((d) => <span key={d.date}>{d.date}</span>)}
      </div>
    </div>
  );
}
