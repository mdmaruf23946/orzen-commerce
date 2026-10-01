import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  aiControlCenterOverview,
  listGlobalGeminiKeys,
  addGlobalGeminiKey,
  updateGlobalGeminiKey,
  deleteGlobalGeminiKey,
  moveGlobalGeminiKey,
  testGlobalGeminiKey,
  listAiKeyUsage,
} from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sparkles, KeyRound, Zap, DollarSign, Activity, Cpu,
  ArrowUp, ArrowDown, RotateCcw, Trash2, Plug, CheckCircle2, XCircle, Pencil,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner/ai")({
  component: AIControlCenter,
});

function AIControlCenter() {
  const overviewFn = useServerFn(aiControlCenterOverview);
  const { data: overview } = useQuery({ queryKey: ["ai", "overview"], queryFn: () => overviewFn(), staleTime: 30_000 });
  const t = (overview as any)?.totals ?? { requests: 0, tokens: 0, cost: 0, cost7: 0 };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold">AI Control Center</h1>
        <p className="text-sm text-muted-foreground">Connect any AI provider. Every AI agent on the platform uses these keys.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi icon={Activity} label="Requests (30d)" value={t.requests.toLocaleString()} />
        <Kpi icon={Cpu} label="Tokens (30d)" value={`${(t.tokens / 1000).toFixed(1)}k`} />
        <Kpi icon={DollarSign} label="Cost (30d)" value={`$${t.cost.toFixed(2)}`} />
        <Kpi icon={Zap} label="Cost (7d)" value={`$${t.cost7.toFixed(2)}`} />
        <Kpi icon={Sparkles} label="Enabled stores" value={`${(overview as any)?.enabledStores ?? 0}/${(overview as any)?.configuredStores ?? 0}`} />
      </div>

      <KeyUsageOverview />

      <ApiKeysManager />
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-xl border bg-card p-3 min-w-0">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 truncate text-xl font-semibold">{value}</div>
    </div>
  );
}

/** Keep provider-specific handling (fallback models, headers) when the URL is a known one. */
function detectProvider(url: string): "gemini" | "groq" | "openrouter" | "openai" | "custom" {
  const u = url.toLowerCase();
  if (u.includes("generativelanguage.googleapis.com")) return "gemini";
  if (u.includes("api.groq.com")) return "groq";
  if (u.includes("openrouter.ai")) return "openrouter";
  if (u.includes("api.openai.com")) return "openai";
  return "custom";
}

