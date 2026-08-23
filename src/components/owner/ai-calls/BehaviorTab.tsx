import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getAiCallConfig, saveAiCallRules } from "@/lib/ai-call-center.functions";
import { AI_TOOLS, BUSINESS_BEHAVIOR } from "@/lib/ai-call-center";

export function BehaviorTab() {
  const qc = useQueryClient();
  const getFn = useServerFn(getAiCallConfig);
  const saveFn = useServerFn(saveAiCallRules);
  const { data } = useQuery({ queryKey: ["ai-call", "config"], queryFn: () => getFn() });
  const c: any = data ?? {};

  const [draft, setDraft] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const v = draft ?? {
    behavior: {
      interruption: true,
      natural_pauses: true,
      background_noise: false,
      thinking_sounds: true,
      confirmation_repeat: true,
      ...(c.behavior ?? {}),
    },
    rules: {
      max_call_duration_min: 5,
      retry_count: 2,
      retry_interval_minutes: 30,
      calling_hours_start: "09:00",
      calling_hours_end: "21:00",
      timezone: "Asia/Dhaka",
      fallback_to_human: true,
      ...(c.rules ?? {}),
    },
    business: { ...(c.business ?? {}) },
    tools: { ...(c.tools ?? {}) },
  };

  async function save() {
    setBusy(true);
    try {
      await saveFn({ data: v });
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["ai-call", "config"] });
      toast.success("Behavior rules saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const set = (group: string, key: string, val: any) =>
    setDraft({ ...v, [group]: { ...v[group], [key]: val } });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Conversation Behavior</h2>
          <div className="mt-3 space-y-2">
            {[
              ["interruption", "Allow the customer to interrupt"],
              ["natural_pauses", "Natural pauses and turn-taking"],
              ["thinking_sounds", "Human-like thinking sounds"],
              ["background_noise", "Subtle background ambience"],
              ["confirmation_repeat", "Repeat key details back for confirmation"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs">
                {label}
                <Switch checked={v.behavior[key] !== false} onCheckedChange={(x) => set("behavior", key, x)} />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Call Rules</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Max Call Duration (min)</Label>
              <Input type="number" className="mt-1 h-9" value={v.rules.max_call_duration_min}
                onChange={(e) => set("rules", "max_call_duration_min", Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Retry Attempts</Label>
              <Input type="number" className="mt-1 h-9" value={v.rules.retry_count}
                onChange={(e) => set("rules", "retry_count", Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Retry Interval (min)</Label>
              <Input type="number" className="mt-1 h-9" value={v.rules.retry_interval_minutes}
                onChange={(e) => set("rules", "retry_interval_minutes", Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Timezone</Label>
              <Input className="mt-1 h-9" value={v.rules.timezone} onChange={(e) => set("rules", "timezone", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Calling Hours Start</Label>
              <Input type="time" className="mt-1 h-9" value={v.rules.calling_hours_start}
                onChange={(e) => set("rules", "calling_hours_start", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Calling Hours End</Label>
              <Input type="time" className="mt-1 h-9" value={v.rules.calling_hours_end}
                onChange={(e) => set("rules", "calling_hours_end", e.target.value)} />
            </div>
            <label className="col-span-full flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs">
              Hand over to a human when the AI cannot help
              <Switch checked={v.rules.fallback_to_human !== false} onCheckedChange={(x) => set("rules", "fallback_to_human", x)} />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Business Behavior</h2>
          <div className="mt-3 space-y-2">
            {BUSINESS_BEHAVIOR.map((b: any) => (
              <label key={b.key} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs">
                {b.label}
                <Switch checked={v.business[b.key] !== false} onCheckedChange={(x) => set("business", b.key, x)} />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Platform Actions</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">Turning an action off disables it for every store.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {AI_TOOLS.map((t) => (
              <label key={t.key} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs">
                {t.label}
                <Switch checked={v.tools[t.key] !== false} onCheckedChange={(x) => set("tools", t.key, x)} />
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="flex justify-end">
        <Button size="sm" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save Settings"}</Button>
      </div>
    </div>
  );
}
