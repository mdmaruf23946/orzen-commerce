import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Phone, PhoneOff, PhoneCall, Mic, MicOff, Pause, Play, Delete, History, Settings2, Wrench, Plus, Trash2, Pencil } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addHistory, patchHistory, getSettings, withinHours, providerName, removeConfig, saveConfig, saveSettings, type CallLog, type CallSettings, type ProviderConfig , sipLogin, lineName } from "@/lib/call-providers";
import { supabase } from "@/integrations/supabase/client";
import { listManualLines, listManualCalls, saveCallLog } from "@/lib/manual-call.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";

function Recording({ row }: { row: CallLog }) {
  const [src, setSrc] = useState<string | null>(null);
  if (src) return <audio src={src} controls autoPlay className="h-8 w-48" />;
  if (!row.recordingPath && !row.recordingUrl) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <Button size="sm" variant="outline" onClick={async () => {
      if (row.recordingPath) {
        const { data } = await supabase.storage.from("voice-audio").createSignedUrl(row.recordingPath, 600);
        if (data?.signedUrl) return setSrc(data.signedUrl);
      }
      if (row.recordingUrl) setSrc(row.recordingUrl); else toast.error("Could not load the recording");
    }}><Play className="mr-1 h-4 w-4" />Play</Button>
  );
}
import { useCallStore } from "@/components/admin/calls/useCallStore";
import { ConnectProviderDialog } from "@/components/admin/calls/ConnectProviderDialog";

