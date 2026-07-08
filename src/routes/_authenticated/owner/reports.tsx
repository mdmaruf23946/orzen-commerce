import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOwnerReports } from "@/lib/owner-ext.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";

export const Route = createFileRoute("/_authenticated/owner/reports")({ component: Page });

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-card p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div>;
}

function Page() {
  const get = useServerFn(getOwnerReports);
  const { data } = useQuery({ queryKey: ["owner", "reports"], queryFn: () => get() });

  if (!data) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  const maxRev = Math.max(1, ...data.revDays.map((d: any) => d.total));

  function csv() {
    const rows = [["date", "revenue"], ...data!.revDays.map((d: any) => [d.date, String(d.total)])];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "revenue.csv"; a.click();
  }

  return (
    <div>
      <OwnerPageHeader title="Reports" description="Revenue, growth, orders and AI usage — last 30–90 days."
        actions={<button onClick={csv} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">Export CSV</button>}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Revenue (90d)" value={`৳${data.revenue90.toFixed(0)}`} />
        <Stat label="Orders (30d)" value={`${data.orderCount}`} />
        <Stat label="Order value (30d)" value={`৳${data.orderTotal.toFixed(0)}`} />
        <Stat label="AI cost (30d)" value={`$${data.aiCost.toFixed(2)}`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Revenue (last 30 days)</h2><span className="text-xs text-muted-foreground">৳{data.revDays.reduce((a: number, d: any) => a + d.total, 0).toFixed(0)}</span></div>
          <div className="flex h-32 items-end gap-[2px]">
            {data.revDays.map((d: any) => <div key={d.date} className="min-w-[3px] flex-1 rounded-t bg-primary/70" style={{ height: `${(d.total / maxRev) * 100}%` }} title={`${d.date}: ৳${d.total.toFixed(0)}`} />)}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Revenue by method</h2>
          <div className="space-y-2">
            {Object.entries(data.byMethod).map(([m, v]) => (
              <div key={m} className="flex items-center justify-between text-sm"><span className="capitalize">{m}</span><span className="font-medium">৳{Number(v).toFixed(0)}</span></div>
            ))}
            {Object.keys(data.byMethod).length === 0 && <div className="text-xs text-muted-foreground">No paid payments.</div>}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Subscription status</h2>
          <div className="space-y-2">
            {Object.entries(data.subStatus).map(([s, v]) => (
              <div key={s} className="flex items-center justify-between text-sm"><span className="capitalize">{s}</span><span className="font-medium">{v as number}</span></div>
            ))}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">Total stores: {data.totalStores}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">AI usage (30d)</h2>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-md bg-muted/40 p-3"><div className="text-lg font-semibold">{data.aiCount}</div><div className="text-muted-foreground">requests</div></div>
            <div className="rounded-md bg-muted/40 p-3"><div className="text-lg font-semibold">{(data.aiTokens / 1000).toFixed(1)}k</div><div className="text-muted-foreground">tokens</div></div>
            <div className="rounded-md bg-muted/40 p-3"><div className="text-lg font-semibold">${data.aiCost.toFixed(2)}</div><div className="text-muted-foreground">cost</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
