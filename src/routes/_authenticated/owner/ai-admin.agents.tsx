import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, CheckCircle2, ShieldCheck, Users, XCircle } from "lucide-react";
import { aiAgentsOverview, setCustomerAgentEnabled } from "@/lib/ai-admin.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/owner/ai-admin/agents")({
  component: Page,
});

function Page() {
  const fn = useServerFn(aiAgentsOverview);
  const toggle = useServerFn(setCustomerAgentEnabled);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["ai-admin", "agents"], queryFn: () => fn(), refetchInterval: 30_000 });

  const m = data?.messenger as any;
  const connected = m?.status === "connected";
  const psids: string[] = (m?.admin_psids ?? []) as string[];
  const settings = data?.settings as any;
  const customerOn = settings?.customer_agent_enabled ?? true;

  async function setCustomer(enabled: boolean) {
    try {
      await toggle({ data: { enabled } });
      qc.invalidateQueries({ queryKey: ["ai-admin", "agents"] });
      toast.success(enabled ? "Customer agent enabled" : "Customer agent disabled");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <OwnerPageHeader
        title="AI Agents"
        description="Two separate assistants on one Facebook Page: admins reach the private admin agent, everyone else reaches the public customer agent."
      />

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Messenger channel</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant={connected ? "default" : "secondary"} className="gap-1">
            {connected ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {connected ? "Connected" : m?.status === "error" ? "Error" : "Not connected"}
          </Badge>
          {m?.page_name ? <span className="text-muted-foreground">Page: {m.page_name}</span> : null}
          <span className="text-muted-foreground">
            Last event:{" "}
            {data?.lastEvent?.created_at ? new Date(data.lastEvent.created_at).toLocaleString() : "—"}
          </span>
          <span className="text-muted-foreground">
            Last processed: {data?.lastEvent ? (data.lastEvent.processed ? "yes" : "no") : "—"}
          </span>
          {m?.last_error || data?.lastEvent?.error ? (
            <Badge variant="destructive" className="max-w-full truncate">
              {m?.last_error || data?.lastEvent?.error}
            </Badge>
          ) : (
            <Badge variant="outline">No errors</Badge>
          )}
          <Button asChild size="sm" variant="outline" className="ml-auto">
            <Link to="/owner/ai-admin/messenger">Manage connection</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" /> Admin AI Agent
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant={settings?.agent_enabled ? "default" : "secondary"}>
                {settings?.agent_enabled ? "Active" : "Disabled"}
              </Badge>
              <span className="text-muted-foreground">Private business control &amp; data</span>
            </div>
            <div>
              <div className="mb-1 font-medium">Authorized admin Messenger IDs</div>
              {psids.length === 0 ? (
                <p className="text-muted-foreground">None configured — the admin agent is unreachable.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {psids.map((p) => (
                    <Badge key={p} variant="outline" className="font-mono text-xs">
                      {p}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <p className="text-muted-foreground">
              Admin actions in the last 24 hours: <strong>{data?.adminActions24h ?? 0}</strong>
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="sm" variant="outline">
                <Link to="/owner/ai-admin/agent">Open agent</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/owner/ai-admin/logs">Command logs</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/owner/ai-admin/notifications">Notifications</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> Customer AI Agent
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant={customerOn ? "default" : "secondary"}>{customerOn ? "Active" : "Inactive"}</Badge>
                <span className="text-muted-foreground">Public information only</span>
              </div>
              <Switch checked={customerOn} onCheckedChange={setCustomer} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border p-2">
                <div className="text-lg font-semibold">{data?.kbCount ?? 0}</div>
                <div className="text-xs text-muted-foreground">Knowledge entries</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-lg font-semibold">{data?.openSupport ?? 0}</div>
                <div className="text-xs text-muted-foreground">Open handoffs</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-lg font-semibold">{data?.customerThreads ?? 0}</div>
                <div className="text-xs text-muted-foreground">Conversations</div>
              </div>
            </div>
            <div>
              <div className="mb-1 font-medium">Recent customer messages</div>
              {(data?.recentCustomerMessages ?? []).length === 0 ? (
                <p className="text-muted-foreground">No customer conversations yet.</p>
              ) : (
                <ul className="space-y-1">
                  {(data?.recentCustomerMessages ?? []).map((r: any, i: number) => (
                    <li key={i} className="truncate text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{r.role}:</span> {r.content}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="sm" variant="outline">
                <Link to="/owner/ai-admin/knowledge">Knowledge base</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/owner/ai-admin/support">Customer support</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <Bot className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Routing is decided on the server from the authorized Messenger ID list only. A customer claiming to be an
            admin can never reach admin tools or private data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
