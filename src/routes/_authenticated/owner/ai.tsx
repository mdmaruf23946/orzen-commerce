import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  aiControlCenterOverview,
  listStoresAiConfig,
  upsertStoreAiConfig,
  updateGlobalAiKeys,
} from "@/lib/owner.functions";
import { getAiGlobalSettings, updateAiGlobalSettings } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Sparkles, KeyRound, Zap, DollarSign, Activity, Cpu, CheckCircle2, XCircle, Settings2, Search,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner/ai")({
  component: AIControlCenter,
});

const MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
];

function AIControlCenter() {
  const overviewFn = useServerFn(aiControlCenterOverview);
  const listFn = useServerFn(listStoresAiConfig);
  const getGlobal = useServerFn(getAiGlobalSettings);

  const { data: overview } = useQuery({ queryKey: ["ai", "overview"], queryFn: () => overviewFn(), staleTime: 30_000 });
  const { data: stores } = useQuery({ queryKey: ["ai", "stores"], queryFn: () => listFn(), staleTime: 15_000 });
  const { data: global } = useQuery({ queryKey: ["ai", "global"], queryFn: () => getGlobal() });

  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ((stores as any[]) ?? []).filter((s) =>
      !q || `${s.name} ${s.slug}`.toLowerCase().includes(q),
    );
  }, [stores, search]);

  const t = (overview as any)?.totals ?? { requests: 0, tokens: 0, cost: 0, req7: 0, cost7: 0 };
  const g = (overview as any)?.global ?? {};

  return (
    <div className="space-y-5 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold">AI Control Center</h1>
        <p className="text-sm text-muted-foreground">Manage OpenAI and Gemini per store · monitor platform-wide AI usage.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi icon={Activity} label="Requests (30d)" value={t.requests.toLocaleString()} />
        <Kpi icon={Cpu} label="Tokens (30d)" value={`${(t.tokens / 1000).toFixed(1)}k`} />
        <Kpi icon={DollarSign} label="Cost (30d)" value={`$${t.cost.toFixed(2)}`} />
        <Kpi icon={Zap} label="Cost (7d)" value={`$${t.cost7.toFixed(2)}`} />
        <Kpi icon={Sparkles} label="Enabled stores" value={`${(overview as any)?.enabledStores ?? 0}/${(overview as any)?.configuredStores ?? 0}`} />
      </div>

      {/* Sparkline + model breakdown */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 min-w-0">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-muted-foreground">Cost — last 7 days</span>
            <span className="text-muted-foreground">${t.cost7.toFixed(2)}</span>
          </div>
          <Sparkline data={(overview as any)?.spark ?? []} />
        </div>
        <div className="rounded-xl border bg-card p-4 min-w-0">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">Top models (30d)</div>
          <div className="space-y-1.5">
            {((overview as any)?.byModel ?? []).slice(0, 5).map((m: any) => {
              const pct = t.cost ? Math.min(100, Math.round((m.cost / t.cost) * 100)) : 0;
              return (
                <div key={m.model} className="min-w-0">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-mono">{m.model}</span>
                    <span className="shrink-0 text-muted-foreground">${m.cost.toFixed(3)} · {m.requests}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {(((overview as any)?.byModel ?? []).length === 0) && (
              <div className="text-xs text-muted-foreground">No AI activity yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Platform provider settings */}
      <PlatformSettings global={global} overview={overview} />

      {/* Per-store list */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Stores</h2>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search store…"
              className="h-9 w-full rounded-md border bg-background pl-7 pr-3 text-sm"
            />
          </div>
        </div>

        {/* Mobile cards */}
        <div className="grid gap-3 sm:hidden">
          {filtered.map((s: any) => (
            <StoreCard key={s.id} row={s} onEdit={() => setOpenId(s.id)} />
          ))}
          {filtered.length === 0 && (
            <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">No stores.</div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto rounded-xl border bg-card sm:block">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Store</th>
                <th className="p-3">Enabled</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Keys</th>
                <th className="p-3 text-right">Usage 30d</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s: any) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="p-3">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">/{s.slug}</div>
                  </td>
                  <td className="p-3">
                    {s.config?.enabled === false ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><XCircle className="h-3 w-3" /> Off</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3 w-3" /> On</span>
                    )}
                  </td>
                  <td className="p-3 text-xs uppercase">{s.config?.provider ?? "platform"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      <KeyPill label="OpenAI" on={s.config?.has_openai} />
                      <KeyPill label="Gemini" on={s.config?.has_gemini} />
                    </div>
                  </td>
                  <td className="p-3 text-right text-xs">
                    <div>{s.usage30d.requests} req</div>
                    <div className="text-muted-foreground">${s.usage30d.cost.toFixed(3)}</div>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setOpenId(s.id)}>
                      <Settings2 className="mr-1 h-3 w-3" /> Configure
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">No stores.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <StoreAiSheet
        storeId={openId}
        row={filtered.find((s: any) => s.id === openId) ?? null}
        onClose={() => setOpenId(null)}
      />
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

function KeyPill({ label, on }: { label: string; on?: boolean }) {
  return (
    <span className={`rounded-full border px-1.5 py-0.5 ${on ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
      {label}{on ? " ✓" : ""}
    </span>
  );
}

function Sparkline({ data }: { data: { date: string; cost: number }[] }) {
  const max = Math.max(0.001, ...data.map((d) => d.cost));
  const w = 100, h = 40;
  const pts = data.map((d, i) => `${(i / (data.length - 1 || 1)) * w},${h - (d.cost / max) * h}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-16 w-full">
        <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts} className="text-primary" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {data.map((d) => <span key={d.date}>{d.date}</span>)}
      </div>
    </div>
  );
}

function PlatformSettings({ global, overview }: { global: any; overview: any }) {
  const qc = useQueryClient();
  const saveBasic = useServerFn(updateAiGlobalSettings);
  const saveKeys = useServerFn(updateGlobalAiKeys);
  const [form, setForm] = useState({
    enabled: true,
    default_model: MODELS[0],
    fallback_model: "",
    temperature: 0.7,
    max_tokens: 2048,
    global_system_prompt: "",
    safety_rules: "",
    brand_voice: "",
    supported_languages: "bn, en",
  });
  const [openai, setOpenai] = useState("");
  const [gemini, setGemini] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (global)
      setForm({
        enabled: !!global.enabled,
        default_model: global.default_model || MODELS[0],
        fallback_model: global.fallback_model || "",
        temperature: typeof global.temperature === "number" ? global.temperature : 0.7,
        max_tokens: typeof global.max_tokens === "number" ? global.max_tokens : 2048,
        global_system_prompt: global.global_system_prompt ?? "",
        safety_rules: global.safety_rules ?? "",
        brand_voice: global.brand_voice ?? "",
        supported_languages: Array.isArray(global.supported_languages)
          ? global.supported_languages.join(", ")
          : "bn, en",
      });
  }, [global]);

  const g = overview?.global ?? {};

  async function submit() {
    setSaving(true);
    try {
      const langs = form.supported_languages
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      await saveBasic({
        data: {
          enabled: form.enabled,
          default_model: form.default_model,
          provider_api_key: null,
          temperature: Number(form.temperature),
          max_tokens: Number(form.max_tokens),
          global_system_prompt: form.global_system_prompt,
          safety_rules: form.safety_rules,
          brand_voice: form.brand_voice,
          supported_languages: langs,
          fallback_model: form.fallback_model || null,
        },
      });
      if (openai || gemini) {
        await saveKeys({ data: { openai_api_key: openai || null, gemini_api_key: gemini || null } });
        setOpenai(""); setGemini("");
      }
      qc.invalidateQueries({ queryKey: ["ai"] });
      toast.success("Platform AI updated");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  async function clearKey(provider: "openai" | "gemini") {
    if (!confirm(`Clear platform ${provider.toUpperCase()} key?`)) return;
    await saveKeys({ data: provider === "openai" ? { clear_openai: true } : { clear_gemini: true } });
    qc.invalidateQueries({ queryKey: ["ai"] });
    toast.success("Cleared");
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Platform defaults</h2>
          <p className="text-xs text-muted-foreground">Applies to every store's AI agent (Messenger + web chat).</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Enabled</span>
          <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Default model</label>
          <select value={form.default_model} onChange={(e) => setForm({ ...form, default_model: e.target.value })}
            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">
            {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Fallback model <span className="opacity-60">(used on rate-limit / 5xx)</span>
          </label>
          <select
            value={form.fallback_model}
            onChange={(e) => setForm({ ...form, fallback_model: e.target.value })}
            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="">— none —</option>
            {MODELS.filter((m) => m !== form.default_model).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Temperature <span className="opacity-60">({form.temperature.toFixed(2)})</span>
          </label>
          <input
            type="range" min={0} max={2} step={0.05}
            value={form.temperature}
            onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
            className="mt-2 w-full"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Max output tokens</label>
          <Input
            type="number" min={64} max={32000}
            value={form.max_tokens}
            onChange={(e) => setForm({ ...form, max_tokens: Number(e.target.value) || 0 })}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Supported languages (comma-separated)</label>
          <Input
            value={form.supported_languages}
            onChange={(e) => setForm({ ...form, supported_languages: e.target.value })}
            placeholder="bn, en"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Global system prompt</label>
          <textarea
            value={form.global_system_prompt}
            onChange={(e) => setForm({ ...form, global_system_prompt: e.target.value })}
            rows={4}
            placeholder="e.g. Always be concise. Always confirm the order total before finalizing."
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Brand voice</label>
          <textarea
            value={form.brand_voice}
            onChange={(e) => setForm({ ...form, brand_voice: e.target.value })}
            rows={3}
            placeholder="e.g. Warm, helpful, uses light Bangla humor when appropriate."
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Safety & compliance rules</label>
          <textarea
            value={form.safety_rules}
            onChange={(e) => setForm({ ...form, safety_rules: e.target.value })}
            rows={3}
            placeholder="e.g. Never share personal data. Never make medical or legal claims. Refuse abusive requests politely."
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="sm:col-span-2 flex items-center text-xs text-muted-foreground">
          {g.has_lovable_key ? "Lovable AI Gateway configured." : "Lovable AI Gateway auto-configured."}
        </div>

        <ProviderKeyField
          icon={KeyRound}
          label="OpenAI API key"
          existing={g.openai_key_masked}
          value={openai}
          onChange={setOpenai}
          onClear={() => clearKey("openai")}
          placeholder="sk-…"
        />
        <ProviderKeyField
          icon={KeyRound}
          label="Gemini API key"
          existing={g.gemini_key_masked}
          value={gemini}
          onChange={setGemini}
          onClear={() => clearKey("gemini")}
          placeholder="AIza…"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save platform settings"}</Button>
      </div>
    </div>
  );
}


function ProviderKeyField({ icon: Icon, label, existing, value, onChange, onClear, placeholder }: any) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
        {existing && <span className="ml-2 text-emerald-600">({existing})</span>}
      </label>
      <div className="mt-1 flex gap-2">
        <Input type="password" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={existing ? "Leave blank to keep" : placeholder} />
        {existing && (
          <Button type="button" size="sm" variant="outline" onClick={onClear}>Clear</Button>
        )}
      </div>
    </div>
  );
}

function StoreCard({ row, onEdit }: { row: any; onEdit: () => void }) {
  return (
    <div className="rounded-xl border bg-card p-3 min-w-0">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <div className="truncate font-medium">{row.name}</div>
          <div className="truncate text-[11px] text-muted-foreground">/{row.slug}</div>
        </div>
        {row.config?.enabled === false
          ? <span className="text-xs text-muted-foreground">Off</span>
          : <span className="text-xs text-emerald-600">On</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="uppercase text-muted-foreground">{row.config?.provider ?? "platform"}</span>
        <KeyPill label="OpenAI" on={row.config?.has_openai} />
        <KeyPill label="Gemini" on={row.config?.has_gemini} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{row.usage30d.requests} req · ${row.usage30d.cost.toFixed(3)}</span>
        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={onEdit}>Configure</Button>
      </div>
    </div>
  );
}

function StoreAiSheet({ storeId, row, onClose }: { storeId: string | null; row: any; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(upsertStoreAiConfig);
  const [form, setForm] = useState({
    enabled: true,
    provider: "platform" as "platform" | "openai" | "gemini",
    model: "",
    monthly_token_limit: "" as string | number,
    notes: "",
  });
  const [openai, setOpenai] = useState("");
  const [gemini, setGemini] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row) return;
    const c = row.config;
    setForm({
      enabled: c?.enabled ?? true,
      provider: (c?.provider as any) ?? "platform",
      model: c?.model ?? "",
      monthly_token_limit: c?.monthly_token_limit ?? "",
      notes: c?.notes ?? "",
    });
    setOpenai(""); setGemini("");
  }, [row?.id]);

  async function submit() {
    if (!storeId) return;
    setSaving(true);
    try {
      const payload: any = {
        storeId,
        enabled: form.enabled,
        provider: form.provider,
        model: form.model || null,
        monthly_token_limit: form.monthly_token_limit === "" ? null : Number(form.monthly_token_limit),
        notes: form.notes || null,
      };
      if (openai) payload.openai_api_key = openai;
      if (gemini) payload.gemini_api_key = gemini;
      await save({ data: payload });
      qc.invalidateQueries({ queryKey: ["ai"] });
      toast.success("Store AI updated");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  async function clearKey(provider: "openai" | "gemini") {
    if (!storeId) return;
    if (!confirm(`Clear ${provider.toUpperCase()} key for this store?`)) return;
    await save({ data: provider === "openai" ? { storeId, clear_openai: true } : { storeId, clear_gemini: true } });
    qc.invalidateQueries({ queryKey: ["ai"] });
    toast.success("Cleared");
  }

  return (
    <Sheet open={!!storeId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="truncate">{row?.name ?? "Configure AI"}</SheetTitle>
        </SheetHeader>
        {row && (
          <div className="mt-4 space-y-4 text-sm">
            <div className="flex items-center justify-between rounded-lg border bg-card p-3">
              <div>
                <div className="font-medium">AI enabled</div>
                <div className="text-xs text-muted-foreground">Turn off to disable AI for this store.</div>
              </div>
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
            </div>

            <div className="space-y-3 rounded-lg border bg-card p-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Provider</label>
                <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value as any })}
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">
                  <option value="platform">Platform default (Lovable AI Gateway)</option>
                  <option value="openai">OpenAI (this store's key)</option>
                  <option value="gemini">Gemini (this store's key)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Model override</label>
                <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">
                  <option value="">Use platform default</option>
                  {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Monthly token limit</label>
                <Input
                  type="number" min={0}
                  value={form.monthly_token_limit}
                  onChange={(e) => setForm({ ...form, monthly_token_limit: e.target.value })}
                  placeholder="0 = unlimited"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-card p-3">
              <div className="text-xs font-semibold text-muted-foreground">Provider keys (per-store)</div>
              <ProviderKeyField
                icon={KeyRound} label="OpenAI API key"
                existing={row.config?.openai_key_masked}
                value={openai} onChange={setOpenai}
                onClear={() => clearKey("openai")} placeholder="sk-…"
              />
              <ProviderKeyField
                icon={KeyRound} label="Gemini API key"
                existing={row.config?.gemini_key_masked}
                value={gemini} onChange={setGemini}
                onClear={() => clearKey("gemini")} placeholder="AIza…"
              />
            </div>

            <div className="rounded-lg border bg-card p-3">
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <textarea
                value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1 h-20 w-full rounded-md border bg-background p-2 text-sm"
                placeholder="Internal notes…"
              />
            </div>

            <div className="rounded-lg border bg-card p-3 text-xs">
              <div className="mb-1 font-semibold text-muted-foreground">Usage (30d)</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Cell label="Requests" value={row.usage30d.requests} />
                <Cell label="Tokens" value={`${(row.usage30d.tokens / 1000).toFixed(1)}k`} />
                <Cell label="Cost" value={`$${row.usage30d.cost.toFixed(3)}`} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Cell({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md bg-muted p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
