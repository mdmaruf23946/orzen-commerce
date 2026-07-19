import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { businessAnalytics } from "@/lib/business.functions";
import { AdSlot } from "@/components/admin/AdSlot";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: () => <FeatureGate feature="analytics"><AnalyticsPage /></FeatureGate>,
});

function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const w = 280, h = 60;
  const step = w / Math.max(data.length - 1, 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts} className="text-primary" />
    </svg>
  );
}

function AnalyticsPage() {
  const a = useServerFn(businessAnalytics);
  const { data } = useQuery({ queryKey: ["analytics"], queryFn: () => a() });

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const totalCustomers = data.newCustomers + data.returningCustomers;
  const returningPct = totalCustomers ? ((data.returningCustomers / totalCustomers) * 100).toFixed(0) : "0";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Business Analytics</h1>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Sales</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card label="Total Sales" value={`৳${data.totalSales.toFixed(0)}`} />
          <Card label="Total Orders" value={data.totalOrders} />
          <Card label="Average Order Value" value={`৳${data.aov.toFixed(0)}`} />
        </div>
        <div className="mt-3 rounded-xl border bg-card p-4">
          <div className="mb-1 text-xs text-muted-foreground">Last 14 days revenue</div>
          <Sparkline data={data.series.map((s) => s.sales)} />
          <div className="mt-2 grid grid-cols-7 gap-1 text-[10px] text-muted-foreground">
            {data.series.filter((_, i) => i % 2 === 0).map((s) => (
              <span key={s.d}>{s.d.slice(5)}</span>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Products</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <List title="Best selling" items={data.bestSellers} />
          <List title="Lowest selling" items={data.worstSellers} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Customers</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card label="New Customers" value={data.newCustomers} />
          <Card label="Returning Customers" value={data.returningCustomers} />
          <Card label="Returning Rate" value={`${returningPct}%`} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Performance</h2>
        <p className="rounded-xl border bg-card p-4 text-xs text-muted-foreground">
          Conversion rate, add-to-cart rate, and checkout success rate require client-side event tracking. Configure Facebook Pixel or GA4 in <b>Marketing</b> to populate these metrics from your provider's dashboard.
        </p>
      </section>
      <AdSlot slotKey="admin_analytics_bottom" />
    </div>
  );
}

function Card({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function List({ title, items }: { title: string; items: { name: string; qty: number }[] }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</div>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">No data</p> : (
        <ul className="space-y-1.5 text-sm">
          {items.map((i, idx) => (
            <li key={idx} className="flex justify-between">
              <span className="line-clamp-1">{i.name}</span>
              <span className="font-mono text-muted-foreground">{i.qty}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
