import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Plug, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  getVoiceConnection, testVoiceToken, connectVoiceProvider, retestVoiceProvider, disconnectVoiceProvider,
  getVoiceSettings, saveVoiceSettings, type VoiceSettings,
} from "@/lib/voice.functions";

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");

export function useVoiceConnection() {
  const fn = useServerFn(getVoiceConnection);
  return useQuery({ queryKey: ["voice", "connection"], queryFn: () => fn() });
}

export function VoiceProviderPanel() {
  const qc = useQueryClient();
  const conn = useVoiceConnection();
  const testFn = useServerFn(testVoiceToken);
  const connectFn = useServerFn(connectVoiceProvider);
  const retestFn = useServerFn(retestVoiceProvider);
  const discFn = useServerFn(disconnectVoiceProvider);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const c: any = conn.data?.connection;
  const connected = c?.status === "connected";

  async function run(p: Promise<{ ok: boolean; message?: string }>) {
    setBusy(true);
    try {
      const r = await p;
      r.ok ? toast.success(r.message ?? "Done") : toast.error(r.message ?? "Failed");
      await qc.invalidateQueries({ queryKey: ["voice"] });
      return r.ok;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">ePBX</h3>
          <p className="text-xs text-muted-foreground">Connect your own ePBX account with its API token.</p>
        </div>
        {connected ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Connected</span>
        ) : c?.status === "error" ? (
          <span className="flex items-center gap-1 text-xs font-medium text-destructive"><XCircle className="h-4 w-4" /> Connection error</span>
        ) : null}
      </div>

      {connected ? (
        <div className="mt-3 space-y-3">
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <dt className="text-muted-foreground">Token</dt><dd>{c.token_preview}</dd>
            <dt className="text-muted-foreground">Connected</dt><dd>{fmt(c.connected_at)}</dd>
            <dt className="text-muted-foreground">Last test</dt><dd>{fmt(c.last_tested_at)}</dd>
            {c.account_info?.name && (<><dt className="text-muted-foreground">Account</dt><dd>{c.account_info.name}</dd></>)}
            {c.account_info?.balance != null && (<><dt className="text-muted-foreground">Balance</dt><dd>৳{c.account_info.balance}</dd></>)}
          </dl>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(retestFn())}>Test Connection</Button>
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => {
              if (confirm("Disconnect ePBX? Automated and manual calls will stop until another provider is connected.")) run(discFn());
            }}>Disconnect</Button>
          </div>
        </div>
      ) : open ? (
        <div className="mt-3 space-y-2">
          <Label htmlFor="epbx-token">ePBX API Token</Label>
          <Input id="epbx-token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy || token.length < 8} onClick={() => run(testFn({ data: { api_token: token } }))}>Test Connection</Button>
            <Button size="sm" disabled={busy || token.length < 8} onClick={async () => {
              if (await run(connectFn({ data: { api_token: token } }))) { setToken(""); setOpen(false); }
            }}>Connect</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Your token is stored encrypted and is never shown again. We never ask for your ePBX password.</p>
        </div>
      ) : (
        <Button size="sm" className="mt-3" onClick={() => setOpen(true)}><Plug className="mr-1 h-4 w-4" /> Connect ePBX</Button>
      )}
    </div>
  );
}

const MSG_LABELS: Record<string, string> = {
  greeting: "Greeting message", confirm: "Order confirmation (press 1)", cancel: "Order cancellation (press 2)",
  transfer: "Representative transfer (press 0)", no_answer: "No-answer message", busy: "Busy message", retry: "Retry message",
};

export function VoiceSettingsPanel() {
  const getFn = useServerFn(getVoiceSettings);
  const saveFn = useServerFn(saveVoiceSettings);
  const q = useQuery({ queryKey: ["voice", "settings"], queryFn: () => getFn() });
  const [f, setF] = useState<VoiceSettings | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (q.data) setF(q.data); }, [q.data]);
  if (!f) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  const set = <K extends keyof VoiceSettings>(k: K, v: VoiceSettings[K]) => setF({ ...f, [k]: v });
  const num = (v: string) => Math.max(0, parseInt(v || "0", 10) || 0);

  const Toggle = ({ k, label }: { k: keyof VoiceSettings; label: string }) => (
    <label className="flex items-center justify-between gap-3 py-1.5 text-sm">
      {label}<Switch checked={f[k] as boolean} onCheckedChange={(v) => set(k, v as any)} />
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Automation</h3>
        <Toggle k="auto_call_enabled" label="Enable automated order calling" />
        <Toggle k="call_immediately" label="Call immediately after order" />
        <div className="grid grid-cols-2 gap-3 py-2 sm:grid-cols-4">
          <div><Label className="text-xs">Delay (minutes)</Label><Input type="number" value={f.delay_minutes} onChange={(e) => set("delay_minutes", num(e.target.value))} /></div>
          <div><Label className="text-xs">Retry count</Label>
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={f.retry_count} onChange={(e) => set("retry_count", Number(e.target.value))}>
              {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select></div>
          <div><Label className="text-xs">Retry delay (minutes)</Label><Input type="number" value={f.retry_delay_minutes} onChange={(e) => set("retry_delay_minutes", Math.max(1, num(e.target.value)))} /></div>
        </div>
        <Toggle k="business_hours_only" label="Call only during business hours" />
        <div className="grid grid-cols-2 gap-3 py-2 sm:w-1/2">
          <div><Label className="text-xs">From</Label><Input type="time" value={f.hours_from} onChange={(e) => set("hours_from", e.target.value)} /></div>
          <div><Label className="text-xs">To</Label><Input type="time" value={f.hours_to} onChange={(e) => set("hours_to", e.target.value)} /></div>
        </div>
        <Toggle k="manual_calling_enabled" label="Enable manual calling" />
        <Toggle k="representative_transfer" label="Allow representative transfer" />
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Voice messages</h3>
        <div className="space-y-3">
          {Object.keys(MSG_LABELS).map((k) => (
            <div key={k}>
              <Label className="text-xs">{MSG_LABELS[k]}</Label>
              <Textarea rows={2} value={f.messages[k] ?? ""} onChange={(e) => set("messages", { ...f.messages, [k]: e.target.value })} />
            </div>
          ))}
        </div>
      </div>

      <Button disabled={saving} onClick={async () => {
        setSaving(true);
        try { await saveFn({ data: f }); toast.success("Settings saved"); } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
      }}>Save settings</Button>
    </div>
  );
}

export function ProviderManagedNote({ text }: { text: string }) {
  return <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">{text}</div>;
}
