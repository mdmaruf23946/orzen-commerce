import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Globe, Loader2, Inbox } from "lucide-react";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { getWebchatSettings, updateWebchatSettings } from "@/lib/webchat-inbox.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/webchat")({
  component: () => (
    <FeatureGate feature="ai_agent">
      <WebchatPage />
    </FeatureGate>
  ),
  head: () => ({
    meta: [
      { title: "Web Chat AI — ORZEN Merchant Panel" },
      { name: "description", content: "Turn the AI chat box on your website on or off and set its greeting." },
      { property: "og:title", content: "Web Chat AI — ORZEN Merchant Panel" },
      { property: "og:description", content: "Turn the AI chat box on your website on or off and set its greeting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function WebchatPage() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getWebchatSettings);
  const save = useServerFn(updateWebchatSettings);
  const { data, isLoading } = useQuery({ queryKey: ["ai-messaging", "webchat"], queryFn: () => fetchSettings() });
  const [form, setForm] = useState({ enabled: true, agent_name: "", welcome_message: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm({ enabled: data.enabled, agent_name: data.agent_name, welcome_message: data.welcome_message });
  }, [data]);

  async function onSave(next = form) {
    setSaving(true);
    try {
      await save({ data: next });
      toast.success(next.enabled ? "Web Chat চালু — ওয়েবসাইটে চ্যাট বক্স দেখাবে" : "Web Chat বন্ধ — ওয়েবসাইটে চ্যাট বক্স লুকানো");
      qc.invalidateQueries({ queryKey: ["ai-messaging", "webchat"] });
      qc.invalidateQueries({ queryKey: ["admin", "agent"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <div className="grid place-items-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground"><Globe className="h-5 w-5" /></span>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Web Chat AI</h1>
          <p className="text-sm text-muted-foreground">আপনার ওয়েবসাইটের চ্যাট বক্স। গত ৭ দিনে {data?.conversations_7d ?? 0}টি কথোপকথন।</p>
        </div>
        <Button asChild variant="outline" size="sm"><Link to="/admin/webchat-inbox"><Inbox className="mr-1 h-4 w-4" />Inbox</Link></Button>
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-card p-4">
        <div>
          <div className="font-medium">ওয়েবসাইটে চ্যাট বক্স</div>
          <p className="text-xs text-muted-foreground">চালু করলে সাথে সাথে আপনার স্টোরের ওয়েবসাইটে দেখাবে।</p>
        </div>
        <Switch
          checked={form.enabled}
          disabled={saving}
          onCheckedChange={(v) => { const next = { ...form, enabled: v }; setForm(next); void onSave(next); }}
        />
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="space-y-1.5">
          <Label>সহকারীর নাম</Label>
          <Input value={form.agent_name} maxLength={80} onChange={(e) => setForm({ ...form, agent_name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>স্বাগতম বার্তা</Label>
          <Textarea rows={3} value={form.welcome_message} maxLength={500} onChange={(e) => setForm({ ...form, welcome_message: e.target.value })} />
        </div>
        <Button onClick={() => onSave()} disabled={saving || !form.agent_name.trim() || !form.welcome_message.trim()}>
          {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save
        </Button>
      </div>
    </div>
  );
}