export const Route = createFileRoute("/_authenticated/admin/manual-call")({
  component: CallsHub,
  validateSearch: (s: Record<string, unknown>) => ({ tab: typeof s.tab === "string" ? s.tab : undefined }),
  head: () => ({
    meta: [
      { title: "Calls Hub — ORZEN Merchant Panel" },
      { name: "description", content: "Dial customers, see call history, manage providers and call settings in one place." },
      { property: "og:title", content: "Calls Hub — ORZEN Merchant Panel" },
      { property: "og:description", content: "Dial customers, see call history, manage providers and call settings in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const TONE: Record<string, string> = { completed: "bg-primary/10 text-primary", missed: "bg-destructive/10 text-destructive", failed: "bg-destructive/10 text-destructive", busy: "bg-muted text-muted-foreground" };

function CallsHub() {
  const [tab, setTab] = useState(Route.useSearch().tab || "dialer");
  const store = useCallStore();
  const list = Object.values(store.configs);
  return (
    <div className="space-y-4">
      <AdminPageHeader title="Calls Hub" description="All your connected call providers in one dashboard." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4 sm:inline-grid sm:w-auto">
          <TabsTrigger value="dialer"><Phone className="mr-1 h-4 w-4" />Dialer</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-1 h-4 w-4" />History</TabsTrigger>
          <TabsTrigger value="setup"><Wrench className="mr-1 h-4 w-4" />Setup</TabsTrigger>
          <TabsTrigger value="settings"><Settings2 className="mr-1 h-4 w-4" />Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="dialer"><Dialer list={list} record={store.settings.record} /></TabsContent>
        <TabsContent value="history"><HistoryTab /></TabsContent>
        <TabsContent value="setup"><SetupTab list={list} /></TabsContent>
        <TabsContent value="settings"><SettingsTab s={store.settings} /></TabsContent>
      </Tabs>
    </div>
  );
}

function NoProvider() {
  return (
    <div className="mt-2 rounded-xl border border-dashed p-8 text-center">
      <p className="text-sm">No provider connected yet.</p>
      <Button asChild size="sm" className="mt-3"><Link to="/admin/manual-call/apps">Go to Call Apps</Link></Button>
    </div>
  );
}

function Dialer({ list, record }: { list: ProviderConfig[]; record: boolean }) {
  const [pid, setPid] = useState("");
  const [extSel, setExtSel] = useState("");
  const [num, setNum] = useState("");
  const [state, setState] = useState<"idle" | "connecting" | "ringing" | "answered">("idle");
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [secs, setSecs] = useState(0);
  const phone = useRef<any>(null);
  const t0 = useRef(0);

  useEffect(() => { if (!list.find((c) => c.id === pid) && list[0]) setPid(list[0].id); }, [list, pid]);
  useEffect(() => {
    if (state !== "answered") return;
    const t = setInterval(() => setSecs(Math.round((Date.now() - t0.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [state]);

  const callId = useRef("");
  const qc = useQueryClient();
  if (!list.length) return <NoProvider />;
  const cfg = list.find((c) => c.id === pid) ?? list[0];
  const exts = cfg.extensions ?? [];
  const ext = exts.find((e) => e.ext === extSel) ?? exts[0];
  const busy = state !== "idle";

  const log = (status: "completed" | "missed" | "failed" | "busy") => {
    const entry = { id: callId.current || crypto.randomUUID(), at: new Date().toISOString(), number: num, providerId: cfg.providerId, durationSec: t0.current ? Math.round((Date.now() - t0.current) / 1000) : 0, status };
    addHistory(entry);
    saveCallLog({ data: { id: entry.id, phone: entry.number, provider_id: entry.providerId, status, duration_sec: entry.durationSec } })
      .then(() => qc.invalidateQueries({ queryKey: ["manual-calls"] }))
      .catch(() => toast.error("Call history could not be saved to your account"));
    t0.current = 0; setState("idle"); setMuted(false); setHeld(false);
  };

  async function saveRecording(id: string, blob: Blob) {
    // Instant local playback, then permanent upload to the store's private folder.
    patchHistory(id, { recordingUrl: URL.createObjectURL(blob) });
    try {
      const { storeId } = await listManualLines();
      const path = `manual/${storeId}/${id}.webm`;
      const { error } = await supabase.storage.from("voice-audio").upload(path, blob, { contentType: "audio/webm", upsert: true });
      if (error) throw error;
      patchHistory(id, { recordingPath: path });
      await saveCallLog({ data: { id, phone: num, provider_id: cfg.providerId, recording_path: path } });
      qc.invalidateQueries({ queryKey: ["manual-calls"] });
      toast.success("Call recording saved");
    } catch { toast.error("Recording could not be uploaded — it is playable on this browser only."); }
  }

  async function call() {
    if (num.replace(/\D/g, "").length < 3) return toast.error("Enter a phone number");
    if (cfg.transport !== "WSS") return toast.error("Browser calling needs WSS transport. Change it in Setup.");
    if (!withinHours(getSettings())) return toast.error("Outside business hours. Change it in Settings.");
    const id = crypto.randomUUID();
    callId.current = id;
    setState("connecting"); setSecs(0);
    try {
      const { placeCall } = await import("@/lib/manual-call-phone");
      phone.current = await placeCall(
        { wss_url: cfg.wsUrl || `wss://${cfg.host}`, sip_domain: cfg.host, ...sipLogin(cfg, ext), caller_number: cfg.callerId, record },
        `${cfg.prefix ?? ""}${num}`,
        {
          onState: (s, info) => {
            if (s === "ringing") setState("ringing");
            if (s === "answered") { t0.current = Date.now(); setState("answered"); }
            if (s === "ended") log(t0.current ? "completed" : "missed");
            if (s === "failed") { if (info) toast.error(`Call ended: ${info}`); log(/busy/i.test(info ?? "") ? "busy" : "failed"); }
          },
          onRecording: (blob) => { void saveRecording(id, blob); },
        },
      );
    } catch (e: any) { toast.error(e.message ?? "Could not start the call"); log("failed"); }
  }
  const press = (k: string) => (busy ? phone.current?.dtmf(k) : setNum((n) => n + k));

  return (
    <div className="mt-2 grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="space-y-1">
          <Label>Number / Line</Label>
          <Select value={cfg.id} onValueChange={(v) => { setPid(v); setExtSel(""); }} disabled={busy}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{list.map((c) => <SelectItem key={c.id} value={c.id}>{lineName(c)} ({c.callerId})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {exts.length > 0 && (
          <div className="space-y-1">
            <Label>Extension</Label>
            <Select value={ext?.ext} onValueChange={setExtSel} disabled={busy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{exts.map((e) => <SelectItem key={e.ext} value={e.ext}>{e.ext}{e.name ? ` · ${e.name}` : ""}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">একসাথে একাধিক কল করতে প্রতিটি কম্পিউটার/ব্রাউজারে আলাদা Extension বেছে নিন।</p>
          </div>
        )}
        <div className="flex gap-2">
          <Input value={num} onChange={(e) => setNum(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" className="h-12 text-lg tracking-wider" disabled={busy} />
          <Button variant="ghost" size="icon" className="h-12 w-12" aria-label="Delete digit" onClick={() => setNum((n) => n.slice(0, -1))} disabled={busy}><Delete className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => <Button key={k} variant="outline" className="h-12 text-lg" onClick={() => press(k)}>{k}</Button>)}
        </div>
        {busy ? (
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => { phone.current?.mute(!muted); setMuted(!muted); }}>{muted ? <MicOff className="mr-1 h-4 w-4" /> : <Mic className="mr-1 h-4 w-4" />}{muted ? "Unmute" : "Mute"}</Button>
            <Button variant="outline" onClick={() => { phone.current?.mute(!held); setHeld(!held); }}>{held ? <Play className="mr-1 h-4 w-4" /> : <Pause className="mr-1 h-4 w-4" />}{held ? "Resume" : "Hold"}</Button>
            <Button variant="destructive" onClick={() => phone.current?.hangup()}><PhoneOff className="mr-1 h-4 w-4" />End</Button>
          </div>
        ) : (
          <Button className="h-12 w-full" onClick={call}><Phone className="mr-2 h-5 w-5" />Call</Button>
        )}
      </div>
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 text-center">
        <div className={`flex h-24 w-24 items-center justify-center rounded-full ${busy ? "animate-pulse bg-primary/15" : "bg-muted"}`}><PhoneCall className="h-10 w-10 text-primary" /></div>
        <div className="text-xl font-semibold">{num || "Ready"}</div>
        <Badge variant="secondary">{state === "idle" ? "Idle" : state === "connecting" ? "Connecting…" : state === "ringing" ? "Ringing…" : held ? "On hold" : "In call"}</Badge>
        {state === "answered" && <div className="text-3xl font-semibold tabular-nums">{fmt(secs)}</div>}
        <div className="text-xs text-muted-foreground">Via {lineName(cfg)} · {cfg.callerId}{ext ? ` · ext ${ext.ext}` : ""}</div>
      </div>
    </div>
  );
}

function HistoryTab() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["manual-calls"], queryFn: () => listManualCalls({ data: {} }) });
  const rows: CallLog[] = (data?.calls ?? []).map((c: any) => ({
    id: c.id, at: c.started_at, number: c.phone,
    providerId: String(c.notes ?? "").startsWith("provider:") ? String(c.notes).slice(9) : "custom",
    durationSec: c.duration_sec ?? 0, status: c.status, recordingPath: c.recording_path ?? undefined,
  }));
  if (isLoading) return <div className="mt-2 p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  const shown = rows.filter((r) => r.number.includes(q.trim()));
  return (
    <div className="mt-2 space-y-3">
      <Input placeholder="Search number" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-xs" />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Provider</TableHead><TableHead>Duration</TableHead><TableHead>Status</TableHead><TableHead>Recording</TableHead></TableRow></TableHeader>
          <TableBody>
            {shown.length ? shown.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-xs">{new Date(r.at).toLocaleString()}</TableCell>
                <TableCell className="font-medium">{r.number}</TableCell>
                <TableCell>{providerName(r.providerId)}</TableCell>
                <TableCell className="tabular-nums">{fmt(r.durationSec)}</TableCell>
                <TableCell><Badge variant="secondary" className={TONE[r.status]}>{r.status}</Badge></TableCell>
                <TableCell><Recording row={r} /></TableCell>
              </TableRow>
            )) : <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No calls yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SetupTab({ list }: { list: ProviderConfig[] }) {
  const [edit, setEdit] = useState<ProviderConfig | null>(null);
  if (!list.length) return <NoProvider />;
  return (
    <div className="mt-2 space-y-3">
      <div className="flex justify-end"><Button asChild size="sm" variant="outline"><Link to="/admin/manual-call/apps"><Plus className="mr-1 h-4 w-4" />Add number</Link></Button></div>
      {list.map((c) => (
        <div key={c.id} className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <PhoneCall className="h-5 w-5 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{lineName(c)} <Badge variant="secondary">{c.callerId}</Badge></div>
              <div className="text-xs text-muted-foreground">{c.host} · {(c.extensions?.length ?? 0)} extension = একসাথে {Math.max(1, c.extensions?.length ?? 0)}টি কল</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEdit(c)}><Pencil className="mr-1 h-4 w-4" />Edit / Extensions</Button>
            <Button size="icon" variant="ghost" aria-label="Disconnect" onClick={() => { removeConfig(c.id); toast.success("Disconnected"); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
          {!!c.extensions?.length && (
            <div className="flex flex-wrap gap-2">
              {c.extensions.map((e) => <Badge key={e.ext} variant="outline" className="font-mono">{e.ext}{e.name ? ` · ${e.name}` : ""}</Badge>)}
            </div>
          )}
        </div>
      ))}
      <ConnectProviderDialog providerId={edit?.providerId ?? null} lineId={edit?.id ?? null} onClose={() => setEdit(null)} />
    </div>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function SettingsTab({ s }: { s: CallSettings }) {
  const up = (p: Partial<CallSettings>) => saveSettings({ ...s, ...p });
  return (
    <div className="mt-2 max-w-xl space-y-3">
      <label className="flex items-center justify-between rounded-xl border bg-card p-4">
        <span><span className="block font-medium">Call Recording</span><span className="text-xs text-muted-foreground">Record every call made from the dialer</span></span>
        <Switch checked={s.record} onCheckedChange={(v) => up({ record: v })} />
      </label>
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <label className="flex items-center justify-between">
          <span><span className="block font-medium">Business Hours</span><span className="text-xs text-muted-foreground">Only allow calls during these hours</span></span>
          <Switch checked={s.hoursOn} onCheckedChange={(v) => up({ hoursOn: v })} />
        </label>
        {s.hoursOn && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Start</Label><Input type="time" value={s.start} onChange={(e) => up({ start: e.target.value })} /></div>
              <div className="space-y-1"><Label>End</Label><Input type="time" value={s.end} onChange={(e) => up({ end: e.target.value })} /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d, i) => (
                <Button key={d} size="sm" variant={s.days.includes(i) ? "default" : "outline"} onClick={() => up({ days: s.days.includes(i) ? s.days.filter((x) => x !== i) : [...s.days, i] })}>{d}</Button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
