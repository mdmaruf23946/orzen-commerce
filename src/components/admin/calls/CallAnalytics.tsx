// Call analytics cards (Overview) and detailed call log table (Calls & History).
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCallAnalytics, listCallLogs } from "@/lib/voice-analytics.functions";
import { formatDuration } from "@/lib/call-center";

type RangeKey = "today" | "7d" | "30d" | "custom";

function dhakaDayStart(d = new Date()) {
  // Start of today in Asia/Dhaka (UTC+6), as a UTC Date.
  const shifted = new Date(d.getTime() + 6 * 3600_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 6 * 3600_000);
}

function useRange() {
  const [key, setKey] = useState<RangeKey>("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const range = useMemo(() => {
    const now = new Date();
    if (key === "custom" && from && to) {
      return { from: new Date(`${from}T00:00:00+06:00`).toISOString(), to: new Date(`${to}T23:59:59+06:00`).toISOString() };
    }
    const days = key === "today" ? 0 : key === "30d" ? 29 : 6;
    return { from: new Date(dhakaDayStart(now).getTime() - days * 86400_000).toISOString(), to: now.toISOString() };
  }, [key, from, to]);
  const bar = (
    <div className="flex flex-wrap items-center gap-1.5">
      {(["today", "7d", "30d", "custom"] as const).map((k) => (
        <button key={k} type="button" onClick={() => setKey(k)}
          className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${key === k ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>
          {k === "today" ? "Today" : k === "7d" ? "7 days" : k === "30d" ? "30 days" : "Custom"}
        </button>
      ))}
      {key === "custom" && (
        <>
          <Input type="date" className="h-8 w-36" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" className="h-8 w-36" value={to} onChange={(e) => setTo(e.target.value)} />
        </>
      )}
    </div>
  );
  return { range, bar };
}

