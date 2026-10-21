import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Phone, PhoneOff, PhoneCall, Mic, MicOff, Clock, CheckCircle2, XCircle, Plus, Trash2, Play, Settings2, History, LayoutDashboard, Delete,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  listManualLines, saveManualLine, deleteManualLine, getManualLineCredentials,
  startManualCall, updateManualCall, listManualCalls, manualRecordingUrl,
} from "@/lib/manual-call.functions";

export const Route = createFileRoute("/_authenticated/admin/manual-call")({
  component: ManualCallPage,
  head: () => ({
    meta: [
      { title: "Manual Call — ORZEN Merchant Panel" },
      { name: "description", content: "Call customers from your own phone line, with recordings and full call history." },
      { property: "og:title", content: "Manual Call — ORZEN Merchant Panel" },
      { property: "og:description", content: "Call customers from your own phone line, with recordings and full call history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const STATUS_TONE: Record<string, string> = {
  completed: "bg-primary/10 text-primary", answered: "bg-primary/10 text-primary",
  missed: "bg-destructive/10 text-destructive", failed: "bg-destructive/10 text-destructive", busy: "bg-destructive/10 text-destructive",
  dialing: "bg-muted text-muted-foreground", ringing: "bg-muted text-muted-foreground",
};

function ManualCallPage() {
  const [tab, setTab] = useState("dashboard");
  const linesQ = useQuery({ queryKey: ["manual-lines"], queryFn: useServerFn(listManualLines) as any });
  const lines: any[] = (linesQ.data as any)?.lines ?? [];
  return (
    <div className="space-y-4">
      <AdminPageHeader title="Manual Call" description="Connect your own phone line and call customers directly from the panel. Every call is saved with its recording." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:inline-grid">
          <TabsTrigger value="dashboard"><LayoutDashboard className="mr-1 h-4 w-4" />Dashboard</TabsTrigger>
          <TabsTrigger value="dialer"><Phone className="mr-1 h-4 w-4" />Dialer</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-1 h-4 w-4" />History</TabsTrigger>
          <TabsTrigger value="setup"><Settings2 className="mr-1 h-4 w-4" />Setup</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><Dashboard onDial={() => setTab("dialer")} noLine={!lines.length} onSetup={() => setTab("setup")} /></TabsContent>
        <TabsContent value="dialer"><Dialer lines={lines} storeId={(linesQ.data as any)?.storeId} onSetup={() => setTab("setup")} /></TabsContent>
        <TabsContent value="history"><CallHistory /></TabsContent>
        <TabsContent value="setup"><Setup data={linesQ.data as any} /></TabsContent>
      </Tabs>
    </div>
  );
}

function useCalls(search = "", status = "all") {
  const fn = useServerFn(listManualCalls);
  return useQuery({ queryKey: ["manual-calls", search, status], queryFn: () => fn({ data: { search, status } }) });
}

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">{label}<Icon className="h-4 w-4" /></div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Dashboard({ onDial, noLine, onSetup }: { onDial: () => void; noLine: boolean; onSetup: () => void }) {
  const q = useCalls();
  const s = q.data?.stats;
  return (
    <div className="space-y-4 pt-2">
      {noLine && (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">No phone line connected yet. Add your provider details to start calling.</p>
          <Button size="sm" onClick={onSetup}><Plus className="mr-1 h-4 w-4" />Connect a line</Button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Today" value={s?.today ?? 0} icon={PhoneCall} />
        <Stat label="Last 30 days" value={s?.total30 ?? 0} icon={Phone} />
        <Stat label="Answer rate" value={`${s?.answerRate ?? 0}%`} icon={CheckCircle2} />
        <Stat label="Missed / failed" value={s?.missed ?? 0} icon={XCircle} />
        <Stat label="Talk time" value={fmt(s?.talkSec ?? 0)} icon={Clock} />
        <Stat label="Avg. call" value={fmt(s?.avgSec ?? 0)} icon={Clock} />
      </div>
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-3">
          <h3 className="text-sm font-semibold">Recent calls</h3>
          <Button size="sm" onClick={onDial}><Phone className="mr-1 h-4 w-4" />New call</Button>
        </div>
        <CallRows calls={(q.data?.calls ?? []).slice(0, 8)} />
      </div>
    </div>
  );
}

function CallRows({ calls }: { calls: any[] }) {
  const urlFn = useServerFn(manualRecordingUrl);
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  if (!calls.length) return <p className="p-6 text-center text-sm text-muted-foreground">No calls yet.</p>;
  return (
    <div className="divide-y">
      {calls.map((c) => (
        <div key={c.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{c.customer_name || c.phone}</div>
            <div className="text-xs text-muted-foreground">{c.customer_name ? `${c.phone} · ` : ""}{new Date(c.started_at).toLocaleString()}</div>
            {c.notes && <div className="mt-1 text-xs">{c.notes}</div>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={STATUS_TONE[c.status] ?? ""}>{c.status}</Badge>
            <span className="w-12 text-right text-xs tabular-nums">{fmt(c.duration_sec || 0)}</span>
            {c.recording_path && (
              <Button size="icon" variant="ghost" aria-label="Play recording" onClick={async () => {
                try { const r = await urlFn({ data: { id: c.id } }); setPlaying({ id: c.id, url: r.url }); } catch (e: any) { toast.error(e.message); }
              }}><Play className="h-4 w-4" /></Button>
            )}
          </div>
          {playing?.id === c.id && <audio className="w-full sm:w-64" src={playing?.url} controls autoPlay />}
        </div>
      ))}
    </div>
  );
}

function CallHistory() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const q = useCalls(search, status);
  return (
    <div className="space-y-3 pt-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Search number or name" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "completed", "missed", "failed", "busy"].map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All calls" : s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-xl border bg-card"><CallRows calls={q.data?.calls ?? []} /></div>
    </div>
  );
}

function Dialer({ lines, storeId, onSetup }: { lines: any[]; storeId?: string; onSetup: () => void }) {
  const qc = useQueryClient();
  const credsFn = useServerFn(getManualLineCredentials);
  const startFn = useServerFn(startManualCall);
  const updFn = useServerFn(updateManualCall);
  const [lineId, setLineId] = useState<string>("");
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<string>("idle");
  const [muted, setMuted] = useState(false);
  const [secs, setSecs] = useState(0);
  const [notes, setNotes] = useState("");
  const [lastCall, setLastCall] = useState<string | null>(null);
  const phone = useRef<any>(null);
  const callId = useRef<string | null>(null);
  const answeredAt = useRef<number>(0);

  useEffect(() => { if (!lineId && lines.length) setLineId((lines.find((l) => l.is_default) ?? lines[0]).id); }, [lines, lineId]);
  useEffect(() => {
    if (state !== "answered") return;
    const t = setInterval(() => setSecs(Math.round((Date.now() - answeredAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [state]);

  if (!lines.length) return (
    <div className="mt-2 rounded-xl border border-dashed p-6 text-center">
      <p className="text-sm">Connect a phone line first.</p>
      <Button className="mt-3" size="sm" onClick={onSetup}>Go to Setup</Button>
    </div>
  );

  const busy = ["connecting", "ringing", "answered"].includes(state);

  async function call() {
    if (number.replace(/\D/g, "").length < 3) return toast.error("Enter a phone number");
    setState("connecting"); setSecs(0); setNotes(""); setLastCall(null);
    try {
      const creds = await credsFn({ data: { id: lineId } });
      const row = await startFn({ data: { line_id: lineId, phone: number, customer_name: name || null } });
      callId.current = row.id;
      const { placeCall } = await import("@/lib/manual-call-phone");
      phone.current = await placeCall(creds, number, {
        onState: (s, info) => {
          setState(s);
          const id = callId.current!;
          if (s === "ringing") updFn({ data: { id, status: "ringing" } });
          if (s === "answered") { answeredAt.current = Date.now(); updFn({ data: { id, status: "answered", answered: true } }); }
          if (s === "ended" || s === "failed") {
            const dur = answeredAt.current ? Math.round((Date.now() - answeredAt.current) / 1000) : 0;
            const status = answeredAt.current ? "completed" : /busy/i.test(info ?? "") ? "busy" : s === "failed" ? "failed" : "missed";
            answeredAt.current = 0;
            if (s === "failed" && info) toast.error(`Call ended: ${info}`);
            updFn({ data: { id, status, ended: true, duration_sec: dur } }).then(() => qc.invalidateQueries({ queryKey: ["manual-calls"] }));
            setLastCall(id);
            setState("idle");
          }
        },
        onRecording: async (blob) => {
          const id = callId.current; if (!id || !storeId) return;
          const path = `manual/${storeId}/${id}.webm`;
          const { error } = await supabase.storage.from("voice-audio").upload(path, blob, { contentType: "audio/webm", upsert: true });
          if (!error) { await updFn({ data: { id, recording_path: path } }); qc.invalidateQueries({ queryKey: ["manual-calls"] }); }
        },
      });
    } catch (e: any) {
      toast.error(e.message ?? "Could not start the call");
      if (callId.current) updFn({ data: { id: callId.current, status: "failed", ended: true } });
      setState("idle");
    }
  }

  const press = (k: string) => { if (busy) phone.current?.dtmf(k); else setNumber((n) => n + k); };

  return (
    <div className="mx-auto mt-2 grid max-w-3xl gap-4 md:grid-cols-2">
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="space-y-1">
          <Label>Line</Label>
          <Select value={lineId} onValueChange={setLineId} disabled={busy}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{lines.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}{l.caller_number ? ` (${l.caller_number})` : ""}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Customer name (optional)</Label><Input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} /></div>
        <div className="flex gap-2">
          <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" className="text-lg tracking-wider" disabled={busy} />
          <Button variant="ghost" size="icon" aria-label="Delete digit" onClick={() => setNumber((n) => n.slice(0, -1))} disabled={busy}><Delete className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (
            <Button key={k} variant="outline" className="h-12 text-lg" onClick={() => press(k)}>{k}</Button>
          ))}
        </div>
        {busy ? (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { phone.current?.mute(!muted); setMuted(!muted); }}>
              {muted ? <MicOff className="mr-1 h-4 w-4" /> : <Mic className="mr-1 h-4 w-4" />}{muted ? "Unmute" : "Mute"}
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => phone.current?.hangup()}><PhoneOff className="mr-1 h-4 w-4" />End</Button>
          </div>
        ) : (
          <Button className="h-12 w-full" onClick={call}><Phone className="mr-2 h-5 w-5" />Call</Button>
        )}
      </div>
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 text-center">
        <div className={`flex h-20 w-20 items-center justify-center rounded-full ${busy ? "animate-pulse bg-primary/15" : "bg-muted"}`}>
          <PhoneCall className="h-8 w-8 text-primary" />
        </div>
        <div className="text-lg font-semibold">{name || number || "Ready"}</div>
        <div className="text-sm text-muted-foreground">
          {state === "connecting" && "Connecting…"}{state === "ringing" && "Ringing…"}{state === "answered" && fmt(secs)}{state === "idle" && "Enter a number and press Call"}
        </div>
        {lastCall && (
          <div className="w-full space-y-2 text-left">
            <Label>Call note</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Customer confirmed order" />
            <Button size="sm" variant="outline" onClick={async () => { await updFn({ data: { id: lastCall, notes } }); toast.success("Note saved"); qc.invalidateQueries({ queryKey: ["manual-calls"] }); }}>Save note</Button>
          </div>
        )}
      </div>
    </div>
  );
}

const EMPTY = { id: undefined as string | undefined, gateway_id: "", label: "My line", caller_number: "", sip_username: "", sip_password: "", extension: "", is_default: true, record_calls: true };

function Setup({ data }: { data?: { lines: any[]; gateways: any[] } }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveManualLine);
  const delFn = useServerFn(deleteManualLine);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const gateways = data?.gateways ?? [];
  const set = (k: string, v: any) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const gw = gateways.find((g) => g.id === form?.gateway_id);

  return (
    <div className="space-y-3 pt-2">
      {(data?.lines ?? []).map((l) => (
        <div key={l.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <Phone className="h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{l.label} {l.is_default && <Badge variant="secondary">Default</Badge>}</div>
            <div className="text-xs text-muted-foreground">{gateways.find((g) => g.id === l.gateway_id)?.name ?? "Gateway"} · {l.sip_username}{l.extension ? ` · ext ${l.extension}` : ""}</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setForm({ ...EMPTY, ...l, caller_number: l.caller_number ?? "", extension: l.extension ?? "" })}>Edit</Button>
          <Button size="icon" variant="ghost" aria-label="Remove line" onClick={async () => { await delFn({ data: { id: l.id } }); qc.invalidateQueries({ queryKey: ["manual-lines"] }); }}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      {!form && <Button onClick={() => setForm({ ...EMPTY, gateway_id: gateways[0]?.id ?? "" })} disabled={!gateways.length}><Plus className="mr-1 h-4 w-4" />Add phone line</Button>}
      {!gateways.length && <p className="text-sm text-muted-foreground">No calling gateway is available yet. Please check back soon.</p>}
      {form && (
        <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Provider / gateway</Label>
            <Select value={form.gateway_id} onValueChange={(v) => set("gateway_id", v)}>
              <SelectTrigger><SelectValue placeholder="Choose provider" /></SelectTrigger>
              <SelectContent>{gateways.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
            {gw?.help_text && <p className="text-xs text-muted-foreground">{gw.help_text}</p>}
          </div>
          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground sm:col-span-2">
            Zadarma: open Settings → SIP connection. Your SIP login is a 6-digit number (for a PBX extension use the full login, e.g. 123456-100). A caller number is optional — without a purchased number the call shows the provider's default number.
          </div>
          <div className="space-y-1"><Label>Line name</Label><Input value={form.label} onChange={(e) => set("label", e.target.value)} /></div>
          <div className="space-y-1"><Label>Caller number (optional)</Label><Input value={form.caller_number} onChange={(e) => set("caller_number", e.target.value)} placeholder="Leave empty if you have none" /></div>
          <div className="space-y-1"><Label>SIP login / username</Label><Input value={form.sip_username} onChange={(e) => set("sip_username", e.target.value)} placeholder="e.g. 123456" autoComplete="off" /></div>
          <div className="space-y-1"><Label>SIP password</Label><Input type="password" value={form.sip_password} onChange={(e) => set("sip_password", e.target.value)} autoComplete="new-password" placeholder={form.id ? "Leave as is to keep" : ""} /></div>
          <div className="space-y-1"><Label>PBX extension (optional)</Label><Input value={form.extension} onChange={(e) => set("extension", e.target.value)} placeholder="e.g. 100" /></div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.record_calls} onCheckedChange={(v) => set("record_calls", v)} />Record calls</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_default} onCheckedChange={(v) => set("is_default", v)} />Default line</label>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button onClick={async () => {
              try {
                await saveFn({ data: { ...form, caller_number: form.caller_number || null, extension: form.extension || null, sip_password: form.sip_password || undefined } });
                toast.success("Line saved"); setForm(null); qc.invalidateQueries({ queryKey: ["manual-lines"] });
              } catch (e: any) { toast.error(e.message); }
            }}>Save line</Button>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
