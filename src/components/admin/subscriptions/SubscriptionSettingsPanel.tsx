import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getSubscriptionSettings, saveSubscriptionSettings } from "@/lib/subscriptions-admin.functions";
import { CYCLE_LABEL, CYCLES } from "@/lib/subscriptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function SubscriptionSettingsPanel() {
  const load = useServerFn(getSubscriptionSettings);
  const save = useServerFn(saveSubscriptionSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "subscription-settings"], queryFn: () => load() });
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm({ ...(data as any) });
  }, [data]);

  if (!form) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await save({
        data: {
          auto_renew_default: !!form.auto_renew_default,
          default_billing_cycle: form.default_billing_cycle ?? "monthly",
          allow_free_trial: !!form.allow_free_trial,
          trial_days: Number(form.trial_days ?? 0),
          grace_period_days: Number(form.grace_period_days ?? 0),
          renewal_reminder_days: Number(form.renewal_reminder_days ?? 0),
          failed_payment_retry: Number(form.failed_payment_retry ?? 0),
          setup_fee: Number(form.setup_fee ?? 0),
          tax_percent: Number(form.tax_percent ?? 0),
          invoice_prefix: String(form.invoice_prefix ?? "SUB"),
          success_redirect_url: form.success_redirect_url || null,
          cancellation_policy: form.cancellation_policy || null,
          refund_policy: form.refund_policy || null,
          subscription_terms: form.subscription_terms || null,
          cod_enabled: !!form.cod_enabled,
          notify_email: !!form.notify_email,
          notify_sms: !!form.notify_sms,
          notify_whatsapp: !!form.notify_whatsapp,
        },
      });
      qc.invalidateQueries({ queryKey: ["admin", "subscription-settings"] });
      toast.success("Settings saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-4">
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Billing defaults</h2>
        <Toggle label="Auto renewal on by default" checked={!!form.auto_renew_default} onChange={(v) => set("auto_renew_default", v)} />
        <div>
          <Label className="text-xs">Default billing cycle</Label>
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.default_billing_cycle ?? "monthly"}
            onChange={(e) => set("default_billing_cycle", e.target.value)}
          >
            {CYCLES.map((c) => (
              <option key={c} value={c}>{CYCLE_LABEL[c]}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Num label="Setup fee (৳)" value={form.setup_fee} onChange={(v) => set("setup_fee", v)} />
          <Num label="Tax %" value={form.tax_percent} onChange={(v) => set("tax_percent", v)} />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Trial & lifecycle</h2>
        <Toggle label="Allow free trial" checked={!!form.allow_free_trial} onChange={(v) => set("allow_free_trial", v)} />
        <div className="grid grid-cols-2 gap-3">
          <Num label="Trial days" value={form.trial_days} onChange={(v) => set("trial_days", v)} />
          <Num label="Grace period (days)" value={form.grace_period_days} onChange={(v) => set("grace_period_days", v)} />
          <Num label="Renewal reminder (days before)" value={form.renewal_reminder_days} onChange={(v) => set("renewal_reminder_days", v)} />
          <Num label="Failed payment retries" value={form.failed_payment_retry} onChange={(v) => set("failed_payment_retry", v)} />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Checkout & invoices</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Invoice prefix</Label>
            <Input value={form.invoice_prefix ?? "SUB"} onChange={(e) => set("invoice_prefix", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Success redirect URL</Label>
            <Input value={form.success_redirect_url ?? ""} onChange={(e) => set("success_redirect_url", e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <Toggle label="Allow Cash on Delivery for subscriptions" checked={!!form.cod_enabled} onChange={(v) => set("cod_enabled", v)} />
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Notifications</h2>
        <Toggle label="Email notifications" checked={!!form.notify_email} onChange={(v) => set("notify_email", v)} />
        <Toggle label="SMS notifications" checked={!!form.notify_sms} onChange={(v) => set("notify_sms", v)} />
        <Toggle label="WhatsApp notifications" checked={!!form.notify_whatsapp} onChange={(v) => set("notify_whatsapp", v)} />
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Policies</h2>
        <div>
          <Label className="text-xs">Subscription terms</Label>
          <Textarea rows={3} value={form.subscription_terms ?? ""} onChange={(e) => set("subscription_terms", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Cancellation policy</Label>
          <Textarea rows={3} value={form.cancellation_policy ?? ""} onChange={(e) => set("cancellation_policy", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Refund policy</Label>
          <Textarea rows={3} value={form.refund_policy ?? ""} onChange={(e) => set("refund_policy", e.target.value)} />
        </div>
      </section>

      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: any; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={0} value={value ?? 0} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}
