import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { getAiAdminSettings, saveAiAdminSettings } from "@/lib/ai-admin.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/owner/ai-admin/settings")({ component: Page });

function Page() {
  const get = useServerFn(getAiAdminSettings);
  const save = useServerFn(saveAiAdminSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["ai-admin", "settings"], queryFn: () => get() });

  const [form, setForm] = useState({
    agent_enabled: true,
    reply_language: "auto",
    model: "google/gemini-3.8-flash",
    admin_numbers: "",
    rate_limit_per_minute: 10,
    confirm_medium_risk: true,
    confirm_high_risk: true,
    daily_digest_enabled: false,
    daily_digest_hour: 9,
    pending_alert_enabled: true,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      agent_enabled: data.agent_enabled,
      reply_language: data.reply_language ?? "auto",
      model: data.model ?? "google/gemini-3.8-flash",
      admin_numbers: (data.admin_numbers ?? []).join("\n"),
      rate_limit_per_minute: data.rate_limit_per_minute ?? 10,
      confirm_medium_risk: data.confirm_medium_risk,
      confirm_high_risk: data.confirm_high_risk,
      daily_digest_enabled: data.daily_digest_enabled,
      daily_digest_hour: data.daily_digest_hour ?? 9,
      pending_alert_enabled: data.pending_alert_enabled,
    });
  }, [data]);

  async function submit() {
    setBusy(true);
    try {
      await save({
        data: {
          ...form,
          admin_numbers: form.admin_numbers.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
          rate_limit_per_minute: Number(form.rate_limit_per_minute) || 10,
          daily_digest_hour: Number(form.daily_digest_hour) || 9,
        },
      });
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["ai-admin"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <OwnerPageHeader title="Settings" description="Who may command the assistant, how it replies, and how it confirms." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Assistant</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center justify-between gap-2 text-sm">
              Agent enabled
              <Switch checked={form.agent_enabled} onCheckedChange={(v) => setForm({ ...form, agent_enabled: v })} />
            </label>
            <div>
              <Label>Reply language</Label>
              <Select value={form.reply_language} onValueChange={(v) => setForm({ ...form, reply_language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Match the sender</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="bn">Bengali</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Model</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
            <div>
              <Label>Rate limit (messages per minute per sender)</Label>
              <Input
                type="number"
                value={form.rate_limit_per_minute}
                onChange={(e) => setForm({ ...form, rate_limit_per_minute: Number(e.target.value) })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Access & confirmation</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Authorised admin WhatsApp numbers</Label>
              <Textarea
                rows={4}
                placeholder={"8801XXXXXXXXX\n8801YYYYYYYYY"}
                value={form.admin_numbers}
                onChange={(e) => setForm({ ...form, admin_numbers: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                One per line. Messages from any other number are ignored.
              </p>
            </div>
            <label className="flex items-center justify-between gap-2 text-sm">
              Confirm medium-risk actions
              <Switch
                checked={form.confirm_medium_risk}
                onCheckedChange={(v) => setForm({ ...form, confirm_medium_risk: v })}
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-sm">
              Confirm high-risk actions
              <Switch
                checked={form.confirm_high_risk}
                onCheckedChange={(v) => setForm({ ...form, confirm_high_risk: v })}
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-sm">
              Alert me about pending confirmations
              <Switch
                checked={form.pending_alert_enabled}
                onCheckedChange={(v) => setForm({ ...form, pending_alert_enabled: v })}
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-sm">
              Daily summary
              <Switch
                checked={form.daily_digest_enabled}
                onCheckedChange={(v) => setForm({ ...form, daily_digest_enabled: v })}
              />
            </label>
            {form.daily_digest_enabled ? (
              <div>
                <Label>Summary hour (24h, Asia/Dhaka)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={form.daily_digest_hour}
                  onChange={(e) => setForm({ ...form, daily_digest_hour: Number(e.target.value) })}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Button className="mt-4" disabled={busy} onClick={submit}>
        <Save className="mr-1 h-4 w-4" />{busy ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
