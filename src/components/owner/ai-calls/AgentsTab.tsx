import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listAgents, saveAgent, deleteAgent, publishAgent, listVoices, listTones } from "@/lib/ai-call-center.functions";
import { AI_TOOLS } from "@/lib/ai-call-center";

const EMPTY = {
  id: null as string | null,
  name: "",
  is_template: true,
  voice_id: null as string | null,
  tone_id: null as string | null,
  gender: "female",
  language: "en",
  personality: "",
  instructions: "",
  knowledge: "",
  tools: {} as Record<string, boolean>,
  inbound_enabled: true,
  outbound_enabled: true,
  status: "active",
};

export function AgentsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAgents);
  const saveFn = useServerFn(saveAgent);
  const delFn = useServerFn(deleteAgent);
  const pubFn = useServerFn(publishAgent);
  const voicesFn = useServerFn(listVoices);
  const tonesFn = useServerFn(listTones);

  const agents = useQuery({ queryKey: ["ai-call", "agents"], queryFn: () => listFn() });
  const voices = useQuery({ queryKey: ["ai-call", "voices"], queryFn: () => voicesFn() });
  const tones = useQuery({ queryKey: ["ai-call", "tones"], queryFn: () => tonesFn() });

  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<any>, msg: string) {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["ai-call", "agents"] });
      toast.success(msg);
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Templates define how every store's AI agent talks. Store agents are generated from a template automatically.
        </p>
        <Button size="sm" onClick={() => setForm({ ...EMPTY })}>
          <Plus className="mr-1 h-3.5 w-3.5" /> New Template
        </Button>
      </div>

      {form && (
        <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Agent Name</Label>
            <Input className="mt-1 h-9" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Order Confirmation Agent" />
          </div>
          <div>
            <Label className="text-xs">Language</Label>
            <Input className="mt-1 h-9" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Voice</Label>
            <Select value={form.voice_id ?? "none"} onValueChange={(v) => setForm({ ...form, voice_id: v === "none" ? null : v })}>
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Use default</SelectItem>
                {(voices.data as any[] | undefined)?.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tone</Label>
            <Select value={form.tone_id ?? "none"} onValueChange={(v) => setForm({ ...form, tone_id: v === "none" ? null : v })}>
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Use default</SelectItem>
                {(tones.data as any[] | undefined)?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Personality</Label>
            <Textarea className="mt-1" value={form.personality} onChange={(e) => setForm({ ...form, personality: e.target.value })} placeholder="Warm, concise, never pushy…" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Instructions</Label>
            <Textarea className="mt-1 min-h-32" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Extra Knowledge</Label>
            <Textarea className="mt-1" value={form.knowledge} onChange={(e) => setForm({ ...form, knowledge: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Allowed Actions</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {AI_TOOLS.map((t) => (
                <label key={t.key} className="flex items-center gap-2 rounded-lg border p-2 text-xs">
                  <Switch
                    checked={form.tools[t.key] !== false}
                    onCheckedChange={(v) => setForm({ ...form, tools: { ...form.tools, [t.key]: v } })}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={form.inbound_enabled} onCheckedChange={(v) => setForm({ ...form, inbound_enabled: v })} /> Inbound
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={form.outbound_enabled} onCheckedChange={(v) => setForm({ ...form, outbound_enabled: v })} /> Outbound
            </label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setForm(null)}>Cancel</Button>
            <Button size="sm" disabled={busy || !form.name} onClick={() => void run(async () => { await saveFn({ data: form as any }); setForm(null); }, "Agent saved")}>
              Save Agent
            </Button>
          </div>
        </section>
      )}

      <div className="rounded-2xl border bg-card divide-y">
        {(agents.data as any[] | undefined)?.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                {a.name}
                <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                  {a.is_template ? "Template" : (a.stores?.name ?? "Store agent")}
                </span>
                {a.provider_agent_id && (
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600">
                    Published
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {a.ai_call_voices?.name ?? "Default voice"} · {a.ai_call_tones?.name ?? "Default tone"} · {a.language}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => pubFn({ data: { id: a.id } }), "Agent published")}>
                <UploadCloud className="mr-1 h-3.5 w-3.5" /> Publish
              </Button>
              <Button variant="outline" size="sm" onClick={() => setForm({ ...EMPTY, ...a, tools: a.tools ?? {} })}>Edit</Button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground hover:text-destructive"
                onClick={() => void run(() => delFn({ data: { id: a.id } }), "Agent removed")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {!agents.data?.length && <div className="p-6 text-sm text-muted-foreground">No agents yet.</div>}
      </div>
    </div>
  );
}
