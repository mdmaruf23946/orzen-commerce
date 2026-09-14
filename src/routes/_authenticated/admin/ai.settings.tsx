import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Settings2, Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FeatureGate } from "@/components/admin/FeatureGate";
import {
  aiGetNotificationRules,
  aiGetOverview,
  aiSetNotificationRule,
  aiSetPermission,
} from "@/lib/merchant-ai.functions";
import { AGENT_BY_KEY, MERCHANT_ACTIONS, NOTIFICATION_EVENTS } from "@/lib/merchant-ai/registry";

export const Route = createFileRoute("/_authenticated/admin/ai/settings")({
  head: () => ({
    meta: [
      { title: "AI Settings — ORZEN Merchant Panel" },
      { name: "description", content: "Choose what your AI can do on its own and what needs your approval." },
      { property: "og:title", content: "AI Settings — ORZEN Merchant Panel" },
      { property: "og:description", content: "Choose what your AI can do on its own and what needs your approval." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeatureGate feature="ai_agent">
      <AiSettingsPage />
    </FeatureGate>
  ),
});

const CHANNELS = ["panel", "messenger", "whatsapp"] as const;

function AiSettingsPage() {
  const overviewFn = useServerFn(aiGetOverview);
  const rulesFn = useServerFn(aiGetNotificationRules);
  const setPermFn = useServerFn(aiSetPermission);
  const setRuleFn = useServerFn(aiSetNotificationRule);
  const qc = useQueryClient();

  const { data: overview } = useQuery({ queryKey: ["ai-cc-overview"], queryFn: () => overviewFn() });
  const { data: ruleData } = useQuery({ queryKey: ["ai-cc-rules"], queryFn: () => rulesFn() });

  const levels = overview?.levels ?? {};
  const rules = ruleData?.rules ?? {};

  async function setLevel(actionKey: string, level: "auto" | "approval" | "restricted") {
    try {
      await setPermFn({ data: { actionKey, level } });
      await qc.invalidateQueries({ queryKey: ["ai-cc-overview"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function saveRule(eventKey: string, enabled: boolean, channels: string[]) {
    try {
      await setRuleFn({ data: { eventKey, enabled, channels: channels as never } });
      await qc.invalidateQueries({ queryKey: ["ai-cc-rules"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const openActions = MERCHANT_ACTIONS.filter((a) => !a.locked);
  const lockedActions = MERCHANT_ACTIONS.filter((a) => a.locked);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Settings2 className="h-6 w-6" /> AI Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Decide what the AI may do alone, what needs your approval, and when it should alert you.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/ai/identity">Merchant identity</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/ai/agents">Agents</Link>
          </Button>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Agent permissions</h2>
        <div className="overflow-hidden rounded-xl border bg-card">
          <ul className="divide-y">
            {openActions.map((a) => (
              <li key={a.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{a.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {AGENT_BY_KEY[a.agent]?.label} · {a.description}
                  </div>
                </div>
                <Select
                  value={(levels as any)[a.key] ?? a.defaultLevel}
                  onValueChange={(v) => setLevel(a.key, v as never)}
                >
                  <SelectTrigger className="w-[190px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="approval">Approval required</SelectItem>
                    <SelectItem value="restricted">Restricted</SelectItem>
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <Lock className="h-4 w-4" /> Permanently restricted
        </h2>
        <div className="rounded-xl border bg-muted/30 p-4">
          <ul className="space-y-2 text-sm text-muted-foreground">
            {lockedActions.map((a) => (
              <li key={a.key}>
                <span className="font-medium text-foreground">{a.label}</span> — {a.description}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Notifications</h2>
        <div className="overflow-hidden rounded-xl border bg-card">
          <ul className="divide-y">
            {NOTIFICATION_EVENTS.map((e) => {
              const rule = (rules as any)[e.key] ?? { enabled: true, channels: ["panel"] };
              return (
                <li key={e.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{e.label}</div>
                    <div className="text-xs text-muted-foreground">{e.description}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      {CHANNELS.map((c) => {
                        const on = rule.channels.includes(c);
                        return (
                          <button
                            key={c}
                            onClick={() => {
                              const next = on
                                ? rule.channels.filter((x: string) => x !== c)
                                : [...rule.channels, c];
                              if (!next.length) return;
                              saveRule(e.key, rule.enabled, next);
                            }}
                            className={`rounded-full border px-2.5 py-1 text-[11px] capitalize ${
                              on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"
                            }`}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(v) => saveRule(e.key, v, rule.channels)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
