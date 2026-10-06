import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Banknote, CheckCircle2, Eye, ReceiptText, ShoppingBag, TrendingDown, TrendingUp, Users, UserCheck } from "lucide-react";
import { getMarketingPerformance } from "@/lib/marketing.functions";
import { analyticsRange, compareRange, compactMoney, pctChange, type AnalyticsRangeKey } from "@/lib/analytics-ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type PlatformId = "facebook" | "google" | "tiktok";
const RANGES: { key: AnalyticsRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "custom", label: "Custom" },
];
const num = (v: number) => Math.round(v).toLocaleString("en-US");
const pct = (v: number) => `${v.toFixed(1)}%`;

export function PlatformOverview({ platform, platformName }: { platform: PlatformId; platformName: string }) {
  const [rangeKey, setRangeKey] = useState<AnalyticsRangeKey>("30d");
  const [custom, setCustom] = useState(() => analyticsRange("30d"));
  const range = useMemo(() => (rangeKey === "custom" ? custom : analyticsRange(rangeKey)), [rangeKey, custom]);
  const comparison = useMemo(() => compareRange(range, "previous_period"), [range]);
  const load = useServerFn(getMarketingPerformance);
  const { data, isLoading } = useQuery({
    queryKey: ["marketing", "overview", platform, range.from, range.to],
    queryFn: () => load({ data: { platform, from: range.from, to: range.to, compare_from: comparison.from, compare_to: comparison.to } }),
  });
  const cur = data?.current;
  const prev = data?.previous;
  const short = platformName.replace(/ Marketing$/, "");

  const cards = cur && prev ? [
    { label: "Visitors", c: cur.visitors, p: prev.visitors, f: num, icon: Users },
    { label: "Sessions", c: cur.sessions, p: prev.sessions, f: num, icon: Activity },
    { label: "Customers", c: cur.customers, p: prev.customers, f: num, icon: UserCheck },
    { label: "Orders", c: cur.orders, p: prev.orders, f: num, icon: ShoppingBag },
    { label: "Purchases", c: cur.purchases, p: prev.purchases, f: num, icon: CheckCircle2 },
    { label: "Revenue", c: cur.revenue, p: prev.revenue, f: compactMoney, icon: Banknote },
    { label: "Conversion rate", c: cur.conversionRate, p: prev.conversionRate, f: pct, icon: TrendingUp },
    { label: "Avg. order value", c: cur.averageOrderValue, p: prev.averageOrderValue, f: compactMoney, icon: ReceiptText },
  ] : [];
  const funnel = cur ? [
    { label: "Visitors", v: cur.funnel.visitors },
    { label: "Product views", v: cur.funnel.productViews },
    { label: "Add to cart", v: cur.funnel.addToCart },
    { label: "Checkout", v: cur.funnel.checkout },
    { label: "Purchase", v: cur.funnel.purchase },
  ] : [];
  const top = Math.max(1, ...funnel.map((x) => x.v));
  const empty = cur && cur.visitors === 0 && cur.orders === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{short} performance</h2>
          <p className="mt-1 text-xs text-muted-foreground">Only visitors and orders that came from {short}. Direct and other traffic is not counted.</p>
        </div>
        <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as AnalyticsRangeKey)}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Date range"><SelectValue /></SelectTrigger>
          <SelectContent>{RANGES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {rangeKey === "custom" && (
        <div className="flex gap-2">
          <Input type="date" aria-label="From" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} />
          <Input type="date" aria-label="To" value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} />
        </div>
      )}

      {isLoading ? <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">Loading {short} data…</div> : !data ? null : (
        <>
          {empty && <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No {short} visitors in this period yet. Visits are counted when people arrive from {short} links or ads (tracking started with this update; older orders have no source).</div>}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {cards.map((m) => {
              const ch = pctChange(m.c, m.p);
              const Trend = ch < 0 ? TrendingDown : TrendingUp;
              return <div key={m.label} className="rounded-md border bg-card p-4">
                <div className="flex items-center justify-between gap-2 text-muted-foreground"><span className="text-xs font-medium">{m.label}</span><m.icon className="h-4 w-4" /></div>
                <div className="mt-2 text-xl font-semibold">{m.f(m.c)}</div>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Trend className="h-3.5 w-3.5" />{Math.abs(ch).toFixed(1)}%</div>
              </div>;
            })}
          </div>

          <div className="rounded-md border bg-card p-4">
            <h3 className="text-sm font-semibold">{short} funnel</h3>
            <div className="mt-3 space-y-2">
              {funnel.map((s) => <div key={s.label}>
                <div className="flex justify-between text-xs"><span>{s.label}</span><span className="font-medium">{num(s.v)}</span></div>
                <div className="mt-1 h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${(s.v / top) * 100}%` }} /></div>
              </div>)}
            </div>
            <p className="mt-2 text-xs text-muted-foreground"><Eye className="mr-1 inline h-3 w-3" />{num(cur!.pageViews)} page views from {short} visitors.</p>
          </div>

          <Table title="Campaigns" note="From campaign tags in your ad links. Ad spend is not available from current tracking data."
            head={["Campaign", "Visitors", "Orders", "Revenue"]}
            rows={data.campaigns.map((c) => [c.name, num(c.visitors), num(c.orders), compactMoney(c.revenue)])} />
          <Table title="Landing pages" note="Where {short} visitors first arrived and how they behaved.".replace("{short}", short)
            head={["Page", "Sessions", "Bounce", "Orders"]}
            rows={data.landingPages.map((l) => [l.path, num(l.sessions), pct(l.bounceRate), num(l.orders)])} />
        </>
      )}
    </div>
  );
}

function Table({ title, note, head, rows }: { title: string; note: string; head: string[]; rows: string[][] }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      {rows.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">No data yet.</p> : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-muted-foreground">{head.map((h, i) => <th key={h} className={`pb-2 font-medium ${i ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className={`py-2 ${j ? "text-right" : "max-w-[180px] truncate"}`}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
