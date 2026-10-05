// Call Script editor: TTS template with tags, confirm/cancel text, three MP3 slots,
// press-2 behaviour, confirmation SMS and retry choices. Edits the parent settings form.
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Play, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getCallScriptContext, type VoiceSettings } from "@/lib/voice.functions";
import { TTS_TAGS, fillTemplate } from "@/lib/voice/types";

type Set = <K extends keyof VoiceSettings>(k: K, v: VoiceSettings[K]) => void;

function AudioSlot({ label, value, onChange, storeId, kind }: {
  label: string; value: string; onChange: (v: string) => void; storeId?: string; kind: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const isUpload = value.startsWith("storage:");

  async function upload(f: File) {
    if (!storeId) return;
    if (!/\.mp3$/i.test(f.name) && f.type !== "audio/mpeg") return toast.error("Only MP3 files are allowed.");
    if (f.size > 5 * 1024 * 1024) return toast.error("The file must be 5 MB or smaller.");
    setBusy(true);
    const path = `${storeId}/${kind}-${Date.now()}.mp3`;
    const { error } = await supabase.storage.from("voice-audio").upload(path, f, { contentType: "audio/mpeg" });
    setBusy(false);
    if (error) return toast.error("Upload failed. Please try again.");
    onChange(`storage:${path}`);
    toast.success("Audio uploaded — remember to save.");
  }

  async function play() {
    let src = value;
    if (isUpload) {
      const { data } = await supabase.storage.from("voice-audio").createSignedUrl(value.slice(8), 600);
      if (!data?.signedUrl) return toast.error("Could not load the audio.");
      src = data.signedUrl;
    }
    new Audio(src).play().catch(() => toast.error("Could not play this audio."));
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input placeholder="https://… .mp3 (optional)" value={isUpload ? "Uploaded MP3" : value} readOnly={isUpload}
          onChange={(e) => onChange(e.target.value.trim())} />
        <input ref={fileRef} type="file" accept="audio/mpeg,.mp3" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        <Button type="button" size="icon" variant="outline" aria-label={`Upload ${label}`} disabled={busy || !storeId} onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="outline" aria-label={`Play ${label}`} disabled={!value} onClick={() => void play()}>
          <Play className="h-4 w-4" />
        </Button>
        {value && (
          <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${label}`} onClick={() => onChange("")}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function CallScriptPanel({ f, set }: { f: VoiceSettings; set: Set }) {
  const ctxFn = useServerFn(getCallScriptContext);
  const ctx = useQuery({ queryKey: ["voice", "script-ctx"], queryFn: () => ctxFn() });
  const c = ctx.data;
  const taRef = useRef<HTMLTextAreaElement>(null);

  function insertTag(tag: string) {
    const el = taRef.current;
    const t = f.tts_template;
    const s = el?.selectionStart ?? t.length, e = el?.selectionEnd ?? t.length;
    set("tts_template", (t.slice(0, s) + tag + t.slice(e)).slice(0, 600));
  }

  const Toggle = ({ k, label, hint }: { k: keyof VoiceSettings; label: string; hint?: string }) => (
    <label className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span>{label}{hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}</span>
      <Switch checked={f[k] as boolean} onCheckedChange={(v) => set(k, v as any)} />
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Call Script</h3>
        <Label className="text-xs">What the customer hears (TTS template)</Label>
        <Textarea ref={taRef} rows={3} value={f.tts_template} maxLength={600} onChange={(e) => set("tts_template", e.target.value)} />
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {TTS_TAGS.map((t) => (
            <button key={t} type="button" onClick={() => insertTag(t)}
              className="rounded-full border px-2 py-0.5 font-mono text-[11px] hover:bg-muted">{t}</button>
          ))}
        </div>
        {c && (
          <p className="mt-2 rounded-lg bg-muted/50 p-2 text-xs"><span className="font-medium">Preview: </span>{fillTemplate(f.tts_template, c.sample)}</p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><Label className="text-xs">After pressing 1</Label>
            <Textarea rows={2} value={f.confirm_text} maxLength={300} onChange={(e) => set("confirm_text", e.target.value)} /></div>
          <div><Label className="text-xs">After pressing 2</Label>
            <Textarea rows={2} value={f.cancel_text} maxLength={300} onChange={(e) => set("cancel_text", e.target.value)} /></div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <h3 className="text-sm font-semibold">Custom audio (MP3)</h3>
        <p className="mb-3 text-[11px] text-muted-foreground">Optional. If you add audio it plays instead of the text. Max 5 MB, MP3 only.</p>
        <div className="space-y-3">
          <AudioSlot label="Main audio (when the customer answers)" kind="main" storeId={c?.storeId} value={f.main_audio_url} onChange={(v) => set("main_audio_url", v)} />
          <AudioSlot label="Confirm audio (after pressing 1)" kind="confirm" storeId={c?.storeId} value={f.confirm_audio_url} onChange={(v) => set("confirm_audio_url", v)} />
          <AudioSlot label="Cancel audio (after pressing 2)" kind="cancel" storeId={c?.storeId} value={f.cancel_audio_url} onChange={(v) => set("cancel_audio_url", v)} />
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">What happens after the call</h3>
        <p className="text-xs text-muted-foreground">Press 1 → order Confirmed + green "AI Verified" badge.</p>
        <div className="mt-3 space-y-1">
          <Label className="text-xs">When the customer presses 2</Label>
          <select className="h-9 w-full rounded-md border bg-background px-2 text-sm sm:w-80" value={f.press2_action}
            onChange={(e) => set("press2_action", e.target.value as "cancel" | "forward")}>
            <option value="cancel">Cancel the order</option>
            <option value="forward" disabled={!c?.default_extension}>
              Forward the call to my agent{c?.default_extension ? ` (${c.default_extension})` : " — set an extension first"}
            </option>
          </select>
        </div>
        <div className="mt-2">
          <Toggle k="sms_on_confirm" label="Send a confirmation SMS after pressing 1"
            hint={c && !c.sms_ready ? "SMS is not set up in Notifications yet — no SMS will be sent." : undefined} />
          <Toggle k="retry_on_no_answer" label="Call again if not answered / busy" />
          <Toggle k="retry_on_no_keypress" label="Call again if answered but nothing pressed" />
        </div>
      </div>
    </div>
  );
}
