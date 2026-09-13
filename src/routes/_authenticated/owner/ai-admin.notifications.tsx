import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { listAiAdminRules, saveAiAdminRule } from "@/lib/ai-admin.functions";
import { NOTIFICATION_EVENTS } from "@/lib/ai-admin/catalog";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/owner/ai-admin/notifications")({ component: Page });

type Rule = { event_key: string; enabled: boolean; template: string; recipient: string | null };

function Page() {
  const list = useServerFn(listAiAdminRules);
  const save = useServerFn(saveAiAdminRule);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["ai-admin", "rules"], queryFn: () => list() });
  const [draft, setDraft] = useState<Record<string, Rule>>({});

  useEffect(() => {
    const next: Record<string, Rule> = {};
    for (const ev of NOTIFICATION_EVENTS) {
      const row = (data as any[]).find((r) => r.event_key === ev.key);
      next[ev.key] = {
        event_key: ev.key,
        enabled: row?.enabled ?? true,
        template: row?.template ?? "",
        recipient: row?.recipient ?? "",
      };
    }
    setDraft(next);
  }, [data]);

  async function persist(key: string, patch?: Partial<Rule>) {
    const rule = { ...draft[key]!, ...patch };
    setDraft((d) => ({ ...d, [key]: rule }));
    try {
      await save({ data: { ...rule, recipient: rule.recipient || null } });
      qc.invalidateQueries({ queryKey: ["ai-admin", "rules"] });
      toast.success("Saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <OwnerPageHeader
        title="Notifications"
        description="Website events sent to your WhatsApp. Use {{variable}} placeholders inside the templates."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {NOTIFICATION_EVENTS.map((ev) => {
          const rule = draft[ev.key];
          if (!rule) return null;
          return (
            <Card key={ev.key}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{ev.label}</CardTitle>
                <Switch checked={rule.enabled} onCheckedChange={(v) => persist(ev.key, { enabled: v })} />
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Message template</Label>
                  <Textarea
                    rows={5}
                    value={rule.template}
                    onChange={(e) => setDraft((d) => ({ ...d, [ev.key]: { ...rule, template: e.target.value } }))}
                  />
                </div>
                <div>
                  <Label>Recipient (optional — defaults to admin numbers)</Label>
                  <Input
                    placeholder="8801XXXXXXXXX"
                    value={rule.recipient ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [ev.key]: { ...rule, recipient: e.target.value } }))}
                  />
                </div>
                <Button size="sm" onClick={() => persist(ev.key)}><Save className="mr-1 h-4 w-4" />Save</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
