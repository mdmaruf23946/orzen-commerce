import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  PhoneCall, CheckCircle2, XCircle, PhoneMissed, AlertTriangle, Percent, Clock, Timer, Package, RefreshCw, Loader2, Send, Search, Activity,
  MessageCircle, MapPin, Eye, FileText, Copy,
} from "lucide-react";
import { Thumb, StatusBadge } from "@/components/admin/orders/OrderCard";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Stat } from "@/components/admin/calls/AiVoiceAgentPanel";
import { OrzenCallSettings } from "@/components/admin/calls/OrzenCallSettings";
import { CALL_SMS_PROVIDERS } from "@/lib/call-sms-providers";
import { STATUS_LABEL, STATUS_TONE, RESULT_LABEL, type CallStatus, type CallResult } from "@/lib/call-center";
import {
  getOrzenCallOverview, listOrzenCalls, getOrzenSyncStatus, syncAllOrzenProducts, resendOrzenOrder, getOrzenCallSettings,
} from "@/lib/orzen-call.functions";

export const Route = createFileRoute("/_authenticated/admin/call-sms/orzen-call")({
  component: OrzenCallPage,
  validateSearch: (s: Record<string, unknown>) => ({ tab: typeof s.tab === "string" ? s.tab : undefined }),
  head: () => ({
    meta: [
      { title: "Orzen Call — AI Call & SMS Integration — ORZEN Merchant Panel" },
      { name: "description", content: "Orzen Call AI voice: call overview, call history, order call queue, product sync & setup." },
      { property: "og:title", content: "Orzen Call — ORZEN Merchant Panel" },
      { property: "og:description", content: "Orzen Call AI voice: call overview, call history, order call queue, product sync & setup." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const TABS = CALL_SMS_PROVIDERS.find((p) => p.id === "orzen-call")!.sections;

function fmtDur(s: number) {
  if (!s) return "0s";
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
}
function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}

function OrzenCallPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const getFn = useServerFn(getOrzenCallSettings);
  const settings = useQuery({ queryKey: ["orzen-call", "settings"], queryFn: () => getFn() });
  const connected = !!settings.data?.connected;
  const tab = TABS.find((t) => t.key === search.tab)?.key ?? (settings.isLoading || connected ? "overview" : "setup");

  return (
    <FeatureGate feature="call_center">
      <div className="space-y-4">
        <AdminPageHeader title="Orzen Call" description="AI Call & SMS Integration → Orzen Call: automatic COD confirmation calls, call history & product knowledge sync." />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => navigate({ search: { tab: t.key } })}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium ${tab === t.key ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>
              <t.icon className="h-3.5 w-3.5" />{t.label}
            </button>
          ))}
        </div>
        {!connected && !settings.isLoading && tab !== "setup" && tab !== "guide" && (
          <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">Orzen Call is not connected yet. Add your webhook link in Setup.</span>
            <Button size="sm" onClick={() => navigate({ search: { tab: "setup" } })}>Go to Setup</Button>
          </div>
        )}
        {tab === "overview" && <Overview connected={connected} connectedAt={settings.data?.connected_at ?? null} />}
        {tab === "calls" && <CallHistory />}
        {tab === "queue" && <OrderQueue connected={connected} />}
        {tab === "sync" && <ProductSync connected={connected} />}
        {tab === "guide" && <Guide callback={settings.data?.callback_url ?? null} />}
        {tab === "setup" && <OrzenCallSettings />}
      </div>
    </FeatureGate>
  );
}

function Overview({ connected, connectedAt }: { connected: boolean; connectedAt: string | null }) {
  const [days, setDays] = useState(30);
  const fn = useServerFn(getOrzenCallOverview);
  const q = useQuery({ queryKey: ["orzen-call", "overview", days], queryFn: () => fn({ data: { days } }) });
  const recentFn = useServerFn(listOrzenCalls);
  const recent = useQuery({ queryKey: ["orzen-call", "calls", "recent"], queryFn: () => recentFn({ data: { filter: "all", search: "", limit: 6 } }) });
  const d = q.data;
  const max = Math.max(1, ...(d?.daily ?? []).map((x) => x.total));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${connected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            {connected ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}{connected ? "Connected" : "Not connected"}
          </span>
          {connectedAt && <span className="text-xs text-muted-foreground">since {fmtDate(connectedAt)}</span>}
        </div>
        <div className="flex gap-1">
          {[1, 7, 30, 90].map((n) => (
            <button key={n} type="button" onClick={() => setDays(n)}
              className={`rounded-md border px-2 py-1 text-xs ${days === n ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>
              {n === 1 ? "Today" : `${n} days`}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat icon={PhoneCall} label="Total Calls" value={d?.total ?? "…"} />
        <Stat icon={CheckCircle2} label="Confirmed" value={d?.confirmed ?? "…"} tone="text-emerald-600 dark:text-emerald-400" />
        <Stat icon={XCircle} label="Cancelled" value={d?.cancelled ?? "…"} tone="text-destructive" />
        <Stat icon={Percent} label="Success Rate" value={d ? `${d.success_rate}%` : "…"} tone="text-primary" />
        <Stat icon={PhoneMissed} label="No Answer / Busy" value={d?.missed ?? "…"} tone="text-amber-600 dark:text-amber-400" />
        <Stat icon={AlertTriangle} label="Failed" value={d?.failed ?? "…"} />
        <Stat icon={Activity} label="Confirm vs Cancel" value={d ? `${d.confirm_rate}%` : "…"} />
        <Stat icon={Timer} label="Avg Call Time" value={d ? fmtDur(d.avg_duration) : "…"} />
      </div>
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Daily calls</p>
          <div className="flex gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary/30" />Total</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary" />Confirmed</span>
          </div>
        </div>
        {d && d.total === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No calls yet in this period. Calls appear here when Orzen Call reports back.</p>
        ) : (
          <div className="flex h-32 items-end gap-0.5">
            {(d?.daily ?? []).map((x) => (
              <div key={x.day} title={`${x.day}: ${x.total} calls, ${x.confirmed} confirmed`} className="relative flex-1 rounded-t bg-primary/30" style={{ height: `${(x.total / max) * 100}%`, minHeight: x.total ? 3 : 1 }}>
                <div className="absolute bottom-0 w-full rounded-t bg-primary" style={{ height: x.total ? `${(x.confirmed / x.total) * 100}%` : 0 }} />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Recent calls</p>
          <Link to="/admin/call-sms/orzen-call" search={{ tab: "calls" }} className="text-xs text-primary hover:underline">View all</Link>
        </div>
        <CallList rows={recent.data ?? []} loading={recent.isLoading} compact />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status as CallStatus] ?? "bg-muted text-muted-foreground ring-border";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${tone}`}>{STATUS_LABEL[status as CallStatus] ?? status}</span>;
}
function ResultPill({ result }: { result: string | null }) {
  if (!result) return null;
  const tone = result === "order_confirmed" ? "text-emerald-600 dark:text-emerald-400" : result === "order_cancelled" ? "text-destructive" : "text-muted-foreground";
  return <span className={`text-xs font-medium ${tone}`}>{RESULT_LABEL[result as CallResult] ?? result}</span>;
}

function waLink(phone: string) {
  const d = String(phone ?? "").replace(/\D/g, "");
  return `https://wa.me/${d.startsWith("880") ? d : `88${d.replace(/^0?/, "0")}`}`;
}

function Conversation({ r }: { r: any }) {
  if (Array.isArray(r.transcript) && r.transcript.length > 0) {
    return (
      <div className="mt-2 space-y-1.5">
        {r.transcript.map((m: any, i: number) => {
          const ai = /assistant|agent|ai|bot/i.test(String(m?.role ?? ""));
          return (
            <div key={i} className={`flex ${ai ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs ${ai ? "border bg-card" : "bg-primary/10"}`}>
                <p className="mb-0.5 text-[10px] font-semibold uppercase text-muted-foreground">{ai ? "AI" : "Customer"}</p>
                <p className="whitespace-pre-wrap">{String(m?.text ?? "")}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  return r.conversation_text ? <p className="mt-2 whitespace-pre-wrap text-xs">{r.conversation_text}</p> : null;
}

function OrderBrief({ order, phone, name, invoice, date }: { order: any; phone: string; name: string; invoice?: string | null; date: string }) {
  const first = order?.items?.[0];
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3">
      <Thumb url={first?.image} alt={first?.name ?? "Product"} className="h-14 w-14 sm:h-16 sm:w-16" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          {invoice && <span className="font-mono">#{invoice}</span>}
          <span>{fmtDate(date)}</span>
        </div>
        <p className="truncate text-sm font-semibold">{name || phone}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">{phone}</span>
          <a href={`tel:${phone}`} aria-label="Call" className="rounded-md p-1 text-primary hover:bg-muted"><PhoneCall className="h-3.5 w-3.5" /></a>
          <a href={waLink(phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="rounded-md p-1 text-emerald-600 hover:bg-muted"><MessageCircle className="h-3.5 w-3.5" /></a>
        </div>
        {order?.address && <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span className="line-clamp-1">{order.address}{order.area ? `, ${order.area}` : ""}</span></p>}
        {first && (
          <p className="mt-1 line-clamp-1 text-xs">
            {first.name} × {first.qty}{order.items.length > 1 ? ` +${order.items.length - 1} more` : ""}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 text-right">
        {order && <span className="text-sm font-bold">৳{Math.round(order.total).toLocaleString("en-IN")}</span>}
        {order?.payment_method && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">{order.payment_method}</span>}
        {order?.status && <StatusBadge status={order.status} />}
      </div>
    </div>
  );
}

function OrderActions({ order, copyText }: { order: any; copyText: string }) {
  const BTN = "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs hover:bg-muted";
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {order && (
        <>
          <Link to="/admin/orders" search={{ q: order.invoice_no } as any} className={BTN}><Eye className="h-3.5 w-3.5" />View</Link>
          <Link to="/admin/invoice/$orderId" params={{ orderId: order.id }} className={BTN}><FileText className="h-3.5 w-3.5" />Invoice</Link>
        </>
      )}
      <button type="button" className={BTN} onClick={() => navigator.clipboard?.writeText(copyText).then(() => toast.success("Copied"), () => toast.error("Copy failed"))}>
        <Copy className="h-3.5 w-3.5" />Copy
      </button>
    </div>
  );
}

function copyFor(name: string, phone: string, order: any) {
  const items = (order?.items ?? []).map((i: any) => `${i.name} × ${i.qty}`).join(", ");
  return [name, phone, order?.address ? `${order.address}${order.area ? `, ${order.area}` : ""}` : "", items].filter(Boolean).join("\n");
}

function CallList({ rows, loading, compact }: { rows: any[]; loading: boolean; compact?: boolean }) {
  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">No calls found.</p>;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <article key={r.id} className="rounded-2xl border bg-card p-3 shadow-sm sm:p-4">
          <OrderBrief order={r.order} phone={r.phone} name={r.customer_name} invoice={r.invoice_no} date={r.created_at} />
          <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 px-2.5 py-1.5 text-[11px]">
            {!r.order?.status && (r.result ? <ResultPill result={r.result} /> : <StatusPill status={r.status} />)}
            <span className="text-muted-foreground">⏱ {fmtDur(r.duration_sec)}</span>
            {r.attempts > 1 && <span className="ml-auto text-muted-foreground">{r.attempts} calls</span>}
          </div>
          {!compact && r.note && <p className="mt-2 text-xs text-muted-foreground">“{r.note}”</p>}
          {!compact && r.history?.some((h: any) => (Array.isArray(h.transcript) && h.transcript.length) || h.conversation_text) && (
            <details className="mt-2 rounded-lg border bg-muted/30 p-2">
              <summary className="cursor-pointer text-xs font-medium text-primary">View conversation{r.attempts > 1 ? ` (${r.attempts} calls)` : ""}</summary>
              {r.history.map((h: any, i: number) => (
                <div key={h.id} className={i ? "mt-3 border-t pt-2" : ""}>
                  {r.attempts > 1 && <p className="text-[10px] text-muted-foreground">{fmtDate(h.created_at)} · {fmtDur(h.duration_sec)}</p>}
                  <Conversation r={h} />
                </div>
              ))}
            </details>
          )}
          {!compact && <OrderActions order={r.order} copyText={copyFor(r.customer_name, r.phone, r.order)} />}
        </article>
      ))}
    </div>
  );
}

const FILTERS = [
  { key: "all", label: "All" }, { key: "today", label: "Today" }, { key: "confirmed", label: "Confirmed" },
  { key: "cancelled", label: "Cancelled" }, { key: "missed", label: "No Answer" }, { key: "failed", label: "Failed" },
] as const;

function CallHistory() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [term, setTerm] = useState("");
  const fn = useServerFn(listOrzenCalls);
  const q = useQuery({ queryKey: ["orzen-call", "calls", filter, term], queryFn: () => fn({ data: { filter, search: term, limit: 200 } }) });
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)}
              className={`whitespace-nowrap rounded-md border px-2.5 py-1 text-xs ${filter === f.key ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>{f.label}</button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Phone or name" value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
      </div>
      <CallList rows={q.data ?? []} loading={q.isLoading} />
    </div>
  );
}

function OrderQueue({ connected }: { connected: boolean }) {
  const fn = useServerFn(getOrzenSyncStatus);
  const resendFn = useServerFn(resendOrzenOrder);
  const q = useQuery({ queryKey: ["orzen-call", "sync"], queryFn: () => fn() });
  const [busy, setBusy] = useState<string | null>(null);
  async function resend(id: string) {
    setBusy(id);
    try {
      const r: any = await resendFn({ data: { order_id: id } });
      r.ok ? toast.success(r.message) : toast.error(r.message);
    } finally { setBusy(null); }
  }
  const VV: Record<string, string> = { verified: "Confirmed by call", cancelled: "Cancelled by call", needs_agent: "Needs agent", unanswered: "Unanswered" };
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">Pending orders waiting for a call ({q.data?.pending_orders ?? "…"})</p>
        <p className="text-xs text-muted-foreground">New orders are sent to Orzen Call automatically. Use “Send again” if a call did not happen.</p>
      </div>
      {q.isLoading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> :
        !(q.data?.queue.length) ? <p className="py-6 text-center text-sm text-muted-foreground">No pending orders right now.</p> : (
        <div className="space-y-2.5">
          {q.data.queue.map((o: any) => (
            <article key={o.id} className="rounded-2xl border bg-card p-3 shadow-sm sm:p-4">
              <OrderBrief order={o.order} phone={o.phone} name={o.customer_name} invoice={o.invoice_no} date={o.created_at} />
              {o.voice_verification && <p className="mt-2 text-[11px] text-muted-foreground">{VV[o.voice_verification] ?? o.voice_verification}</p>}
              <div className="flex flex-wrap items-end justify-between gap-2">
                <OrderActions order={o.order} copyText={copyFor(o.customer_name, o.phone, o.order)} />
                <Button size="sm" disabled={!connected || busy === o.id} onClick={() => resend(o.id)}>
                  {busy === o.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}Send again
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductSync({ connected }: { connected: boolean }) {
  const qc = useQueryClient();
  const fn = useServerFn(getOrzenSyncStatus);
  const syncFn = useServerFn(syncAllOrzenProducts);
  const q = useQuery({ queryKey: ["orzen-call", "sync"], queryFn: () => fn() });
  const [busy, setBusy] = useState(false);
  async function sync() {
    setBusy(true);
    try {
      const r: any = await syncFn();
      r.ok ? toast.success(r.message) : toast.error(r.message);
      qc.invalidateQueries({ queryKey: ["orzen-call", "sync"] });
    } finally { setBusy(false); }
  }
  const d = q.data;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat icon={Package} label="Products in store" value={d?.products ?? "…"} />
        <Stat icon={RefreshCw} label="Last full sync" value={d?.last_full_sync ? fmtDate(d.last_full_sync) : "Never"} />
        <Stat icon={CheckCircle2} label="Sent in last sync" value={d?.last_full_sync_count ?? "—"} />
        <Stat icon={Clock} label="Last test ping" value={d?.last_test ? (d.last_test_ok ? "Working" : "Failed") : "—"} tone={d?.last_test ? (d.last_test_ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive") : ""} />
      </div>
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Send all products to Orzen Call</p>
          <p className="text-xs text-muted-foreground">Added or edited products sync automatically. Use this once after connecting, so the AI knows your whole catalogue.</p>
        </div>
        <Button disabled={!connected || busy} onClick={sync}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Sync All Products Now
        </Button>
      </div>
    </div>
  );
}

function Guide({ callback }: { callback: string | null }) {
  const sample = JSON.stringify({ invoice_no: "1001", status: "confirmed", call_status: "answered", call_id: "abc123", duration_sec: 42, note: "Customer wants delivery on Friday" }, null, 2);
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 text-sm">
      <p className="font-semibold">How it works</p>
      <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
        <li>Paste your Orzen Call webhook link in <b>Setup</b> and save.</li>
        <li>Copy the Callback URL from Setup into Orzen Call.</li>
        <li>Real-time events: <code className="rounded bg-muted px-1">order.created</code>, <code className="rounded bg-muted px-1">order.status_changed</code>, <code className="rounded bg-muted px-1">order.courier_updated</code>, <code className="rounded bg-muted px-1">product.created/updated/stock_out/stock_changed/deleted</code>; full catalog as <code className="rounded bg-muted px-1">products.sync</code>.</li>
        <li>After the call, Orzen Call posts the result back — the order becomes Confirmed or Cancelled and the call shows in Call History.</li>
      </ol>
      <p className="font-semibold">Callback example (sent by Orzen Call)</p>
      <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">{sample}</pre>
      <p className="text-xs text-muted-foreground">
        <b>status</b>: confirmed / cancelled (or anything else to only log the call). <b>call_status</b>: answered, no_answer, busy, failed.
        Every request we send carries an <code className="rounded bg-muted px-1">X-Orzen-Signature</code> (HMAC-SHA256 of the body using your private key).
      </p>
      {!callback && <p className="text-xs text-muted-foreground">Save Setup once to get your private Callback URL.</p>}
    </div>
  );
}
