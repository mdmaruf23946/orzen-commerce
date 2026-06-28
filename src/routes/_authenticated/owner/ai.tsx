import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getAiGlobalSettings, getAiUsageStats, updateAiGlobalSettings } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/owner/ai")({
  component: OwnerAi,
});

const MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "openai/gpt-5-mini",
  "openai/gpt-5",
];

function OwnerAi() {
  const getSettings = useServerFn(getAiGlobalSettings);
  const getStats = useServerFn(getAiUsageStats);
  const save = useServerFn(updateAiGlobalSettings);
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["ai", "settings"], queryFn: () => getSettings() });
  const { data: stats } = useQuery({ queryKey: ["ai", "stats"], queryFn: () => getStats() });

  const [form, setForm] = useState({ enabled: true, default_model: MODELS[0], provider_api_key: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        enabled: !!settings.enabled,
        default_model: settings.default_model || MODELS[0],
        provider_api_key: "",
      });
    }
  }, [settings]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await save({
        data: {
          enabled: form.enabled,
          default_model: form.default_model,
          provider_api_key: form.provider_api_key || null,
        },
      });
      qc.invalidateQueries({ queryKey: ["ai", "settings"] });
      toast.success("Saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const hasKey = !!(settings as any)?.provider_api_key;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AI Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Global AI configuration and usage.</p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4">
        <label className="flex items-center justify-between">
          <span className="text-sm font-medium">Enable AI globally</span>
          <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
        </label>

        <div className="space-y-1">
          <label className="text-sm font-medium">Default model</label>
          <select
            value={form.default_model}
            onChange={(e) => setForm({ ...form, default_model: e.target.value })}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">
            Provider API key {hasKey && <span className="text-xs text-emerald-600">(configured)</span>}
          </label>
          <Input
            type="password"
            value={form.provider_api_key}
            onChange={(e) => setForm({ ...form, provider_api_key: e.target.value })}
            placeholder={hasKey ? "•••••••• (leave blank to keep)" : "Leave blank to use Lovable AI"}
          />
          <p className="text-xs text-muted-foreground">
            Optional. When set, overrides the platform Lovable AI Gateway key.
          </p>
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-lg font-semibold">Usage (last 30 days)</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Requests" value={stats?.totals?.requests ?? 0} />
          <Stat label="Prompt tokens" value={stats?.totals?.prompt ?? 0} />
          <Stat label="Completion tokens" value={stats?.totals?.completion ?? 0} />
          <Stat label="Est. cost (USD)" value={(stats?.totals?.cost ?? 0).toFixed(2)} />
        </div>
        {stats?.byStore && stats.byStore.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-2 py-1">Store</th>
                  <th className="px-2 py-1">Requests</th>
                  <th className="px-2 py-1">Tokens</th>
                  <th className="px-2 py-1">Cost</th>
                </tr>
              </thead>
              <tbody>
                {stats.byStore.map((r: any) => (
                  <tr key={r.store_id} className="border-t">
                    <td className="px-2 py-1 font-mono text-xs">{r.store_id}</td>
                    <td className="px-2 py-1">{r.requests}</td>
                    <td className="px-2 py-1">{r.tokens}</td>
                    <td className="px-2 py-1">${Number(r.cost).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
