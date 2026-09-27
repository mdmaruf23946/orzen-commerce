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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tested, setTested] = useState<Record<string, { ok: boolean; msg?: string }>>({});

  const urlOk = /^https?:\/\/\S+$/i.test(baseUrl.trim());
  const editing = editingId !== null;
  const canConnect = editing
    ? name.trim().length > 0 && urlOk && model.trim().length > 0 && (apiKey.trim().length === 0 || apiKey.trim().length >= 10)
    : name.trim().length > 0 && urlOk && model.trim().length > 0 && apiKey.trim().length >= 10;

  function startEdit(k: any) {
    setEditingId(k.id);
    setName(k.label ?? "");
    setModel(k.model ?? "");
    setBaseUrl(k.base_url ?? "");
    setApiKey("");
    setVision(!!k.vision);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setName(""); setBaseUrl(""); setModel(""); setApiKey(""); setVision(true);
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["ai", "gemini-keys"] });
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
          provider: detectProvider(url),
        };
        if (apiKey.trim().length >= 10) payload.key = apiKey.trim();
        await updFn({ data: payload });
        setEditingId(null);
        setName(""); setBaseUrl(""); setModel(""); setApiKey(""); setVision(true);
        refresh();
        toast.success("Changes saved — testing connection…");
        await test(editingId);
      } else {
        const r: any = await addFn({
          data: {
            label: name.trim(),
            key: apiKey.trim(),
            provider: detectProvider(url),
            base_url: url,
            model: model.trim(),
            vision,
          },
        });
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
            : "Works with any OpenAI-compatible API (Gemini, Groq, OpenRouter, OpenAI, DeepSeek, Mistral, Together and more)."}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Display name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Groq main" maxLength={60} />
          </Field>
          <Field label="Model ID">
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. llama-3.3-70b-versatile" />
          </Field>
          <Field label="API base URL" className="sm:col-span-2">
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="e.g. https://api.groq.com/openai/v1" />
          </Field>
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
              <div key={k.id} className="rounded-lg border p-3 min-w-0">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{k.order}. {k.label}</span>
                      {k.id === activeId && k.enabled && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">In use</span>
                      )}
                      {!k.enabled && <span className="text-[10px] text-muted-foreground">Off</span>}
                      {k.failed_today && <span className="text-[10px] text-destructive">Paused today</span>}
                    </div>
                    <div className="mt-1 grid gap-0.5 text-[11px] text-muted-foreground">
                      <span className="truncate font-mono">Model: {k.effective_model}</span>
                      <span className="truncate font-mono">Key: {k.masked}</span>
                      <span>Images: {k.vision ? "yes" : "no"}</span>
                    </div>
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

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 min-w-0 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
