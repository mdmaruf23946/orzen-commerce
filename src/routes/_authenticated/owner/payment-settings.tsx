import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getPaymentSettings, updatePaymentSettings } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/owner/payment-settings")({
  component: PaymentSettingsPage,
});

type MobileCfg = { enabled?: boolean; number?: string; instructions?: string; merchant_name?: string; notification_email?: string };
type SslCfg = { enabled?: boolean; store_id?: string; api_key?: string; sandbox?: boolean; instructions?: string };

function PaymentSettingsPage() {
  const get = useServerFn(getPaymentSettings);
  const save = useServerFn(updatePaymentSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["owner", "paymentSettings"], queryFn: () => get() });
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data && !form) setForm({ bkash: data.bkash ?? {}, nagad: data.nagad ?? {}, rocket: data.rocket ?? {}, sslcommerz: data.sslcommerz ?? {} }); }, [data]);

  if (!form) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  function update(key: string, patch: any) {
    setForm((f: any) => ({ ...f, [key]: { ...f[key], ...patch } }));
  }
  async function submit() {
    setSaving(true);
    try {
      await save({ data: form });
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["owner", "paymentSettings"] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  const status = (cfg: MobileCfg | SslCfg, hasCreds: boolean) =>
    cfg.enabled && hasCreds ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">Connected</span>
      : cfg.enabled ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">Missing credentials</span>
      : <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">Disabled</span>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payment Settings</h1>
        <p className="text-sm text-muted-foreground">Gateway credentials for subscriber payments. Stored privately — never shown to store owners.</p>
      </div>

      {(["bkash", "nagad", "rocket"] as const).map((k) => {
        const c: MobileCfg = form[k];
        const label = k === "bkash" ? "bKash" : k === "nagad" ? "Nagad" : "Rocket";
        return (
          <div key={k} className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">{label}</h2>
                {status(c, !!c.number)}
              </div>
              <Switch checked={!!c.enabled} onCheckedChange={(v) => update(k, { enabled: v })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Merchant name</Label><Input value={c.merchant_name ?? ""} onChange={(e) => update(k, { merchant_name: e.target.value })} placeholder="e.g. ORZEN Ltd" /></div>
              <div className="space-y-1.5"><Label>Receiving number</Label><Input value={c.number ?? ""} onChange={(e) => update(k, { number: e.target.value })} placeholder="01XXXXXXXXX" /></div>
              {k === "bkash" && (
                <div className="space-y-1.5 sm:col-span-2"><Label>Notification email</Label>
                  <Input type="email" value={c.notification_email ?? ""} onChange={(e) => update(k, { notification_email: e.target.value })} placeholder="admin@orzen.app" />
                  <p className="text-xs text-muted-foreground">New payment requests will be emailed here for verification.</p>
                </div>
              )}
            </div>
            <div className="space-y-1.5"><Label>Payment instructions (shown to customers)</Label>
              <Textarea rows={4} value={c.instructions ?? ""} onChange={(e) => update(k, { instructions: e.target.value })} placeholder={`Open the ${label} app.\nSend Money to the number above.\nCopy the Transaction ID and paste it below.`} />
              <p className="text-xs text-muted-foreground">One step per line.</p>
            </div>
          </div>
        );
      })}

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">SSLCommerz</h2>
            {status(form.sslcommerz, !!form.sslcommerz.store_id && !!form.sslcommerz.api_key)}
          </div>
          <Switch checked={!!form.sslcommerz.enabled} onCheckedChange={(v) => update("sslcommerz", { enabled: v })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Store ID</Label><Input value={form.sslcommerz.store_id ?? ""} onChange={(e) => update("sslcommerz", { store_id: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>API key</Label><Input type="password" value={form.sslcommerz.api_key ?? ""} onChange={(e) => update("sslcommerz", { api_key: e.target.value })} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={!!form.sslcommerz.sandbox} onCheckedChange={(v) => update("sslcommerz", { sandbox: v })} /> Sandbox mode
        </label>
      </div>

      <Button onClick={submit} disabled={saving} className="w-full sm:w-auto">{saving ? "Saving…" : "Save settings"}</Button>
    </div>
  );
}