function ApiKeysManager() {
  const listFn = useServerFn(listGlobalGeminiKeys);
  const addFn = useServerFn(addGlobalGeminiKey);
  const updFn = useServerFn(updateGlobalGeminiKey);
  const delFn = useServerFn(deleteGlobalGeminiKey);
  const moveFn = useServerFn(moveGlobalGeminiKey);
  const testFn = useServerFn(testGlobalGeminiKey);
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ["ai", "gemini-keys"], queryFn: () => listFn() as any });
  const keys: any[] = (data as any)?.keys ?? [];
  const activeId = (data as any)?.active_id ?? null;

  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [vision, setVision] = useState(true);
  const [dailyLimit, setDailyLimit] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const usageFn = useServerFn(listAiKeyUsage);
  const { data: usageData } = useQuery({ queryKey: ["ai", "key-usage"], queryFn: () => usageFn(), staleTime: 30_000 });
  const usageById = new Map<string, any>(((usageData as any)?.keys ?? []).map((u: any) => [u.id, u]));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tested, setTested] = useState<Record<string, { ok: boolean; msg?: string }>>({});

  const urlOk = baseUrl.trim().length === 0 || /^https?:\/\/\S+$/i.test(baseUrl.trim());
  const editing = editingId !== null;
  const canConnect = editing
    ? name.trim().length > 0 && urlOk && (apiKey.trim().length === 0 || apiKey.trim().length >= 10)
    : name.trim().length > 0 && urlOk && apiKey.trim().length >= 10;

  function startEdit(k: any) {
    setEditingId(k.id);
    setName(k.label ?? "");
    setModel(k.model ?? "");
    setBaseUrl(k.base_url ?? "");
    setApiKey("");
    setVision(!!k.vision);
    setDailyLimit(k.daily_token_limit ? String(k.daily_token_limit) : "");
    setMonthlyLimit(k.monthly_token_limit ? String(k.monthly_token_limit) : "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setName(""); setBaseUrl(""); setModel(""); setApiKey(""); setVision(true);
    setDailyLimit(""); setMonthlyLimit("");
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["ai", "gemini-keys"] });
    qc.invalidateQueries({ queryKey: ["ai", "key-usage"] });
    qc.invalidateQueries({ queryKey: ["ai", "provider-status"] });
  }

  async function run(id: string, fn: () => Promise<any>, ok?: string) {
    setBusy(id);
    try {
      await fn();
      refresh();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function test(id: string) {
    setBusy(id);
    try {
      const r: any = await testFn({ data: { id } });
      const ok = !!r?.ok;
      setTested((s) => ({ ...s, [id]: { ok, msg: ok ? undefined : r?.error ?? "Connection failed" } }));
      ok ? toast.success("Connected successfully") : toast.error(r?.error ?? "Connection failed");
    } catch (e) {
      setTested((s) => ({ ...s, [id]: { ok: false, msg: (e as Error).message } }));
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
      refresh();
    }
  }

  async function connect() {
    setBusy("new");
    try {
      const url = baseUrl.trim().replace(/\/+$/, "");
      if (editing && editingId) {
        const payload: any = {
          id: editingId,
          label: name.trim(),
          model: model.trim(),
          base_url: url,
          vision,
          daily_token_limit: Number(dailyLimit.replace(/[^0-9]/g, "")) || null,
          monthly_token_limit: Number(monthlyLimit.replace(/[^0-9]/g, "")) || null,
        };
        if (url) payload.provider = detectProvider(url);
        if (apiKey.trim().length >= 10) payload.key = apiKey.trim();
        await updFn({ data: payload });
        setDailyLimit(""); setMonthlyLimit("");
        setEditingId(null);
        setName(""); setBaseUrl(""); setModel(""); setApiKey(""); setVision(true);
        refresh();
        toast.success("Changes saved — testing connection…");
        await test(editingId);
      } else {
        const payload: any = {
          label: name.trim(),
          key: apiKey.trim(),
          vision,
        };
        // Only send provider/URL/model when filled — otherwise the server
        // detects the provider from the key and uses its defaults.
        if (url) {
          payload.provider = detectProvider(url);
          payload.base_url = url;
        }
        if (model.trim()) payload.model = model.trim();
        const r: any = await addFn({ data: payload });
        setName(""); setBaseUrl(""); setModel(""); setApiKey(""); setVision(true);
        refresh();
        toast.success("API key added — testing connection…");
        if (r?.id) await test(r.id);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Add / edit form */}
      <div className={`rounded-xl border bg-card p-4 min-w-0 ${editing ? "ring-1 ring-primary/40" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">{editing ? "Edit API key" : "Connect an AI API key"}</h2>
          </div>
          {editing && (
            <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={busy === "new"}>Cancel</Button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {editing
            ? "Leave the API key field empty to keep the current key."
            : "Just paste the API key and a name — the provider, URL and model are detected automatically. Fill them in only for a custom provider."}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Display name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Groq main" maxLength={60} />
          </Field>
          <Field label="Model ID (optional)">
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Auto-detected if empty" />
          </Field>
          <Field label="API base URL (optional)" className="sm:col-span-2">
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="Auto-detected if empty" />
          </Field>
          {editing && (
            <>
              <Field label="Daily token limit (optional)">
                <Input inputMode="numeric" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} placeholder="e.g. 500000" />
              </Field>
              <Field label="Monthly token limit (optional)">
                <Input inputMode="numeric" value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} placeholder="e.g. 10000000" />
              </Field>
              <p className="sm:col-span-2 -mt-1 text-[11px] text-muted-foreground">Limit শেষ হলে এই key থেমে যাবে আর পরের key কাজ করবে। খালি রাখলে কোনো limit নেই।</p>
            </>
          )}
          <Field label="API key" className="sm:col-span-2">
            <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={editing ? "Leave empty to keep the current key" : "Paste your API key"} autoComplete="off" />
          </Field>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
          <div className="min-w-0">
            <div className="text-sm font-medium">Model understands images</div>
            <div className="text-[11px] text-muted-foreground">Turn off if this model can only read text.</div>
          </div>
          <Switch checked={vision} onCheckedChange={setVision} />
        </div>

        <div className="mt-4 flex gap-2">
          {editing && (
            <Button variant="outline" className="flex-1" disabled={busy === "new"} onClick={cancelEdit}>Cancel</Button>
          )}
          <Button className="flex-1" disabled={!canConnect || busy === "new"} onClick={connect}>
            {editing
              ? (<><CheckCircle2 className="mr-1.5 h-4 w-4" /> {busy === "new" ? "Saving…" : "Save changes & test"}</>)
              : (<><Plug className="mr-1.5 h-4 w-4" /> {busy === "new" ? "Connecting…" : "Connect & test"}</>)}
          </Button>
        </div>
      </div>

      {/* Key list */}
      <div className="rounded-xl border bg-card p-4 min-w-0">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Connected keys ({keys.length})</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Used top to bottom. If one fails, the next one takes over automatically.
        </p>

        <div className="mt-3 space-y-2">
          {keys.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No API key connected yet.</div>
          )}
          {keys.map((k, i) => {
            const r = tested[k.id];
            return (
              <div key={k.id} className={`rounded-lg border p-3 min-w-0 ${editingId === k.id ? "ring-1 ring-primary/40" : ""}`}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{k.order}. {k.label}</span>
                      {k.id === activeId && k.enabled && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">In use</span>
                      )}
                      {!k.enabled && <span className="text-[10px] text-muted-foreground">Off</span>}
                      {k.failed_today && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
                          {/HTTP 429/.test(k.last_error ?? "") ? "Quota finished today"
                            : /HTTP (401|403)|api key/i.test(k.last_error ?? "") ? "Key invalid"
                            : /HTTP 404/.test(k.last_error ?? "") ? "Wrong model"
                            : "Paused today"}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 grid gap-0.5 text-[11px] text-muted-foreground">
                      <span className="truncate font-mono">Model: {k.effective_model}</span>
                      <span className="truncate font-mono">Key: {k.masked}</span>
                      <span>Images: {k.vision ? "yes" : "no"}</span>
                    </div>
                    <UsageBlock u={usageById.get(k.id)} />
                    {r?.ok && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-primary"><CheckCircle2 className="h-3 w-3" /> Connected</div>
                    )}
                    {(r && !r.ok ? r.msg : k.last_error) && (
                      <div className="mt-1 flex items-start gap-1 text-[11px] text-destructive">
                        <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="line-clamp-2">{r && !r.ok ? r.msg : k.last_error}</span>
                      </div>
                    )}
                  </div>
                  <Switch
                    checked={k.enabled}
                    disabled={busy === k.id}
                    onCheckedChange={(v) => run(k.id, () => updFn({ data: { id: k.id, enabled: v } }), v ? "Turned on" : "Turned off")}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="outline" className="h-8 flex-1" disabled={busy === k.id} onClick={() => test(k.id)}>
                    <Zap className="mr-1 h-3.5 w-3.5" /> {busy === k.id ? "Testing…" : "Test"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" disabled={busy === k.id || busy === "new"}
                    onClick={() => { cancelEdit(); startEdit(k); }}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                  </Button>
                  {k.failed_today && (
                    <Button size="sm" variant="outline" className="h-8" disabled={busy === k.id}
                      onClick={() => run(k.id, () => updFn({ data: { id: k.id, reset_failure: true } }), "Key resumed")}>
                      <RotateCcw className="mr-1 h-3.5 w-3.5" /> Resume
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Move up" disabled={i === 0 || busy === k.id}
                    onClick={() => run(k.id, () => moveFn({ data: { id: k.id, direction: "up" } }))}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Move down" disabled={i === keys.length - 1 || busy === k.id}
                    onClick={() => run(k.id, () => moveFn({ data: { id: k.id, direction: "down" } }))}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Remove" disabled={busy === k.id}
                    onClick={() => { if (confirm("Remove this API key?")) run(k.id, () => delFn({ data: { id: k.id } }), "Key removed"); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function fmtTok(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}

function remainingText(u: any): string {
  if (u.remaining === null || u.remaining === undefined) return "Limit সেট করা নেই";
  if (u.unit === "usd" || u.unit === "usd_free") {
    return u.limit === null ? "সীমাহীন (limit নেই)" : `$${Number(u.remaining).toFixed(2)} / $${Number(u.limit).toFixed(2)}`;
  }
  return u.limit ? `${fmtTok(u.remaining)} / ${fmtTok(u.limit)}` : fmtTok(u.remaining);
}

function sourceText(u: any): string {
  if (u.source === "provider") return u.unit?.startsWith("usd") ? "কোম্পানি থেকে (ক্রেডিট)" : "কোম্পানি থেকে";
  if (u.source === "limit") return u.period === "day" ? "আপনার দৈনিক limit থেকে" : "আপনার মাসিক limit থেকে";
  return "কোম্পানি বাকি জানায় না";
}

function UsageBar({ u }: { u: any }) {
  if (u.remaining === null || u.remaining === undefined || !u.limit) return null;
  const pct = Math.max(0, Math.min(100, (Number(u.remaining) / Number(u.limit)) * 100));
  const tone = pct > 50 ? "bg-primary" : pct > 20 ? "bg-amber-500" : "bg-destructive";
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function UsageBlock({ u }: { u: any }) {
  if (!u) return null;
  return (
    <div className="mt-2 rounded-md border bg-muted/30 p-2 text-[11px]">
      <div className="grid grid-cols-3 gap-2">
        <div><div className="text-muted-foreground">আজ খরচ</div><div className="font-semibold text-foreground">{fmtTok(u.used_today)}</div></div>
        <div><div className="text-muted-foreground">এই মাসে</div><div className="font-semibold text-foreground">{fmtTok(u.used_month)}</div></div>
        <div><div className="text-muted-foreground">বাকি</div><div className={`font-semibold ${u.over_limit ? "text-destructive" : "text-foreground"}`}>{u.over_limit ? "Limit শেষ" : remainingText(u)}</div></div>
      </div>
      <UsageBar u={u} />
      <div className="mt-1 text-muted-foreground">
        {u.requests_month} বার ব্যবহার · {sourceText(u)}
        {u.last_used ? ` · শেষ: ${new Date(u.last_used).toLocaleString()}` : ""}
      </div>
    </div>
  );
}

function KeyUsageOverview() {
  const usageFn = useServerFn(listAiKeyUsage);
  const { data, isLoading } = useQuery({ queryKey: ["ai", "key-usage"], queryFn: () => usageFn(), staleTime: 30_000 });
  const rows: any[] = (data as any)?.keys ?? [];
  return (
    <div className="rounded-xl border bg-card p-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">API Key Usage</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          সব key মিলিয়ে — আজ {fmtTok((data as any)?.total_today ?? 0)} · এই মাসে {fmtTok((data as any)?.total_month ?? 0)} token
        </span>
      </div>
      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">লোড হচ্ছে…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">কোনো API key যুক্ত নেই।</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {rows.map((u) => (
            <div key={u.id} className={`min-w-0 rounded-lg border p-3 ${u.enabled ? "" : "opacity-60"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{u.order}. {u.label}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{u.provider_name}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div><div className="text-muted-foreground">খরচ হয়েছে (মাস)</div><div className="text-base font-bold">{fmtTok(u.used_month)}</div></div>
                <div><div className="text-muted-foreground">বাকি আছে</div><div className={`text-sm font-bold ${u.over_limit ? "text-destructive" : ""}`}>{u.over_limit ? "Limit শেষ" : remainingText(u)}</div></div>
              </div>
              <UsageBar u={u} />
              <div className="mt-1 text-[10px] text-muted-foreground">আজ {fmtTok(u.used_today)} · {sourceText(u)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 min-w-0 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
