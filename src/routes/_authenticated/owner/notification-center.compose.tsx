import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Send, Save, Users } from "lucide-react";
import { saveCampaign, resolveAudience, sendCampaign, scheduleCampaign, getCampaign } from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/owner/notification-center/compose")({
  component: Compose,
  validateSearch: (s: Record<string, unknown>) => ({ draft: s.draft as string | undefined }),
});

type Form = {
  id?: string;
  title: string;
  body_html: string;
  type: string;
  priority: "normal" | "important" | "urgent";
  channels: ("email" | "in_app")[];
  action_label: string;
  action_type: "internal" | "external" | "none";
  action_target: string;
  audience_kind: "all" | "stores" | "users" | "plan" | "status";
  audience_ids: string[];
  audience_filter: Record<string, any>;
  scheduled_at: string;
};

const empty: Form = {
  title: "", body_html: "", type: "announcement", priority: "normal",
  channels: ["in_app"], action_label: "", action_type: "none", action_target: "",
  audience_kind: "all", audience_ids: [], audience_filter: {}, scheduled_at: "",
};

const types = [
  "announcement", "important_update", "maintenance", "system_alert",
  "feature_update", "billing_notice", "security_alert", "general",
];

function Compose() {
  const search = useSearch({ from: Route.id });
  const nav = useNavigate();
  const save = useServerFn(saveCampaign);
  const resolve = useServerFn(resolveAudience);
  const send = useServerFn(sendCampaign);
  const schedule = useServerFn(scheduleCampaign);
  const getOne = useServerFn(getCampaign);
  const [form, setForm] = useState<Form>(empty);

  const { data: draftData } = useQuery({
    queryKey: ["notif-draft", search.draft],
    queryFn: () => getOne({ data: { id: search.draft! } }),
    enabled: !!search.draft,
  });

  useEffect(() => {
    if (draftData?.campaign) {
      const c: any = draftData.campaign;
      setForm({
        id: c.id, title: c.title, body_html: c.body_html || "", type: c.type,
        priority: c.priority, channels: c.channels, action_label: c.action_label || "",
        action_type: c.action_type || "none", action_target: c.action_target || "",
        audience_kind: c.audience_kind, audience_ids: c.audience_ids || [],
        audience_filter: c.audience_filter || {}, scheduled_at: c.scheduled_at || "",
      });
    }
  }, [draftData]);

  const { data: audience } = useQuery({
    queryKey: ["notif-audience", form.audience_kind, form.audience_ids, form.audience_filter],
    queryFn: () => resolve({ data: { audience_kind: form.audience_kind, audience_ids: form.audience_ids, audience_filter: form.audience_filter } }),
  });

  function set<K extends keyof Form>(k: K, v: Form[K]) { setForm((f) => ({ ...f, [k]: v })); }
  function toggleChannel(ch: "email" | "in_app") {
    setForm((f) => ({ ...f, channels: f.channels.includes(ch) ? f.channels.filter((x) => x !== ch) : [...f.channels, ch] }));
  }

  const payload = useMemo(() => {
    const p: any = { ...form };
    if (!p.scheduled_at) delete p.scheduled_at;
    if (!p.action_label) p.action_label = null;
    if (!p.action_target) p.action_target = null;
    return p;
  }, [form]);

  async function handleSave(): Promise<string | null> {
    if (!form.title.trim()) { toast.error("Title required"); return null; }
    if (form.channels.length === 0) { toast.error("Pick at least one channel"); return null; }
    try {
      const r = await save({ data: payload });
      set("id", r.id);
      toast.success("Saved");
      return r.id;
    } catch (e) { toast.error((e as Error).message); return null; }
  }

  async function handleSendNow() {
    if (!(audience?.count ?? 0)) { toast.error("No recipients"); return; }
    if (!confirm(`Send to ${audience?.count} recipients now?`)) return;
    const id = await handleSave(); if (!id) return;
    try {
      const r = await send({ data: { id } });
      toast.success(`Sent · ${r.emailSent} email · ${r.inappCreated} in-app`);
      nav({ to: "/owner/notification-center" });
    } catch (e) { toast.error((e as Error).message); }
  }

  async function handleSchedule() {
    if (!form.scheduled_at) { toast.error("Pick date/time"); return; }
    const id = await handleSave(); if (!id) return;
    try {
      await schedule({ data: { id, at: new Date(form.scheduled_at).toISOString() } });
      toast.success("Scheduled");
      nav({ to: "/owner/notification-center" });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div>
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Maintenance notice" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Type</Label>
            <select value={form.type} onChange={(e) => set("type", e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              {types.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <Label>Priority</Label>
            <select value={form.priority} onChange={(e) => set("priority", e.target.value as any)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <div>
          <Label>Message (HTML supported)</Label>
          <Textarea rows={10} value={form.body_html} onChange={(e) => set("body_html", e.target.value)}
            placeholder="<p>Hello,</p><p>We'll be performing maintenance...</p>" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Action Type</Label>
            <select value={form.action_type} onChange={(e) => set("action_type", e.target.value as any)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="none">None</option>
              <option value="internal">Internal path</option>
              <option value="external">External URL (https)</option>
            </select>
          </div>
          <div>
            <Label>Button Label</Label>
            <Input value={form.action_label} onChange={(e) => set("action_label", e.target.value)} disabled={form.action_type === "none"} />
          </div>
          <div>
            <Label>Target</Label>
            <Input value={form.action_target} onChange={(e) => set("action_target", e.target.value)}
              placeholder={form.action_type === "external" ? "https://..." : "/admin/billing"}
              disabled={form.action_type === "none"} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 text-sm font-semibold">Channels</div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.channels.includes("in_app")} onChange={() => toggleChannel("in_app")} />
            In-App Notification
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.channels.includes("email")} onChange={() => toggleChannel("email")} />
            Email
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            Email requires a configured sender domain. If not set up, email sends will be recorded as failed.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 text-sm font-semibold">Audience</div>
          <select value={form.audience_kind} onChange={(e) => { set("audience_kind", e.target.value as any); set("audience_ids", []); set("audience_filter", {}); }}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            <option value="all">All store owners</option>
            <option value="status">By subscription status</option>
          </select>
          {form.audience_kind === "status" && (
            <select value={form.audience_filter.status ?? ""}
              onChange={(e) => set("audience_filter", { status: e.target.value })}
              className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="">Choose status</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
            </select>
          )}
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 p-2 text-sm">
            <Users className="h-4 w-4" />
            <span className="font-semibold">{audience?.count ?? 0}</span>
            <span className="text-muted-foreground">recipients</span>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 text-sm font-semibold">Schedule</div>
          <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => set("scheduled_at", e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">Leave empty to send now.</p>
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={handleSave}><Save className="mr-1 h-4 w-4" />Save draft</Button>
          {form.scheduled_at
            ? <Button onClick={handleSchedule}><Send className="mr-1 h-4 w-4" />Schedule</Button>
            : <Button onClick={handleSendNow}><Send className="mr-1 h-4 w-4" />Send now</Button>}
        </div>
      </div>
    </div>
  );
}