function Card({ label, value, sub, tone = "" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function CallAnalyticsCards() {
  const { range, bar } = useRange();
  const fn = useServerFn(getCallAnalytics);
  const q = useQuery({ queryKey: ["voice", "analytics", range.from, range.to], queryFn: () => fn({ data: range }), placeholderData: (p) => p });
  const a = q.data;
  const by = a?.by;
  const total = a?.total ?? 0;
  const seg = (n: number) => (total ? `${(n / total) * 100}%` : "0%");
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Call Analytics</h3>
        {bar}
      </div>
      {q.isError ? <p className="text-xs text-destructive">Could not load analytics. Please try again.</p> : (
        <div className={q.isFetching ? "opacity-60 transition-opacity" : undefined}>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Card label="Total calls" value={String(total)} sub={`${a?.auto ?? 0} auto · ${a?.manual ?? 0} manual`} />
            <Card label="Confirmed rate" value={`${a?.confirmed_pct ?? 0}%`} sub={`of ${a?.verified_orders ?? 0} orders called`} tone="text-primary" />
            <Card label="Cancelled / unresolved" value={`${a?.cancelled_failed_pct ?? 0}%`} sub={`${a?.cancelled_orders ?? 0} cancelled · ${a?.unresolved_orders ?? 0} no answer/failed`} tone="text-destructive" />
            <Card label="Estimated call cost"
              value={a?.est_cost != null ? `৳${a.est_cost.toLocaleString()}` : "—"}
              sub={a?.rate != null ? `${a.billed_minutes} min × ৳${a.rate}/min (estimate)` : "Set your call rate in Settings"} />
          </div>
          <div className="mt-3">
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              <div className="bg-primary" style={{ width: seg(by?.answered ?? 0) }} />
              <div className="bg-muted-foreground/50" style={{ width: seg(by?.no_answer ?? 0) }} />
              <div className="bg-accent-foreground/40" style={{ width: seg(by?.busy ?? 0) }} />
              <div className="bg-destructive" style={{ width: seg(by?.failed ?? 0) }} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span>Answered {by?.answered ?? 0}</span><span>No answer {by?.no_answer ?? 0}</span>
              <span>Busy {by?.busy ?? 0}</span><span>Failed {by?.failed ?? 0}</span>
              {!!by?.calling && <span>In progress {by.calling}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  answered: "Answered", completed: "Answered", no_answer: "No answer", missed: "No answer",
  busy: "Busy", failed: "Failed", calling: "Calling", ringing: "Ringing",
};
const STATUS_TONE: Record<string, string> = {
  answered: "border-primary/30 bg-primary/10 text-primary", completed: "border-primary/30 bg-primary/10 text-primary",
  busy: "bg-muted text-foreground", failed: "border-destructive/30 bg-destructive/10 text-destructive",
};

function keyLabel(r: any) {
  if (r.dtmf === "1" || r.result === "order_confirmed") return "1 — Confirmed";
  if (r.dtmf === "2" || r.result === "order_cancelled") return "2 — Cancelled";
  return r.dtmf ? String(r.dtmf) : "—";
}
function typeLabel(r: any) {
  const base = r.call_type === "auto_verification" ? "Auto verification" : "Manual";
  return r.retry_count > 0 ? `${base} · retry ${r.retry_count}` : base;
}
const fmtTime = (s: string) => new Date(s).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function PlayButton({ url }: { url: string }) {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    let a = audio;
    if (!a) { a = new Audio(url); a.onended = () => setPlaying(false); a.onerror = () => setPlaying(false); setAudio(a); }
    if (playing) { a.pause(); setPlaying(false); } else { a.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
  };
  return (
    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={toggle} aria-label={playing ? "Pause recording" : "Play recording"}>
      {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
    </Button>
  );
}

export function CallLogTable() {
  const { range, bar } = useRange();
  const [status, setStatus] = useState<"all" | "answered" | "no_answer" | "busy" | "failed" | "calling">("all");
  const [type, setType] = useState<"all" | "auto" | "manual" | "retry">("all");
  const [hasRecording, setHasRecording] = useState(false);
  const [search, setSearch] = useState("");
  const fn = useServerFn(listCallLogs);
  const args = { ...range, status, type, hasRecording, q: search.trim() };
  const q = useInfiniteQuery({
    queryKey: ["voice", "call-logs", args],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fn({ data: { ...args, offset: pageParam, limit: 50 } }),
    getNextPageParam: (last, pages) => (last.has_more ? pages.length * 50 : undefined),
  });
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all: any[] = [];
      for (let off = 0; off < 2000; off += 200) {
        const r = await fn({ data: { ...args, offset: off, limit: 200 } });
        all.push(...r.rows);
        if (!r.has_more) break;
      }
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [["Order", "Customer", "Phone", "Time (Dhaka)", "Type", "Status", "Duration (sec)", "Keypress"].join(",")]
        .concat(all.map((r) => [r.invoice_no, r.customer_name, r.phone, fmtTime(r.created_at), typeLabel(r), STATUS_LABEL[r.status] ?? r.status, r.duration_sec ?? 0, keyLabel(r)].map(esc).join(",")));
      const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `call-logs-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(a.href);
    } finally { setExporting(false); }
  };

  const sel = "h-8 rounded-md border bg-background px-2 text-xs";
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Detailed Call Logs</h3>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting || !rows.length}>
          <Download className="mr-1 h-3.5 w-3.5" />{exporting ? "Preparing…" : "Download CSV"}
        </Button>
      </div>
      {bar}
      <div className="flex flex-wrap items-center gap-2">
        <select className={sel} value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="all">All statuses</option><option value="answered">Answered</option><option value="no_answer">No answer</option>
          <option value="busy">Busy</option><option value="failed">Failed</option><option value="calling">In progress</option>
        </select>
        <select className={sel} value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="all">All types</option><option value="auto">Auto verification</option><option value="manual">Manual</option><option value="retry">Retries only</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={hasRecording} onChange={(e) => setHasRecording(e.target.checked)} /> With recording</label>
        <Input className="h-8 w-44" placeholder="Search phone" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {q.isLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : q.isError ? (
        <p className="text-xs text-destructive">Could not load call logs. Please try again.</p>
      ) : !rows.length ? (
        <p className="text-xs text-muted-foreground">No calls in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr>
              <th className="py-1 pr-2">Order</th><th className="pr-2">Customer</th><th className="pr-2">Time</th><th className="pr-2">Type</th>
              <th className="pr-2">Status</th><th className="pr-2">Duration</th><th className="pr-2">Keypress</th><th>Recording</th>
            </tr></thead>
            <tbody>{rows.map((r: any) => (
              <tr key={r.id} className="border-t align-middle">
                <td className="py-2 pr-2">{r.invoice_no ? <Link to="/admin/orders" className="text-primary hover:underline">{r.invoice_no}</Link> : "—"}</td>
                <td className="pr-2 text-xs">{r.customer_name ?? ""} <span className="font-mono text-muted-foreground">{r.phone}</span></td>
                <td className="pr-2 text-xs whitespace-nowrap">{fmtTime(r.created_at)}</td>
                <td className="pr-2 text-xs">{typeLabel(r)}</td>
                <td className="pr-2"><span className={`rounded-full border px-2 py-0.5 text-[11px] ${STATUS_TONE[r.status] ?? "text-muted-foreground"}`}>{STATUS_LABEL[r.status] ?? r.status}</span></td>
                <td className="pr-2 font-mono text-xs">{formatDuration(r.duration_sec)}</td>
                <td className="pr-2 text-xs">{keyLabel(r)}</td>
                <td>{r.play_url ? <PlayButton url={r.play_url} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
              </tr>))}
            </tbody>
          </table>
          {q.hasNextPage && (
            <div className="pt-3 text-center">
              <Button size="sm" variant="outline" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                {q.isFetchingNextPage ? "Loading…" : "Show more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
