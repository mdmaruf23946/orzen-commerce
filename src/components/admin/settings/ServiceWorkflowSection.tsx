// Store Admin → Settings → Service workflow.
// Controls which service stages are visible to clients, revisions, cancel policy
// and the support channels shown on the service order page.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  SERVICE_STAGES,
  SERVICE_STAGE_LABEL,
  type ServiceWorkflowSettings,
} from "@/lib/service-workflow";
import {
  getServiceWorkflowSettings,
  saveServiceWorkflowSettings,
} from "@/lib/service-order-admin.functions";

const CHANNELS: { key: string; label: string }[] = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "messenger", label: "Messenger" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Call" },
  { key: "live_chat", label: "Live chat" },
];

export function ServiceWorkflowSection() {
  const get = useServerFn(getServiceWorkflowSettings);
  const put = useServerFn(saveServiceWorkflowSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "service-workflow"], queryFn: () => get() });
  const [form, setForm] = useState<ServiceWorkflowSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data as ServiceWorkflowSettings);
  }, [data]);

  async function submit() {
    if (!form) return;
    setSaving(true);
    try {
      await put({
        data: {
          enabled_stages: form.enabled_stages,
          default_revisions: form.default_revisions,
          allow_cancel: form.allow_cancel,
          cancel_window_hours: form.cancel_window_hours,
          response_time: form.response_time,
          support_channels: form.support_channels,
          support_whatsapp: form.support_whatsapp,
          support_messenger: form.support_messenger,
          support_email: form.support_email,
          support_phone: form.support_phone,
          allow_reviews: form.allow_reviews,
        },
      });
      qc.invalidateQueries({ queryKey: ["admin", "service-workflow"] });
      toast.success("Service workflow saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function toggleStage(stage: string) {
    setForm((f) => {
      if (!f) return f;
      const has = f.enabled_stages.includes(stage as any);
      const next = has
        ? f.enabled_stages.filter((s) => s !== stage)
        : [...f.enabled_stages, stage as any];
      return { ...f, enabled_stages: next };
    });
  }

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Workflow className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">Service Workflow</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Stages, revisions and support channels shown on service order pages. Physical orders are unaffected.
          </p>
        </div>
      </div>

      {!form ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-sm font-medium">Enabled stages</div>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_STAGES.map((s) => {
                const active = form.enabled_stages.includes(s);
                const locked = s === "request_submitted";
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={locked}
                    onClick={() => toggleStage(s)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                      active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    } ${locked ? "opacity-70" : ""}`}
                  >
                    {SERVICE_STAGE_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Default revisions</span>
              <Input
                type="number"
                min={0}
                value={form.default_revisions}
                onChange={(e) => setForm({ ...form, default_revisions: Number(e.target.value) })}
                className="h-9"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Cancel window (hours)</span>
              <Input
                type="number"
                min={0}
                value={form.cancel_window_hours}
                onChange={(e) => setForm({ ...form, cancel_window_hours: Number(e.target.value) })}
                className="h-9"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs text-muted-foreground">Response time promise</span>
              <Input
                value={form.response_time ?? ""}
                onChange={(e) => setForm({ ...form, response_time: e.target.value || null })}
                placeholder="e.g. Replies within 2 hours"
                className="h-9"
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.allow_cancel}
                onCheckedChange={(v) => setForm({ ...form, allow_cancel: v })}
              />
              Allow client cancel
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.allow_reviews}
                onCheckedChange={(v) => setForm({ ...form, allow_reviews: v })}
              />
              Allow rating &amp; review
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Support channels</div>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map((c) => {
                const active = !!form.support_channels?.[c.key];
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        support_channels: { ...form.support_channels, [c.key]: !active },
                      })
                    }
                    className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                      active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input
                value={form.support_whatsapp ?? ""}
                onChange={(e) => setForm({ ...form, support_whatsapp: e.target.value || null })}
                placeholder="WhatsApp number"
                className="h-9"
              />
              <Input
                value={form.support_messenger ?? ""}
                onChange={(e) => setForm({ ...form, support_messenger: e.target.value || null })}
                placeholder="Messenger link"
                className="h-9"
              />
              <Input
                value={form.support_email ?? ""}
                onChange={(e) => setForm({ ...form, support_email: e.target.value || null })}
                placeholder="Support email"
                className="h-9"
              />
              <Input
                value={form.support_phone ?? ""}
                onChange={(e) => setForm({ ...form, support_phone: e.target.value || null })}
                placeholder="Support phone"
                className="h-9"
              />
            </div>
          </div>

          <Button onClick={submit} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving…" : "Save service workflow"}
          </Button>
        </div>
      )}
    </section>
  );
}
