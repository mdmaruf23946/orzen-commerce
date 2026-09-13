import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Save } from "lucide-react";
import {
  listAiAdminRules,
  saveAiAdminRule,
  getAiAdminSettings,
  saveAiAdminSettings,
  sendAiAdminTestEvent,
  runAiAdminCommand,
} from "@/lib/ai-admin.functions";
import { NOTIFICATION_EVENTS } from "@/lib/ai-admin/catalog";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/owner/ai-admin/automation")({ component: Page });

const TEST_EVENTS = ["new_user", "payment", "new_subscription", "new_order"];

function Page() {
  const rulesFn = useServerFn(listAiAdminRules);
  const saveRule = useServerFn(saveAiAdminRule);
  const settingsFn = useServerFn(getAiAdminSettings);
  const saveSettings = useServerFn(saveAiAdminSettings);
  const testEvent = useServerFn(sendAiAdminTestEvent);
  const runCmd = useServerFn(runAiAdminCommand);
  const qc = useQueryClient();

  const { data: rules = [] } = useQuery({ queryKey: ["ai-admin", "rules"], queryFn: () => rulesFn() });
  const { data: settings } = useQuery({ queryKey: ["ai-admin", "settings"], queryFn: () => settingsFn() });
  const [cmd, setCmd] = useState("Show today's revenue");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState("");

  async function toggleRule(r: any, enabled: boolean) {
    await saveRule({ data: { event_key: r.event_key, enabled, template: r.template, recipient: r.recipient } });
    qc.invalidateQueries({ queryKey: ["ai-admin", "rules"] });
  }

  async function toggleTestMode(v: boolean) {
    await saveSettings({ data: { test_mode: v } });
    qc.invalidateQueries({ queryKey: ["ai-admin", "settings"] });
    toast.success(v ? "Test mode on" : "Test mode off");
  }

  async function fireTest(key: string) {
    setBusy(key);
    try {
      const res: any = await testEvent({ data: { event_key: key } });
      if (res?.sent) toast.success("Test notification sent");
      else toast.error(res?.reason || "Not sent");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function testCommand() {
    setBusy("cmd");
    try {
      const res: any = await runCmd({ data: { text: cmd } });
      setReply(res?.reply ?? "");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <OwnerPageHeader
        title="Automation"
        description="Turn event notifications on or off and run test events before going live."
      />

      <Card className="mb-4">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Test mode</CardTitle>
          <Switch checked={!!settings?.test_mode} onCheckedChange={toggleTestMode} />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            In test mode, notification messages are prefixed with [TEST] so live events stay recognisable.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Event notifications</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {NOTIFICATION_EVENTS.map((ev) => {
              const r = (rules as any[]).find((x) => x.event_key === ev.key);
              if (!r) return null;
              return (
                <div key={ev.key} className="flex items-center justify-between gap-3 rounded-md border p-2">
                  <div className="text-sm">{ev.label}</div>
                  <div className="flex items-center gap-2">
                    {TEST_EVENTS.includes(ev.key) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === ev.key}
                        onClick={() => fireTest(ev.key)}
                      >
                        <FlaskConical className="mr-1 h-3 w-3" />Test
                      </Button>
                    ) : null}
                    <Switch checked={r.enabled} onCheckedChange={(v) => toggleRule(r, v)} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Test a command</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Command</Label>
              <Input value={cmd} onChange={(e) => setCmd(e.target.value)} />
            </div>
            <Button size="sm" disabled={busy === "cmd"} onClick={testCommand}>
              <Save className="mr-1 h-4 w-4" />{busy === "cmd" ? "Running…" : "Run test command"}
            </Button>
            {reply ? (
              <div className="whitespace-pre-wrap rounded-md border bg-muted/40 p-2 text-sm">{reply}</div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
