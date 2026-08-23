import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, Mic, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getAiCallConfig, saveElevenLabsSettings, saveTwilioSettings, testAiProvider, listVoices, listTones,
} from "@/lib/ai-call-center.functions";
import { PROVIDER_STATE_LABEL, type ProviderState } from "@/lib/ai-call-center";

function StatusPill({ state }: { state: ProviderState }) {
  const tone =
    state === "connected"
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      : state === "error"
        ? "bg-destructive/10 text-destructive border-destructive/20"
        : "bg-amber-500/10 text-amber-600 border-amber-500/20";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone}`}>
      {PROVIDER_STATE_LABEL[state]}
    </span>
  );
}

export function ProvidersTab() {
  const qc = useQueryClient();
  const getCfg = useServerFn(getAiCallConfig);
  const saveEl = useServerFn(saveElevenLabsSettings);
  const saveTw = useServerFn(saveTwilioSettings);
  const testFn = useServerFn(testAiProvider);
  const voicesFn = useServerFn(listVoices);
  const tonesFn = useServerFn(listTones);

  const cfg = useQuery({ queryKey: ["ai-call", "config"], queryFn: () => getCfg() });
  const voices = useQuery({ queryKey: ["ai-call", "voices"], queryFn: () => voicesFn() });
  const tones = useQuery({ queryKey: ["ai-call", "tones"], queryFn: () => tonesFn() });

  const c: any = cfg.data ?? {};
  const [el, setEl] = useState({ api_key: "", webhook_secret: "" });
  const [tw, setTw] = useState({ account_sid: "", auth_token: "" });
  const [elForm, setElForm] = useState<any>(null);
  const [twForm, setTwForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const elValues = elForm ?? {
    default_voice_id: c.default_voice_id ?? null,
    default_tone_id: c.default_tone_id ?? null,
    default_language: c.default_language ?? "en",
    default_gender: c.default_gender ?? "female",
    default_instructions: c.default_instructions ?? "",
  };
  const twValues = twForm ?? {
    default_caller_id: c.default_caller_id ?? "",
    calling_region: c.calling_region ?? "us1",
  };

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["ai-call", "config"] });
  }

  async function run(fn: () => Promise<any>, ok: string) {
    setBusy(true);
    try {
      const res = await fn();
      if (res?.ok === false) toast.error(res.error ?? "Something went wrong");
      else toast.success(ok);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ElevenLabs */}
      <section className="rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">ElevenLabs Settings</h2>
            <StatusPill state={(c.elevenlabs_status ?? "not_connected") as ProviderState} />
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void run(() => testFn({ data: { provider: "elevenlabs" } }), "ElevenLabs connection successful")}
          >
            Test Connection
          </Button>
        </div>
        {c.elevenlabs_last_error && (
          <p className="mt-2 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
            {c.elevenlabs_last_error}
          </p>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-xs">API Key</Label>
            <Input
              type="password"
              className="mt-1 h-9"
              autoComplete="new-password"
              value={el.api_key}
              onChange={(e) => setEl({ ...el, api_key: e.target.value })}
              placeholder={c.elevenlabs_preview ? `${c.elevenlabs_preview} saved` : "sk_…"}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Post-call Webhook Secret</Label>
            <Input
              type="password"
              className="mt-1 h-9"
              autoComplete="new-password"
              value={el.webhook_secret}
              onChange={(e) => setEl({ ...el, webhook_secret: e.target.value })}
              placeholder="wsec_…"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Webhook URL: <code className="break-all">/api/public/ai-calls/webhook</code>
            </p>
          </div>
          <div>
            <Label className="text-xs">Default Voice</Label>
            <Select
              value={elValues.default_voice_id ?? "none"}
              onValueChange={(v) => setElForm({ ...elValues, default_voice_id: v === "none" ? null : v })}
            >
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {(voices.data ?? []).map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Default Tone</Label>
            <Select
              value={elValues.default_tone_id ?? "none"}
              onValueChange={(v) => setElForm({ ...elValues, default_tone_id: v === "none" ? null : v })}
            >
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {(tones.data ?? []).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Default Language</Label>
            <Input
              className="mt-1 h-9"
              value={elValues.default_language}
              onChange={(e) => setElForm({ ...elValues, default_language: e.target.value })}
              placeholder="en"
            />
          </div>
          <div>
            <Label className="text-xs">Default Gender</Label>
            <Select
              value={elValues.default_gender}
              onValueChange={(v) => setElForm({ ...elValues, default_gender: v })}
            >
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Default System Instructions</Label>
            <Textarea
              className="mt-1 min-h-28"
              value={elValues.default_instructions}
              onChange={(e) => setElForm({ ...elValues, default_instructions: e.target.value })}
              placeholder="How every AI agent should behave on the phone…"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Stored encrypted, never sent to the browser.
          </p>
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const res = await saveEl({ data: { ...el, ...elValues } });
                setEl({ api_key: "", webhook_secret: "" });
                setElForm(null);
                return res;
              }, "ElevenLabs settings saved")
            }
          >
            Save
          </Button>
        </div>
      </section>

      {/* Twilio */}
      <section className="rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Twilio Settings</h2>
            <StatusPill state={(c.twilio_status ?? "not_connected") as ProviderState} />
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void run(() => testFn({ data: { provider: "twilio" } }), "Twilio connection successful")}
          >
            Test Connection
          </Button>
        </div>
        {c.twilio_last_error && (
          <p className="mt-2 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
            {c.twilio_last_error}
          </p>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Account SID</Label>
            <Input
              className="mt-1 h-9"
              value={tw.account_sid}
              onChange={(e) => setTw({ ...tw, account_sid: e.target.value })}
              placeholder={c.twilio_preview ? `${c.twilio_preview} saved` : "AC…"}
            />
          </div>
          <div>
            <Label className="text-xs">Auth Token</Label>
            <Input
              type="password"
              className="mt-1 h-9"
              autoComplete="new-password"
              value={tw.auth_token}
              onChange={(e) => setTw({ ...tw, auth_token: e.target.value })}
              placeholder={c.twilio_preview ? "•••••••• saved" : "Auth token"}
            />
          </div>
          <div>
            <Label className="text-xs">Default Caller ID</Label>
            <Input
              className="mt-1 h-9"
              value={twValues.default_caller_id}
              onChange={(e) => setTwForm({ ...twValues, default_caller_id: e.target.value })}
              placeholder="+8801XXXXXXXXX"
            />
          </div>
          <div>
            <Label className="text-xs">Calling Region</Label>
            <Input
              className="mt-1 h-9"
              value={twValues.calling_region}
              onChange={(e) => setTwForm({ ...twValues, calling_region: e.target.value })}
              placeholder="us1"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Credentials stay server-side.
          </p>
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const res = await saveTw({ data: { ...tw, ...twValues } });
                setTw({ account_sid: "", auth_token: "" });
                setTwForm(null);
                return res;
              }, "Twilio settings saved")
            }
          >
            Save
          </Button>
        </div>
      </section>
    </div>
  );
}
