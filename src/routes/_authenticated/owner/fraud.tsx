import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck, Settings2, Sliders, BarChart3, KeyRound,
  CheckCircle2, XCircle, Loader2,
} from "lucide-react";
import {
  getFraudSettingsAdmin, updateFraudSettings, testFraudConnection, fraudAnalytics,
} from "@/lib/fraud.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/owner/fraud")({
  component: FraudPage,
});

function FraudPage() {
  const getFn = useServerFn(getFraudSettingsAdmin);
  const saveFn = useServerFn(updateFraudSettings);
  const testFn = useServerFn(testFraudConnection);
  const statsFn = useServerFn(fraudAnalytics);
  const qc = useQueryClient();

  const { data: cfg, isLoading } = useQuery({ queryKey: ["owner", "fraud-cfg"], queryFn: () => getFn() });
  const { data: analytics } = useQuery({ queryKey: ["owner", "fraud-analytics"], queryFn: () => statsFn() });

  const [form, setForm] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cfg && !form) {
      setForm({
        enabled: !!cfg.enabled,
        provider: cfg.provider ?? "bd_courier",
        api_key: "",
        api_secret: "",
        enable_manual_check: !!cfg.enable_manual_check,
        enable_auto_check_before_courier: !!cfg.enable_auto_check_before_courier,
        show_in_order_details: !!cfg.show_in_order_details,
        enable_analytics: !!cfg.enable_analytics,
        thresholds: cfg.thresholds ?? { safe_max: 10, medium_max: 30 },
      });
    }
  }, [cfg, form]);

  if (isLoading || !form) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const setTh = (k: "safe_max" | "medium_max", v: number) =>
    setForm((f: any) => ({ ...f, thresholds: { ...f.thresholds, [k]: v } }));

  async function save() {
    setSaving(true);
    try {
      await saveFn({ data: form });
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["owner", "fraud-cfg"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await testFn({ data: { phone: "01700000000" } });
      setTestResult(r);
    } catch (e) {
      setTestResult({ ok: false, error: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Fraud Checker</h1>
          <p className="text-sm text-muted-foreground">
            Centralized BD Courier fraud detection for every store.
          </p>
        </div>
      </div>

      <Tabs defaultValue="provider" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="provider" className="gap-1.5"><KeyRound className="h-3.5 w-3.5" />Provider</TabsTrigger>
          <TabsTrigger value="global" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" />Global</TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5"><Sliders className="h-3.5 w-3.5" />Risk Rules</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Analytics</TabsTrigger>
        </TabsList>

        {/* PROVIDER */}
        <TabsContent value="provider" className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Enable Fraud Checker</div>
              <div className="text-xs text-muted-foreground">Master switch across the platform</div>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(v) => set("enabled", v)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Input value={form.provider} onChange={(e) => set("provider", e.target.value)} />
              <p className="text-xs text-muted-foreground">Default: bd_courier</p>
            </div>
            <div className="space-y-1.5">
              <Label>API Key</Label>
              <Input
                type="password"
                autoComplete="off"
                placeholder={cfg.api_key_masked ?? "Enter BD Courier API token"}
                value={form.api_key}
                onChange={(e) => set("api_key", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave blank to keep existing key.</p>
            </div>
            <div className="space-y-1.5">
              <Label>API Secret (optional)</Label>
              <Input
                type="password"
                autoComplete="off"
                placeholder={cfg.api_secret_masked ?? "Not required for BD Courier"}
                value={form.api_secret}
                onChange={(e) => set("api_secret", e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button type="button" variant="outline" onClick={runTest} disabled={testing}>
              {testing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Test Connection
            </Button>
            {testResult && (
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${testResult.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
                {testResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                {testResult.ok ? "Connected" : testResult.error}
              </span>
            )}
            <Button onClick={save} disabled={saving} className="ml-auto">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </TabsContent>

        {/* GLOBAL */}
        <TabsContent value="global" className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
          {[
            ["enable_manual_check", "Enable manual fraud check", "Show the Fraud Check button on each order"],
            ["enable_auto_check_before_courier", "Auto-check before courier booking", "Run fraud lookup automatically when creating a parcel"],
            ["show_in_order_details", "Show fraud status inside order details", "Display risk badge and stats in the order drawer"],
            ["enable_analytics", "Enable fraud analytics", "Aggregate metrics for the platform dashboard"],
          ].map(([k, title, desc]) => (
            <div key={k as string} className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{title}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
              <Switch checked={form[k as string]} onCheckedChange={(v) => set(k as string, v)} />
            </div>
          ))}
          <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </TabsContent>

        {/* RISK RULES */}
        <TabsContent value="rules" className="space-y-6 rounded-xl border bg-card p-4 sm:p-6">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Safe: return-rate up to <span className="font-semibold text-emerald-600">{form.thresholds.safe_max}%</span></Label>
            </div>
            <Slider min={0} max={100} step={1} value={[form.thresholds.safe_max]} onValueChange={(v) => setTh("safe_max", v[0]!)} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Medium: return-rate up to <span className="font-semibold text-amber-600">{form.thresholds.medium_max}%</span></Label>
            </div>
            <Slider min={form.thresholds.safe_max} max={100} step={1} value={[form.thresholds.medium_max]} onValueChange={(v) => setTh("medium_max", Math.max(v[0]!, form.thresholds.safe_max))} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-600">Safe 0–{form.thresholds.safe_max}%</span>
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-amber-600">Medium {form.thresholds.safe_max + 1}–{form.thresholds.medium_max}%</span>
            <span className="rounded-full bg-red-500/10 px-3 py-1 text-red-600">High &gt; {form.thresholds.medium_max}%</span>
          </div>
          <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving…" : "Save Rules"}
          </Button>
        </TabsContent>

        {/* ANALYTICS */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Total Checks" value={analytics?.totals.total ?? 0} tone="default" />
            <Metric label="Safe" value={analytics?.totals.safe ?? 0} tone="safe" />
            <Metric label="Medium" value={analytics?.totals.medium ?? 0} tone="medium" />
            <Metric label="High" value={analytics?.totals.high ?? 0} tone="high" />
            <Metric label="Prevented Orders" value={analytics?.totals.prevented ?? 0} tone="default" />
          </div>
          <BarBlock title="Daily (last 30 days)" rows={analytics?.daily ?? []} />
          <div className="grid gap-3 md:grid-cols-2">
            <BarBlock title="Weekly" rows={analytics?.weekly ?? []} />
            <BarBlock title="Monthly" rows={analytics?.monthly ?? []} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "default" | "safe" | "medium" | "high" }) {
  const cls =
    tone === "safe" ? "text-emerald-600" :
    tone === "medium" ? "text-amber-600" :
    tone === "high" ? "text-red-600" : "";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${cls}`}>{value.toLocaleString()}</div>
    </div>
  );
}

function BarBlock({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">{title}</div>
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No data yet.</div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map(([k, v]) => (
            <li key={k} className="flex items-center gap-2 text-xs">
              <span className="w-24 shrink-0 font-mono text-muted-foreground">{k}</span>
              <div className="h-2 flex-1 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
              </div>
              <span className="w-8 text-right tabular-nums">{v}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
