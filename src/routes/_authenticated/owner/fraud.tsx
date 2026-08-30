import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck, Settings2, Sliders, BarChart3, KeyRound,
  CheckCircle2, XCircle, Loader2, AlertTriangle, Clock, Zap,
  Plus, Trash2, ArrowUp, ArrowDown, RotateCcw,
} from "lucide-react";
import {
  getFraudSettingsAdmin, updateFraudSettings, testFraudConnection, fraudAnalytics,
  addFraudApiKey, updateFraudApiKey, deleteFraudApiKey, moveFraudApiKey,
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
  const [testPhone, setTestPhone] = useState("01700000000");
  const [testResult, setTestResult] = useState<{
    ok: boolean; error?: string; sample?: any; latency_ms?: number; tested_at?: string; phone?: string;
  } | null>(null);
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
      setForm((f: any) => ({ ...f, api_key: "", api_secret: "" }));
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
      const r = await testFn({ data: { phone: testPhone.trim(), api_key: form.api_key || undefined } });
      setTestResult(r);
      if (r.ok) toast.success("Connection successful");
      else toast.error(r.error ?? "Connection failed");
      qc.invalidateQueries({ queryKey: ["owner", "fraud-cfg"] });
    } catch (e) {
      const err = (e as Error).message;
      setTestResult({ ok: false, error: err });
      toast.error(err);
    } finally {
      setTesting(false);
    }
  }

  const lastTestAt = cfg?.last_test_at as string | undefined;
  const lastTestOk = cfg?.last_test_ok as boolean | null | undefined;
  const lastTestError = cfg?.last_test_error as string | null | undefined;
  const lastTestSample = cfg?.last_test_sample as any;


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

          {/* Persisted provider status banner */}
          <div
            className={`rounded-lg border p-3 text-sm ${
              lastTestOk === true
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                : lastTestOk === false
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-muted bg-muted/30 text-muted-foreground"
            }`}
          >
            <div className="flex items-start gap-2">
              {lastTestOk === true ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                : lastTestOk === false ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                : <Clock className="mt-0.5 h-4 w-4 shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {lastTestOk === true ? "Provider connected"
                    : lastTestOk === false ? "Provider connection failed"
                    : "Provider not tested yet"}
                </div>
                <div className="mt-0.5 text-xs opacity-90">
                  {lastTestAt ? `Last checked ${new Date(lastTestAt).toLocaleString()}` : "Run a test to verify credentials."}
                  {cfg.has_api_key ? "" : " • No API key stored"}
                </div>
                {lastTestOk === false && lastTestError && (
                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-background/60 p-2 font-mono text-[11px] leading-relaxed">
                    {lastTestError}
                  </pre>
                )}
                {lastTestOk === true && lastTestSample && (
                  <div className="mt-1 text-xs">
                    Sample: {lastTestSample.total} orders • {lastTestSample.success} success • {lastTestSample.returned} returned • {lastTestSample.couriers} courier(s)
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Input value={form.provider} onChange={(e) => set("provider", e.target.value)} />
              <p className="text-xs text-muted-foreground">Default: bd_courier</p>
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

            <div className="space-y-1.5">

              <Label>Test phone number</Label>
              <Input
                inputMode="tel"
                placeholder="01700000000"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Used only for the Test Connection call.</p>
            </div>
          </div>

          <ApiKeysManager keys={(cfg as any).api_keys ?? []} testPhone={testPhone} />



          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button type="button" variant="outline" onClick={runTest} disabled={testing || testPhone.trim().length < 6}>
              {testing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Zap className="mr-1.5 h-4 w-4" />}
              Test Connection
            </Button>
            <Button onClick={save} disabled={saving} className="ml-auto">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>

          {/* Live test result */}
          {testResult && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                testResult.ok
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-destructive/30 bg-destructive/5"
              }`}
            >
              <div className="flex items-start gap-2">
                {testResult.ok
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                <div className="min-w-0 flex-1">
                  <div className={`font-medium ${testResult.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
                    {testResult.ok ? "Test succeeded" : "Test failed"}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Phone {testResult.phone ?? testPhone}
                    {typeof testResult.latency_ms === "number" ? ` • ${testResult.latency_ms} ms` : ""}
                    {testResult.tested_at ? ` • ${new Date(testResult.tested_at).toLocaleTimeString()}` : ""}
                  </div>
                  {testResult.ok && testResult.sample ? (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <TestStat label="Total" value={testResult.sample.total} />
                      <TestStat label="Success" value={testResult.sample.success} />
                      <TestStat label="Returned" value={testResult.sample.returned} />
                      <TestStat label="Cancelled" value={testResult.sample.cancelled} />
                    </div>
                  ) : testResult.error ? (
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-background/60 p-2 font-mono text-[11px] leading-relaxed text-destructive">
                      {testResult.error}
                    </pre>
                  ) : null}
                </div>
              </div>
            </div>
          )}
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

function TestStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background/60 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{Number(value ?? 0).toLocaleString()}</div>
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


// ---------------- Multiple API keys (serial rotation) ----------------
type KeyRow = {
  id: string;
  label: string;
  key_masked: string | null;
  enabled: boolean;
  failed_on: string | null;
  last_error: string | null;
  last_used_at: string | null;
};

function dhakaToday() {
  return new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function ApiKeysManager({ keys, testPhone }: { keys: KeyRow[]; testPhone: string }) {
  const addFn = useServerFn(addFraudApiKey);
  const updFn = useServerFn(updateFraudApiKey);
  const delFn = useServerFn(deleteFraudApiKey);
  const moveFn = useServerFn(moveFraudApiKey);
  const testFn = useServerFn(testFraudConnection);
  const qc = useQueryClient();

  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const today = dhakaToday();
  const activeId = keys.find((k) => k.enabled && k.failed_on !== today)?.id ?? null;

  const refresh = () => qc.invalidateQueries({ queryKey: ["owner", "fraud-cfg"] });

  async function run(id: string, fn: () => Promise<any>, okMsg: string) {
    setBusy(id);
    try {
      await fn();
      toast.success(okMsg);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-3 sm:p-4">
      <div>
        <div className="flex items-center gap-2 font-medium">
          <KeyRound className="h-4 w-4" /> API Keys ({keys.length})
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Keys are used one at a time, in this order. Key #1 always runs first; if it stops working,
          the next key takes over automatically for the rest of the day. Every day starts again from key #1.
        </p>
      </div>

      <div className="space-y-2">
        {keys.length === 0 && (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            No API key added yet — add your first BD Courier token below.
          </p>
        )}
        {keys.map((k, i) => {
          const failedToday = k.failed_on === today;
          const isActive = k.id === activeId;
          return (
            <div key={k.id} className="rounded-lg border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-[11px] font-semibold">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{k.label}</span>
                {isActive && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                    IN USE
                  </span>
                )}
                {!k.enabled && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    DISABLED
                  </span>
                )}
                {failedToday && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                    PAUSED TODAY
                  </span>
                )}
                <Switch
                  checked={k.enabled}
                  disabled={busy === k.id}
                  onCheckedChange={(v) =>
                    run(k.id, () => updFn({ data: { id: k.id, enabled: v } }), v ? "Key enabled" : "Key disabled")
                  }
                />
              </div>

              <div className="mt-1 font-mono text-[11px] text-muted-foreground">{k.key_masked}</div>
              {k.last_used_at && (
                <div className="text-[11px] text-muted-foreground">
                  Last used {new Date(k.last_used_at).toLocaleString()}
                </div>
              )}
              {failedToday && k.last_error && (
                <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap break-words rounded bg-destructive/5 p-2 font-mono text-[11px] text-destructive">
                  {k.last_error}
                </pre>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm" variant="ghost" disabled={i === 0 || busy === k.id}
                  onClick={() => run(k.id, () => moveFn({ data: { id: k.id, direction: "up" } }), "Order updated")}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm" variant="ghost" disabled={i === keys.length - 1 || busy === k.id}
                  onClick={() => run(k.id, () => moveFn({ data: { id: k.id, direction: "down" } }), "Order updated")}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm" variant="outline" disabled={busy === k.id}
                  onClick={() =>
                    run(k.id, async () => {
                      const r = await testFn({ data: { phone: testPhone.trim() || "01700000000", key_id: k.id } });
                      if (!r.ok) throw new Error(r.error ?? "Connection failed");
                    }, "Key works")
                  }
                >
                  <Zap className="mr-1 h-3.5 w-3.5" /> Test
                </Button>
                {failedToday && (
                  <Button
                    size="sm" variant="outline" disabled={busy === k.id}
                    onClick={() => run(k.id, () => updFn({ data: { id: k.id, reset_failure: true } }), "Key resumed")}
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5" /> Resume
                  </Button>
                )}
                <Button
                  size="sm" variant="ghost" className="ml-auto text-destructive" disabled={busy === k.id}
                  onClick={() => run(k.id, () => delFn({ data: { id: k.id } }), "Key removed")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <Input placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input
          type="password" autoComplete="off" placeholder="Paste BD Courier API token"
          value={value} onChange={(e) => setValue(e.target.value)}
        />
        <Button
          disabled={busy === "add" || value.trim().length < 8}
          onClick={() =>
            run("add", async () => {
              await addFn({ data: { key: value.trim(), label: label.trim() || undefined } });
              setValue(""); setLabel("");
            }, "API key added")
          }
        >
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}
