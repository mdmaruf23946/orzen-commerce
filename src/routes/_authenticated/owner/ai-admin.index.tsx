import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, Bot, CheckCircle2, Clock, MessageCircle, XCircle } from "lucide-react";
import { aiAdminOverview } from "@/lib/ai-admin.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/owner/ai-admin/")({ component: Page });

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number | string; tone?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg p-2 ${tone ?? "bg-muted"}`}><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-2xl font-semibold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Page() {
  const fn = useServerFn(aiAdminOverview);
  const { data } = useQuery({ queryKey: ["ai-admin", "overview"], queryFn: () => fn() });
  const conn = data?.connection;
  const connected = conn?.status === "connected";

  return (
    <div>
      <OwnerPageHeader
        title="AI Admin Control"
        description="Run platform admin work from WhatsApp with a permission-gated AI assistant."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="sm:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Connection</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Badge variant={connected ? "default" : "secondary"} className="gap-1">
              {connected ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {connected ? "Connected" : conn?.status === "error" ? "Error" : "Not connected"}
            </Badge>
            {conn?.display_number ? (
              <span className="text-sm text-muted-foreground">{conn.display_number}</span>
            ) : null}
            <Badge variant={data?.settings?.agent_enabled ? "default" : "secondary"}>
              Agent {data?.settings?.agent_enabled ? "on" : "off"}
            </Badge>
            {data?.settings?.test_mode ? <Badge variant="outline">Test mode</Badge> : null}
            <Button asChild size="sm" variant="outline" className="ml-auto">
              <Link to="/owner/ai-admin/whatsapp">Manage connection</Link>
            </Button>
          </CardContent>
        </Card>
        <Stat icon={MessageCircle} label="Commands (24h)" value={data?.commands24h ?? 0} />
        <Stat icon={Activity} label="Actions executed (24h)" value={data?.actions24h ?? 0} />
        <Stat icon={Clock} label="Awaiting confirmation" value={data?.pending ?? 0} />
        <Stat icon={AlertTriangle} label="Failed actions (24h)" value={data?.failed24h ?? 0} />
        <Card className="sm:col-span-2">
          <CardContent className="flex items-center gap-3 p-4">
            <Bot className="h-5 w-5 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              Send a natural-language command from the AI Agent page or from your WhatsApp admin number.
            </div>
            <Button asChild size="sm" className="ml-auto"><Link to="/owner/ai-admin/agent">Open agent</Link></Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Recent actions</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(data?.recent ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No actions yet.</p>
          ) : (
            (data?.recent ?? []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.target_label || r.action_key}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()} · {r.channel}
                  </div>
                </div>
                <Badge variant={r.result === "success" ? "default" : r.result === "failed" ? "destructive" : "secondary"}>
                  {r.result}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
