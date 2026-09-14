import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { AgentStatusPill } from "@/components/admin/ai/AgentStatusPill";
import { aiGetOverview, aiToggleAgent } from "@/lib/merchant-ai.functions";

export const Route = createFileRoute("/_authenticated/admin/ai/agents")({
  head: () => ({
    meta: [
      { title: "AI Agents — ORZEN Merchant Panel" },
      { name: "description", content: "Turn each AI agent on or off and see its status." },
      { property: "og:title", content: "AI Agents — ORZEN Merchant Panel" },
      { property: "og:description", content: "Turn each AI agent on or off and see its status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeatureGate feature="ai_agent">
      <AgentsPage />
    </FeatureGate>
  ),
});

const SETUP_LINK: Record<string, string> = {
  messenger: "/admin/messenger",
  whatsapp: "/admin/whatsapp",
  facebook: "/admin/facebook",
};

function AgentsPage() {
  const overviewFn = useServerFn(aiGetOverview);
  const toggleFn = useServerFn(aiToggleAgent);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["ai-cc-overview"], queryFn: () => overviewFn() });

  async function toggle(agent: string, enabled: boolean) {
    try {
      await toggleFn({ data: { agent, enabled } });
      await qc.invalidateQueries({ queryKey: ["ai-cc-overview"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Bot className="h-6 w-6" /> Agents
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each agent handles one part of your business. The Master Agent calls them for you.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(data?.agents ?? []).map((a: any) => (
          <div key={a.key} className="flex flex-col rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium">{a.label}</div>
              <AgentStatusPill status={a.status} />
            </div>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{a.description}</p>
            {a.lastError && <p className="mt-2 text-xs text-destructive">{a.lastError}</p>}
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <span className="text-xs text-muted-foreground">
                {a.lastActivityAt ? `Last active ${new Date(a.lastActivityAt).toLocaleString()}` : "No activity yet"}
              </span>
              {a.locked ? (
                <Button asChild size="sm" variant="outline">
                  <Link to="/admin/billing" search={{} as never}>Update</Link>
                </Button>
              ) : a.channel && !a.connected ? (
                <Button asChild size="sm" variant="outline">
                  <Link to={SETUP_LINK[a.channel] as never}>Connect</Link>
                </Button>
              ) : (
                <Switch checked={a.enabled} onCheckedChange={(v) => toggle(a.key, v)} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
