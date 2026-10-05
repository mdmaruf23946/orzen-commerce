// Live provider panels inside AI Call Center. Everything shown comes from the
// connected provider's API; anything the API does not expose is labelled as such.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Delete, Phone, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Trash2, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getProviderOverview, listProviderCallLog, listProviderExtensions, listAutomatedOrderCalls,
} from "@/lib/voice-provider.functions";
import { startCall } from "@/lib/call-center.functions";
import { saveVoiceExtensions } from "@/lib/voice.functions";
import { formatDuration } from "@/lib/call-center";
import { CallResultDialog } from "@/components/admin/calls/CallResultDialog";

export const NOT_AVAILABLE = "Not available through the current ePBX API access.";

export function NotAvailable({ title, text = NOT_AVAILABLE }: { title: string; text?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h3 className="text-sm font-semibold">{title}</h3>{action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (<><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></>);
}

export function useProviderOverview() {
  const fn = useServerFn(getProviderOverview);
  return useQuery({
    queryKey: ["voice", "overview"], queryFn: () => fn(), staleTime: 30_000,
    refetchInterval: 5 * 60_000, refetchOnWindowFocus: true,
  });
}

function ago(iso?: string) {
  if (!iso) return "—";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : new Date(iso).toLocaleTimeString();
}

export function LowBalanceBanner() {
  const o: any = useProviderOverview().data;
  if (!o?.connected || !o.low_balance) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">Low Balance Alert — ৳{Number(o.balance).toFixed(2)}</p>
        <p className="text-xs">ব্যালেন্স ৳{o.low_balance_threshold}-এর কম। কল যাবে না — ePBX-এ রিচার্জ করুন।</p>
      </div>
    </div>
  );
}

export function AccountHubCard() {
  const q = useProviderOverview();
  const o: any = q.data;
  if (!o?.connected) return null;
  const bal = o.balance != null ? Number(o.balance) : null;
  return (
    <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-3">
      <div className="sm:col-span-1">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> Wallet balance</p>
        <p className={`mt-1 text-3xl font-bold ${o.low_balance ? "text-destructive" : ""}`}>{bal != null ? `৳ ${bal.toFixed(2)}` : "—"}</p>
        <p className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          Updated {ago(o.synced_at)}
          <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" disabled={q.isFetching} onClick={() => q.refetch()}>
            <RefreshCw className={`h-3 w-3 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">SIP trunk / Caller ID</p>
        <p className="mt-1 font-mono text-sm">{o.trunk_number ?? "—"}</p>
        {o.trunk_active
          ? <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Active</span>
          : <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive"><XCircle className="h-3 w-3" /> No active SIP trunk</span>}
        {!o.trunk_active && <p className="mt-1 text-[11px] text-muted-foreground">ePBX-কে বলে কলার আইডি/ট্রাঙ্ক চালু করিয়ে নিন।</p>}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Agent extensions</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {(o.saved_extensions?.length ? o.saved_extensions.map((e: any) => e.extension) : o.default_extension ? [o.default_extension] : []).map((x: string) => (
            <span key={x} className={`rounded-md border px-2 py-0.5 font-mono text-xs ${x === o.default_extension ? "border-primary/40 bg-primary/10 text-primary" : ""}`}>{x}</span>
          ))}
          {!o.saved_extensions?.length && !o.default_extension && <span className="text-xs text-muted-foreground">None — add in Agents tab</span>}
        </div>
      </div>
    </section>
  );
}

export function ProviderOverviewCard() {
  const q = useProviderOverview();
  const o: any = q.data;
  return (
    <Card title="Provider Overview" action={
      <Button size="sm" variant="ghost" disabled={q.isFetching} onClick={() => q.refetch()}>
        <RefreshCw className={`mr-1 h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> Sync
      </Button>}>
      {q.isLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : !o?.connected ? (
        <p className="text-xs text-muted-foreground">ePBX is not connected. Connect it in the Provider tab.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
          <Row k="Provider" v={o.provider} />
          <Row k="Status" v={o.healthy
            ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Connected</span>
            : <span className="inline-flex items-center gap-1 text-destructive"><XCircle className="h-3.5 w-3.5" /> {o.error ?? "Error"}</span>} />
          <Row k="Account" v={o.tenant ?? "—"} />
          <Row k="Wallet balance" v={o.balance != null ? `৳${o.balance}` : "—"} />
          <Row k="Trunk number" v={o.trunk_number ?? "—"} />
          <Row k="Trunk balance" v={o.trunk_balance != null ? `৳${o.trunk_balance}` : "—"} />
          <Row k="Default caller ID" v={o.default_caller_id ?? "—"} />
          <Row k="API health" v={o.healthy ? `OK · ${o.latency_ms} ms` : "Failed"} />
          <Row k="Last sync" v={new Date(o.synced_at).toLocaleTimeString()} />
          <Row k="Default extension" v={o.default_extension ?? "—"} />
        </dl>
      )}
    </Card>
  );
}

export function PhoneNumbersPanel() {
  const q = useProviderOverview();
  const o: any = q.data;
  if (q.isLoading) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  if (!o?.connected) return <NotAvailable title="Phone Numbers" text="Connect ePBX in the Provider tab to see your numbers." />;
  return (
    <div className="space-y-3">
      <Card title="Phone Numbers">
        {o.trunk_number ? (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Number</th><th>Type</th><th>Status</th><th>Default caller ID</th></tr></thead>
            <tbody><tr className="border-t">
              <td className="py-2 font-mono">{o.trunk_number}</td><td>SIP trunk</td>
              <td className="text-emerald-600 dark:text-emerald-400">Active</td>
              <td>{o.default_caller_id === o.trunk_number ? "Yes" : o.default_caller_id ? `No (using ${o.default_caller_id})` : "Not set"}</td>
            </tr></tbody>
          </table>
        ) : <p className="text-xs text-muted-foreground">ePBX did not return a trunk number for this account.</p>}
        <p className="mt-3 text-[11px] text-muted-foreground">Only numbers that belong to your ePBX account can be used as caller ID. A full list of provisioned numbers is {NOT_AVAILABLE.toLowerCase()}</p>
      </Card>
    </div>
  );
}

export function useExtensions() {
  const fn = useServerFn(listProviderExtensions);
  return useQuery({ queryKey: ["voice", "extensions"], queryFn: () => fn(), staleTime: 60_000 });
}

function ManageExtensions({ saved }: { saved: { extension: string; name?: string }[] }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveVoiceExtensions);
  const [ext, setExt] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(list: { extension: string; name?: string }[]) {
    setBusy(true);
    try { await saveFn({ data: { extensions: list } }); await qc.invalidateQueries({ queryKey: ["voice"] }); toast.success("Saved"); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Card title="My extensions">
      <ul className="mb-3 space-y-1">
        {saved.map((e) => (
          <li key={e.extension} className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
            <span><span className="font-mono">{e.extension}</span>{e.name && <span className="ml-2 text-xs text-muted-foreground">{e.name}</span>}</span>
            <Button size="icon" variant="ghost" aria-label={`Remove ${e.extension}`} disabled={busy}
              onClick={() => void save(saved.filter((x) => x.extension !== e.extension))}><Trash2 className="h-4 w-4" /></Button>
          </li>
        ))}
        {!saved.length && <li className="text-xs text-muted-foreground">No extension added yet.</li>}
      </ul>
      <div className="flex gap-2">
        <Input placeholder="101" inputMode="numeric" className="w-24 font-mono" value={ext} onChange={(e) => setExt(e.target.value.replace(/\D/g, "").slice(0, 6))} />
        <Input placeholder="Name (optional)" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <Button disabled={busy || !/^\d{2,6}$/.test(ext) || saved.length >= 20 || saved.some((x) => x.extension === ext)}
          onClick={async () => { await save([...saved, { extension: ext, ...(name.trim() ? { name: name.trim() } : {}) }]); setExt(""); setName(""); }}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Choose the default extension in the Provider tab. Online/offline status is {NOT_AVAILABLE.toLowerCase()}</p>
    </Card>
  );
}

export function AgentsPanel() {
  const q = useExtensions();
  const ov: any = useProviderOverview().data;
  const d: any = q.data;
  if (q.isLoading) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  if (!d?.connected) return <NotAvailable title="Agents / Extensions" text="Connect ePBX in the Provider tab to see your extensions." />;
  return (
    <div className="space-y-3">
    <ManageExtensions saved={ov?.saved_extensions ?? []} />
    <Card title={`Agents / Extensions (${d.extensions.length})`}>
      {d.error && <p className="mb-2 text-xs text-destructive">{d.error}</p>}
      {!d.extensions.length ? (
        <p className="text-xs text-muted-foreground">No extension found yet. Set your agent extension in the Provider tab.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Extension</th><th>Calls (30 days)</th><th>Last call</th><th></th></tr></thead>
          <tbody>{d.extensions.map((e: any) => (
            <tr key={e.extension} className="border-t">
              <td className="py-2 font-mono">{e.extension}{e.name && <span className="ml-1 font-sans text-xs text-muted-foreground">{e.name}</span>}</td><td>{e.calls}</td><td className="text-xs">{e.last_call ?? "—"}</td>
              <td>{e.is_default && <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">Default</span>}</td>
            </tr>))}
          </tbody>
        </table>
      )}
      {!d.list_supported && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Agent names, online status and the full extension list are {NOT_AVAILABLE.toLowerCase()} Extensions above come from your saved list and your recent ePBX call log.
        </p>
      )}
    </Card>
    </div>
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

export function DialPad() {
  const qc = useQueryClient();
  const callFn = useServerFn(startCall);
  const ext = useExtensions();
  const ov: any = useProviderOverview().data;
  const exts: any[] = (ext.data as any)?.extensions ?? [];
  const def = exts.find((e) => e.is_default)?.extension ?? exts[0]?.extension ?? "";
  const [num, setNum] = useState("");
  const [sel, setSel] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultFor, setResultFor] = useState<string | null>(null);
  const extension = sel || def;
  const connected = (ext.data as any)?.connected;

  async function call() {
    setBusy(true);
    try {
      const r: any = await callFn({ data: { phone: num, extension: extension || null } });
      if (r.ok) {
        toast.success(`Ringing extension ${extension} first — pick it up to connect the customer.`);
        await qc.invalidateQueries({ queryKey: ["calls"] });
        setResultFor(r.callId);
      } else toast.error(r.reason === "not_connected" ? "Connect ePBX in the Provider tab first." : r.message ?? "Call failed");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Card title="Dial Pad">
      <div className="mx-auto max-w-xs space-y-3">
        <div>
          <label className="text-xs text-muted-foreground" htmlFor="dp-ext">Agent extension</label>
          <select id="dp-ext" className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={extension}
            onChange={(e) => setSel(e.target.value)} disabled={!exts.length}>
            {!exts.length && <option value="">No extension — set one in Provider</option>}
            {exts.map((e) => <option key={e.extension} value={e.extension}>{e.extension}{e.is_default ? " (default)" : ""}</option>)}
          </select>
        </div>
        <Input value={num} inputMode="tel" placeholder="Customer number" className="h-11 text-center font-mono text-lg"
          onChange={(e) => setNum(e.target.value.replace(/[^0-9*#+]/g, "").slice(0, 16))} />
        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button key={k} type="button" onClick={() => setNum((n) => (n + k).slice(0, 16))}
              className="h-12 rounded-xl border text-lg font-semibold transition-colors hover:bg-muted">{k}</button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" onClick={() => setNum("")} disabled={!num}>Clear</Button>
          <Button disabled={busy || !connected || !extension || !/^(\+?88)?01\d{9}$/.test(num)} onClick={() => void call()}>
            <Phone className="mr-1 h-4 w-4" />{busy ? "…" : "Call"}
          </Button>
          <Button variant="outline" aria-label="Backspace" onClick={() => setNum((n) => n.slice(0, -1))} disabled={!num}>
            <Delete className="h-4 w-4" />
          </Button>
        </div>
        {ov?.connected && ov.balance != null && Number(ov.balance) <= 0 && (
          <p className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> Low Balance Alert — ব্যালেন্স ৳০, কল যাবে না।</p>
        )}
        <p className="text-[11px] text-muted-foreground">Your extension rings first. When you answer, ePBX calls the customer and connects you.</p>
      </div>
      <CallResultDialog
        open={!!resultFor}
        onOpenChange={(v) => !v && setResultFor(null)}
        callId={resultFor}
        manualStatus={true}
        phone={num}
      />
    </Card>
  );
}

const DISPO = [
  { v: "", l: "All" }, { v: "ANSWERED", l: "Answered" }, { v: "NO ANSWER", l: "No answer" },
  { v: "BUSY", l: "Busy" }, { v: "FAILED", l: "Failed" },
] as const;

export function ProviderCallLog({ recordingsOnly = false }: { recordingsOnly?: boolean }) {
  const fn = useServerFn(listProviderCallLog);
  const [direction, setDirection] = useState<"all" | "incoming" | "outgoing">("all");
  const [disposition, setDisposition] = useState<(typeof DISPO)[number]["v"]>("");
  const [phone, setPhone] = useState("");
  const [days, setDays] = useState(7);
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["voice", "cdr", direction, disposition, phone, days, page],
    queryFn: () => fn({ data: { direction, disposition, phone, days, page, extension: "" } }),
  });
  const d: any = q.data;
  const rows: any[] = (d?.rows ?? []).filter((r: any) => !recordingsOnly || r.play_url);
  const chip = (on: boolean) => `rounded-lg border px-2.5 py-1 text-xs font-medium ${on ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`;

  return (
    <Card title={recordingsOnly ? "ePBX Call Recordings" : "ePBX Call Log"} action={
      <Button size="sm" variant="ghost" disabled={q.isFetching} onClick={() => q.refetch()}>
        <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} />
      </Button>}>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {(["all", "incoming", "outgoing"] as const).map((x) => (
          <button key={x} type="button" className={`${chip(direction === x)} capitalize`} onClick={() => { setDirection(x); setPage(1); }}>{x}</button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        {DISPO.map((x) => (
          <button key={x.l} type="button" className={chip(disposition === x.v)} onClick={() => { setDisposition(x.v); setPage(1); }}>{x.l}</button>
        ))}
        <select className="h-8 rounded-md border bg-background px-2 text-xs" value={days} onChange={(e) => { setDays(Number(e.target.value)); setPage(1); }}>
          {[1, 7, 30, 90].map((n) => <option key={n} value={n}>{n === 1 ? "Today" : `Last ${n} days`}</option>)}
        </select>
        <Input className="h-8 w-40 text-xs" placeholder="Phone" value={phone} onChange={(e) => { setPhone(e.target.value.replace(/[^0-9+]/g, "")); setPage(1); }} />
      </div>
      {q.isLoading ? <p className="text-xs text-muted-foreground">Loading…</p>
        : !d?.connected ? <p className="text-xs text-muted-foreground">Connect ePBX in the Provider tab to see your call log.</p>
        : d.error ? <p className="text-xs text-destructive">{d.error}</p>
        : !rows.length ? <p className="text-xs text-muted-foreground">{recordingsOnly ? "No recordings in this period." : "No calls in this period."}</p>
        : (
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.id} className="py-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-medium capitalize">{r.direction}</span>{" "}
                    <span className="font-mono text-xs">{r.source} → {r.destination}</span>
                    <div className="text-[11px] text-muted-foreground">{r.date} · Caller ID {r.caller_id || "—"}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono">{formatDuration(r.duration_sec)}</span>
                    <span className={`rounded-full border px-2 py-0.5 ${r.disposition === "ANSWERED" ? "text-emerald-600 dark:text-emerald-400" : r.disposition === "FAILED" ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}>{r.disposition || "—"}</span>
                    <span className="text-muted-foreground">{r.play_url ? "Recording" : "No recording"}</span>
                  </div>
                </div>
                {r.play_url && <audio controls preload="none" className="mt-2 h-9 w-full" src={r.play_url} />}
              </div>
            ))}
          </div>
        )}
      {d?.last_page > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <span>{d.page} / {d.last_page}</span>
          <Button size="sm" variant="outline" disabled={page >= d.last_page} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </Card>
  );
}

const RESULT_TEXT: Record<string, string> = { order_confirmed: "Confirmed (1)", order_cancelled: "Cancelled / rejected (2)" };

export function AutomatedOrderCalls() {
  const fn = useServerFn(listAutomatedOrderCalls);
  const q = useQuery({ queryKey: ["voice", "auto-calls"], queryFn: () => fn() });
  const rows: any[] = q.data ?? [];
  return (
    <Card title="Automated Order Calls">
      {q.isLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : !rows.length ? (
        <p className="text-xs text-muted-foreground">No automated order calls yet. Turn on automated calling in Settings.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr>
              <th className="py-1">Order</th><th>Customer</th><th>Call</th><th>Result</th><th>Attempt</th><th>Retry</th><th>Time</th>
            </tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-2">{r.invoice_no ?? "—"}</td>
                <td className="text-xs">{r.customer_name ?? ""} <span className="font-mono">{r.phone}</span></td>
                <td className="text-xs capitalize">{String(r.status).replace("_", " ")}</td>
                <td className="text-xs">{RESULT_TEXT[r.result] ?? (r.status === "answered" || r.status === "completed" ? "No response" : "—")}</td>
                <td className="text-xs">{r.attempt}</td>
                <td className="text-xs">{r.retry?.next_at ? `Next ${new Date(r.retry.next_at).toLocaleTimeString()}` : r.retry?.status ?? "—"}</td>
                <td className="text-xs">{new Date(r.created_at).toLocaleString()}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function WebRtcPanel() {
  return (
    <NotAvailable title="Browser Softphone (WebRTC)"
      text={`Calling and answering from the browser needs WebRTC/SIP credentials from ePBX. This is ${NOT_AVAILABLE.toLowerCase()} Use the Dial Pad: your ePBX extension rings first, then the customer is connected.`} />
  );
}
