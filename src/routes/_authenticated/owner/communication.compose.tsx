import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Send, Users, Save, Sparkles, Loader2, Code2 } from "lucide-react";
import {
  previewCommunication, sendCommunication,
  listOwnerTemplates, saveOwnerTemplate, getGmailStatus,
  generateCommunicationDraft,
} from "@/lib/communication.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/owner/communication/compose")({
  component: Compose,
});

type Form = {
  subject: string;
  body_html: string;
  notification_title: string;
  notification_body: string;
  send_email: boolean;
  send_inapp: boolean;
  audience_kind: "all" | "stores" | "status" | "plan" | "users";
  audience_filter: Record<string, any>;
};

const empty: Form = {
  subject: "",
  body_html: "",
  notification_title: "",
  notification_body: "",
  send_email: true,
  send_inapp: true,
  audience_kind: "all",
  audience_filter: {},
};

function Compose() {
  const nav = useNavigate();
  const preview = useServerFn(previewCommunication);
  const send = useServerFn(sendCommunication);
  const listTpls = useServerFn(listOwnerTemplates);
  const saveTpl = useServerFn(saveOwnerTemplate);
  const status = useServerFn(getGmailStatus);
  const [form, setForm] = useState<Form>(empty);
  const [sending, setSending] = useState(false);
  const [tplName, setTplName] = useState("");
  const genDraft = useServerFn(generateCommunicationDraft);
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState<"friendly" | "formal" | "urgent" | "promotional">("friendly");
  const [generating, setGenerating] = useState(false);
  const [showHtml, setShowHtml] = useState(false);

  async function doGenerate() {
    if (brief.trim().length < 3) return toast.error("আগে আপনার বার্তাটি লিখুন");
    setGenerating(true);
    try {
      const r = await genDraft({ data: { brief, tone } as any });
      setForm((f) => ({
        ...f,
        subject: r.subject || f.subject,
        body_html: r.body_html || f.body_html,
        notification_title: r.notification_title || f.notification_title,
        notification_body: r.notification_body || f.notification_body,
      }));
      toast.success("AI সুন্দর করে সাজিয়ে দিয়েছে — নিচে দেখে নিন");
    } catch (e: any) {
      toast.error(e?.message ?? "AI তৈরি করতে পারেনি");
    } finally {
      setGenerating(false);
    }
  }

  const { data: gmail } = useQuery({ queryKey: ["gmail-status"], queryFn: () => status() });
  const { data: templates = [] } = useQuery({ queryKey: ["owner-tpls"], queryFn: () => listTpls() });
  const { data: audience } = useQuery({
    queryKey: ["comm-audience", form.audience_kind, form.audience_filter],
    queryFn: () => preview({ data: {
      audience_kind: form.audience_kind, audience_ids: [], audience_filter: form.audience_filter,
    }}),
  });

  function set<K extends keyof Form>(k: K, v: Form[K]) { setForm((f) => ({ ...f, [k]: v })); }

  const canSend = useMemo(() => {
    if (!form.subject.trim()) return false;
    if (!form.send_email && !form.send_inapp) return false;
    if (form.send_email && !gmail?.connected) return false;
    return (audience?.count ?? 0) > 0;
  }, [form, audience, gmail]);

  async function doSend() {
    if (!canSend) return;
    if (!confirm(`Send to ${audience?.count} recipient(s) now?`)) return;
    setSending(true);
    try {
      const r = await send({ data: {
        subject: form.subject,
        body_html: form.body_html,
        notification_title: form.notification_title || null,
        notification_body: form.notification_body || null,
        send_email: form.send_email,
        send_inapp: form.send_inapp,
        audience_kind: form.audience_kind,
        audience_ids: [],
        audience_filter: form.audience_filter,
      } as any });
      toast.success(`Sent · ${r.emailSent} email · ${r.inappCreated} in-app · ${r.emailFailed} failed`);
      nav({ to: "/owner/communication/history" });
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function saveAsTemplate() {
    if (!tplName.trim()) return toast.error("Template name required");
    if (!form.subject.trim()) return toast.error("Subject required");
    try {
      await saveTpl({ data: {
        name: tplName, subject: form.subject, body_html: form.body_html,
        notification_title: form.notification_title || null,
        notification_body: form.notification_body || null,
      } as any });
      toast.success("Template saved");
      setTplName("");
    } catch (e: any) { toast.error(e?.message ?? "Save failed"); }
  }

  function loadTemplate(id: string) {
    const t = (templates as any[]).find((x) => x.id === id);
    if (!t) return;
    setForm((f) => ({
      ...f,
      subject: t.subject ?? "",
      body_html: t.body_html ?? "",
      notification_title: t.notification_title ?? "",
      notification_body: t.notification_body ?? "",
    }));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4 rounded-xl border bg-card p-4">
        {templates.length > 0 && (
          <div>
            <Label>Load template</Label>
            <select onChange={(e) => e.target.value && loadTemplate(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="">— Choose —</option>
              {(templates as any[]).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <Label>Subject (email)</Label>
          <Input value={form.subject} onChange={(e) => set("subject", e.target.value)}
            placeholder="Important update for {{store_name}}" />
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>ইমেইলের মূল লেখা (Email body)</Label>
            <Button size="sm" variant="ghost" onClick={() => setShowHtml((v) => !v)}>
              <Code2 className="mr-1 h-4 w-4" /> {showHtml ? "সাধারণ ভিউ" : "কোড দেখুন"}
            </Button>
          </div>
          {showHtml ? (
            <Textarea rows={12} value={form.body_html} onChange={(e) => set("body_html", e.target.value)}
              placeholder="<p>Hi {{store_name}},</p><p>...</p>" />
          ) : form.body_html ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none rounded-md border bg-background p-3 text-sm [&_a]:text-primary [&_li]:my-1 [&_p]:my-2"
              dangerouslySetInnerHTML={{ __html: form.body_html }}
            />
          ) : (
            <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              উপরে বার্তা লিখে “AI দিয়ে সাজান” চাপুন — ইমেইলটি এখানে তৈরি হয়ে দেখাবে।
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Variables: <code>{"{{store_name}}"}</code>, <code>{"{{owner_email}}"}</code>, <code>{"{{platform_name}}"}</code>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>In-app title (optional)</Label>
            <Input value={form.notification_title} onChange={(e) => set("notification_title", e.target.value)} />
          </div>
          <div>
            <Label>In-app body (optional)</Label>
            <Input value={form.notification_body} onChange={(e) => set("notification_body", e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:gap-4">
          <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Save as template — name" className="sm:flex-1" />
          <Button size="sm" variant="outline" onClick={saveAsTemplate}><Save className="mr-1 h-4 w-4" /> Save template</Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 text-sm font-semibold">Channels</div>
          <label className="flex items-center justify-between gap-2 text-sm">
            <span>In-App Notification</span>
            <Switch checked={form.send_inapp} onCheckedChange={(v) => set("send_inapp", v)} />
          </label>
          <label className="mt-2 flex items-center justify-between gap-2 text-sm">
            <span>Email (via Gmail)</span>
            <Switch checked={form.send_email} onCheckedChange={(v) => set("send_email", v)} />
          </label>
          {form.send_email && !gmail?.connected && (
            <p className="mt-2 text-xs text-amber-700">
              Gmail is not connected — email will be disabled. Open Gmail Connection to fix.
            </p>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 text-sm font-semibold">Audience</div>
          <select value={form.audience_kind}
            onChange={(e) => { set("audience_kind", e.target.value as any); set("audience_filter", {}); }}
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

        <Button onClick={doSend} disabled={!canSend || sending} className="w-full">
          <Send className="mr-1 h-4 w-4" /> {sending ? "Sending…" : "Send now"}
        </Button>
      </div>
    </div>
  );
}
