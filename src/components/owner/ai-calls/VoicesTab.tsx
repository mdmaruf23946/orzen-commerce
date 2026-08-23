import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, DownloadCloud, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listVoices, saveVoice, deleteVoice, importElevenLabsVoices, listTones, saveTone, deleteTone,
} from "@/lib/ai-call-center.functions";

const EMPTY_VOICE = {
  id: null as string | null,
  name: "",
  provider_voice_id: "",
  gender: "female",
  language: "en",
  accent: "",
  description: "",
  preview_url: "",
  is_active: true,
  sort_order: 0,
};

export function VoicesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listVoices);
  const saveFn = useServerFn(saveVoice);
  const delFn = useServerFn(deleteVoice);
  const importFn = useServerFn(importElevenLabsVoices);
  const tonesFn = useServerFn(listTones);
  const saveToneFn = useServerFn(saveTone);
  const delToneFn = useServerFn(deleteTone);

  const voices = useQuery({ queryKey: ["ai-call", "voices"], queryFn: () => listFn() });
  const tones = useQuery({ queryKey: ["ai-call", "tones"], queryFn: () => tonesFn() });
  const [voice, setVoice] = useState<typeof EMPTY_VOICE | null>(null);
  const [tone, setTone] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["ai-call", "voices"] });
    await qc.invalidateQueries({ queryKey: ["ai-call", "tones"] });
  }

  async function run(fn: () => Promise<any>, msg: string) {
    setBusy(true);
    try {
      await fn();
      await refresh();
      toast.success(msg);
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <h2 className="text-sm font-semibold">Voice Library</h2>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const r: any = await importFn();
                  toast.message(`${r.imported} voices imported`);
                }, "Voices synced from ElevenLabs")
              }
            >
              <DownloadCloud className="mr-1 h-3.5 w-3.5" /> Import
            </Button>
            <Button size="sm" onClick={() => setVoice({ ...EMPTY_VOICE })}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add Voice
            </Button>
          </div>
        </div>

        {voice && (
          <div className="grid gap-3 border-b bg-muted/30 p-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Display Name</Label>
              <Input className="mt-1 h-9" value={voice.name} onChange={(e) => setVoice({ ...voice, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">ElevenLabs Voice ID</Label>
              <Input className="mt-1 h-9" value={voice.provider_voice_id} onChange={(e) => setVoice({ ...voice, provider_voice_id: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Gender</Label>
              <Select value={voice.gender} onValueChange={(v) => setVoice({ ...voice, gender: v })}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Language</Label>
              <Input className="mt-1 h-9" value={voice.language} onChange={(e) => setVoice({ ...voice, language: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Accent</Label>
              <Input className="mt-1 h-9" value={voice.accent} onChange={(e) => setVoice({ ...voice, accent: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Preview URL</Label>
              <Input className="mt-1 h-9" value={voice.preview_url} onChange={(e) => setVoice({ ...voice, preview_url: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Description</Label>
              <Textarea className="mt-1" value={voice.description} onChange={(e) => setVoice({ ...voice, description: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={voice.is_active} onCheckedChange={(v) => setVoice({ ...voice, is_active: v })} />
              <span className="text-xs">Available to stores</span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setVoice(null)}>Cancel</Button>
              <Button
                size="sm"
                disabled={busy || !voice.name || !voice.provider_voice_id}
                onClick={() => void run(async () => { await saveFn({ data: voice as any }); setVoice(null); }, "Voice saved")}
              >
                Save Voice
              </Button>
            </div>
          </div>
        )}

        <div className="divide-y">
          {(voices.data as any[] | undefined)?.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {v.name} <span className="text-xs font-normal text-muted-foreground">· {v.gender} · {v.language}</span>
                </div>
                <div className="truncate text-xs text-muted-foreground">{v.description || v.provider_voice_id}</div>
              </div>
              <div className="flex items-center gap-1.5">
                {v.preview_url && (
                  <a href={v.preview_url} target="_blank" rel="noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border">
                    <Play className="h-3.5 w-3.5" />
                  </a>
                )}
                <Button variant="outline" size="sm" onClick={() => setVoice({ ...EMPTY_VOICE, ...v })}>Edit</Button>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground hover:text-destructive"
                  onClick={() => void run(() => delFn({ data: { id: v.id } }), "Voice removed")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {!voices.data?.length && <div className="p-6 text-sm text-muted-foreground">No voices yet.</div>}
        </div>
      </section>

      <section className="rounded-2xl border bg-card">
        <div className="flex items-center justify-between gap-2 border-b p-3">
          <h2 className="text-sm font-semibold">Tone Presets</h2>
          <Button size="sm" onClick={() => setTone({ id: null, name: "", description: "", instructions: "", is_active: true, sort_order: 0 })}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Tone
          </Button>
        </div>

        {tone && (
          <div className="space-y-3 border-b bg-muted/30 p-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input className="mt-1 h-9" value={tone.name} onChange={(e) => setTone({ ...tone, name: e.target.value })} placeholder="Friendly" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input className="mt-1 h-9" value={tone.description ?? ""} onChange={(e) => setTone({ ...tone, description: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Instructions</Label>
              <Textarea className="mt-1 min-h-24" value={tone.instructions ?? ""} onChange={(e) => setTone({ ...tone, instructions: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={tone.is_active} onCheckedChange={(v) => setTone({ ...tone, is_active: v })} />
                <span className="text-xs">Active</span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setTone(null)}>Cancel</Button>
                <Button size="sm" disabled={busy || !tone.name} onClick={() => void run(async () => { await saveToneFn({ data: tone }); setTone(null); }, "Tone saved")}>
                  Save Tone
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="divide-y">
          {(tones.data as any[] | undefined)?.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{t.name}</div>
                <div className="truncate text-xs text-muted-foreground">{t.description}</div>
              </div>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setTone(t)}>Edit</Button>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground hover:text-destructive"
                  onClick={() => void run(() => delToneFn({ data: { id: t.id } }), "Tone removed")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {!tones.data?.length && <div className="p-6 text-sm text-muted-foreground">No tones yet.</div>}
        </div>
      </section>
    </div>
  );
}
