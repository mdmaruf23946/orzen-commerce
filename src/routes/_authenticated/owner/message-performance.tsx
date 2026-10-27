import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { ownerMessagePerformance } from "@/lib/owner.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/owner/message-performance")({
  head: () => ({ meta: [{ title: "Message Performance — ORZEN Owner" }, { name: "description", content: "Queue, database, AI and send time for every WhatsApp and Messenger reply." }] }),
  component: MessagePerformancePage,
});

const STAGES = [
  { key: "queue", label: "Queue", cls: "bg-muted-foreground/50" },
  { key: "db", label: "DB", cls: "bg-primary/40" },
  { key: "ai", label: "AI", cls: "bg-primary" },
  { key: "photo", label: "Photo", cls: "bg-accent-foreground/60" },
  { key: "guard", label: "Guard", cls: "bg-secondary-foreground/50" },
  { key: "send", label: "Send", cls: "bg-destructive/60" },
  { key: "delay", label: "Pacing", cls: "bg-muted-foreground/25" },
] as const;
type StageKey = (typeof STAGES)[number]["key"];

const sec = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);

function StageBar({ row }: { row: Record<StageKey, number> }) {
  const sum = STAGES.reduce((a, s) => a + (row[s.key] || 0), 0) || 1;
  return (
    <div className="flex h-3 w-full overflow-hidden rounded bg-muted">
      {STAGES.map((s) => row[s.key] > 0 && (
        <div key={s.key} className={s.cls} style={{ width: `${(row[s.key] / sum) * 100}%` }} title={`${s.label}: ${sec(row[s.key])}`} />
      ))}
    </div>
  );
}

function biggest(row: Record<StageKey, number> & { total: number }) {
  let best: (typeof STAGES)[number] | null = null;
  for (const s of STAGES) if (!best || row[s.key] > row[best.key]) best = s;
  if (!best || !row.total || !row[best.key]) return null;
  return `${best.label} took ${Math.round((row[best.key] / row.total) * 100)}% of the time`;
}

function MessagePerformancePage() {
  const [days, setDays] = useState(1);
  const [channel, setChannel] = useState("all");
  const [store, setStore] = useState("all");
  const [route, setRoute] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const fn = useServerFn(ownerMessagePerformance);
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["owner", "msg-perf", days],
    queryFn: () => fn({ data: { days } }),
  });

  const s = data?.summary;
  const cards = [
    { label: "Messages", value: s ? String(s.messages) : "—" },
    { label: "Avg reply", value: s ? sec(s.avg) : "—" },
    { label: "p95 reply", value: s ? sec(s.p95) : "—" },
    { label: "Under 10s", value: s ? `${s.under10}%` : "—" },
    { label: "Failed", value: s ? String(s.failed) : "—" },
  ];
  const rows = (data?.slowest ?? []).filter(
    (r) => (channel === "all" || r.channel === channel) && (store === "all" || r.store === store) && (route === "all" || r.route === route),
  );
  const sel = "h-8 rounded-md border bg-background px-2 text-sm";

  return (
    <div className="min-w-0 space-y-4">
      <OwnerPageHeader
        title="Message Performance"
        description="Where the time goes for every WhatsApp and Messenger reply: queue, database, AI, send."
        actions={
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <select className={sel} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={1}>Last 24h</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option>
        </select>
        <select className={sel} value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="all">All channels</option><option value="whatsapp">WhatsApp</option><option value="messenger">Messenger</option>
        </select>
        <select className={sel} value={route} onChange={(e) => setRoute(e.target.value)}>
          <option value="all">All routes</option><option value="ai">AI</option><option value="fast">Fast path</option><option value="photo">Photo</option><option value="other">Other</option>
        </select>
        <select className={sel} value={store} onChange={(e) => setStore(e.target.value)}>
          <option value="all">All stores</option>
          {(data?.stores ?? []).map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="min-w-0 rounded-xl border bg-card p-3">
            <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className="mt-1 truncate text-lg font-bold sm:text-xl">{isLoading ? "—" : c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Average time by route</h2>
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {STAGES.map((st) => <span key={st.key} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-sm ${st.cls}`} />{st.label}</span>)}
          </div>
        </div>
        {(data?.breakdown ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No timed replies yet. New messages are measured from now on.</p>
        ) : (
          <div className="space-y-3">
            {data!.breakdown.map((b) => {
              const tot = STAGES.reduce((a, st) => a + b[st.key], 0);
              return (
                <div key={b.route}>
                  <div className="mb-1 flex justify-between text-xs"><span className="font-medium uppercase">{b.route} · {b.count}</span><span>{sec(tot)}</span></div>
                  <StageBar row={b} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Slowest messages</h2>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nothing in this period.</p> : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-muted-foreground">
                  <th className="pb-2">Time</th><th className="pb-2">Store</th><th className="pb-2">Channel</th><th className="pb-2">Route</th>
                  <th className="pb-2 text-right">Total</th><th className="pb-2 text-right">Queue</th><th className="pb-2 text-right">DB</th>
                  <th className="pb-2 text-right">AI</th><th className="pb-2 text-right">Send</th><th className="pb-2 pl-3">Cause</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const hint = r.traced ? biggest(r) : null;
                  const slow = r.total > 10000;
                  return [
                    <tr key={r.id} className="cursor-pointer border-t hover:bg-muted/40" onClick={() => setOpen(open === r.id ? null : r.id)}>
                      <td className="py-1.5 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="max-w-[130px] truncate py-1.5">{r.store}</td>
                      <td className="py-1.5">{r.channel}</td>
                      <td className="py-1.5">{r.route}</td>
                      <td className={`py-1.5 text-right font-medium ${slow ? "text-destructive" : ""}`}>{sec(r.total)}</td>
                      <td className="py-1.5 text-right">{r.traced ? sec(r.queue) : "—"}</td>
                      <td className="py-1.5 text-right">{r.traced ? sec(r.db) : "—"}</td>
                      <td className="py-1.5 text-right">{r.traced ? sec(r.ai) : "—"}</td>
                      <td className="py-1.5 text-right">{r.traced ? sec(r.send) : "—"}</td>
                      <td className={`max-w-[220px] truncate py-1.5 pl-3 text-xs ${slow ? "text-destructive" : "text-muted-foreground"}`}>
                        {r.error ?? hint ?? (r.traced ? "" : "not measured")}
                      </td>
                    </tr>,
                    open === r.id && (
                      <tr key={r.id + "-d"} className="bg-muted/30">
                        <td colSpan={10} className="p-3">
                          <StageBar row={r} />
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            {STAGES.map((st) => <span key={st.key}>{st.label}: <b>{sec(r[st.key])}</b></span>)}
                            <span>Status: <b>{r.status}</b></span>
                            {r.model && <span>Model: <b>{r.model}</b></span>}
                            {r.tokens && <span>Tokens: <b>{r.tokens.toLocaleString()}</b></span>}
                          </div>
                          {r.error && <p className="mt-2 text-xs text-destructive">{r.error}</p>}
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
