import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import {
  listSubscriptionProviders,
  saveSubscriptionProvider,
  setActiveSubscriptionProvider,
  testSubscriptionProvider,
} from "@/lib/subscription-pay/pay.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/owner/subscription-pay/providers")({
  component: ProvidersPage,
});

function ProvidersPage() {
  const listFn = useServerFn(listSubscriptionProviders);
  const saveFn = useServerFn(saveSubscriptionProvider);
  const activateFn = useServerFn(setActiveSubscriptionProvider);
  const testFn = useServerFn(testSubscriptionProvider);
  const qc = useQueryClient();
  const { data: providers } = useQuery({ queryKey: ["owner", "subProviders"], queryFn: () => listFn() });
  const [forms, setForms] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Link to="/owner/subscription-pay" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-2xl font-semibold">Payment providers</h1>
      <p className="text-sm text-muted-foreground">
        Configure one active provider for ORZEN subscription checkout. Adding a new provider only requires a new adapter file.
      </p>

      <div className="space-y-4">
        {(providers ?? []).map((p: any) => {
          const meta = p.meta;
          const form = forms[p.id] ?? { credentials: {} };
          const setForm = (patch: any) => setForms((s) => ({ ...s, [p.id]: { ...form, ...patch } }));
          return (
            <div key={p.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{p.label}</h2>
                  {p.is_active && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">ACTIVE</span>}
                  {p.status === "connected" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> Connected
                    </span>
                  )}
                  {p.status === "error" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">
                      <XCircle className="h-3 w-3" /> Error
                    </span>
                  )}
                  {p.sandbox && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">Sandbox</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Enabled</Label>
                  <Switch
                    checked={!!p.enabled}
                    onCheckedChange={async (v) => {
                      try { await saveFn({ data: { id: p.id, enabled: v } }); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["owner", "subProviders"] }); }
                      catch (e) { toast.error((e as Error).message); }
                    }}
                  />
                </div>
              </div>

              {p.status_message && (
                <p className={`mt-1 text-xs ${p.status === "error" ? "text-red-600" : "text-muted-foreground"}`}>
                  {p.status_message}{p.latency_ms != null ? ` · ${p.latency_ms}ms` : ""}
                </p>
              )}

              {meta && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {meta.credentialFields.map((f: any) => (
                    <div key={f.key} className="space-y-1.5">
                      <Label>{f.label}</Label>
                      <Input
                        type={f.type === "password" ? "password" : "text"}
                        placeholder={f.placeholder ?? (p.credential_keys_set?.includes(f.key) ? "•••••• (set)" : "")}
                        value={form.credentials?.[f.key] ?? ""}
                        onChange={(e) => setForm({ credentials: { ...form.credentials, [f.key]: e.target.value } })}
                      />
                    </div>
                  ))}
                  {meta.supportsSandbox && (
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={form.sandbox ?? p.sandbox}
                        onCheckedChange={(v) => setForm({ sandbox: v })}
                      />
                      Sandbox mode
                    </label>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy === p.id}
                  onClick={async () => {
                    setBusy(p.id);
                    try {
                      await saveFn({ data: { id: p.id, credentials: form.credentials, sandbox: form.sandbox } });
                      toast.success("Saved");
                      setForms((s) => ({ ...s, [p.id]: { credentials: {} } }));
                      qc.invalidateQueries({ queryKey: ["owner", "subProviders"] });
                    } catch (e) { toast.error((e as Error).message); }
                    finally { setBusy(null); }
                  }}
                >Save credentials</Button>
                <Button
                  size="sm" variant="outline" disabled={busy === p.id}
                  onClick={async () => {
                    setBusy(p.id);
                    try {
                      const r = await testFn({ data: { id: p.id } });
                      r.ok ? toast.success(r.message) : toast.error(r.message);
                      qc.invalidateQueries({ queryKey: ["owner", "subProviders"] });
                    } catch (e) { toast.error((e as Error).message); }
                    finally { setBusy(null); }
                  }}
                >Test connection</Button>
                {!p.is_active && (
                  <Button
                    size="sm" variant="secondary"
                    onClick={async () => {
                      try { await activateFn({ data: { id: p.id } }); toast.success(`${p.label} is now active`); qc.invalidateQueries({ queryKey: ["owner", "subProviders"] }); }
                      catch (e) { toast.error((e as Error).message); }
                    }}
                  >Set active</Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
