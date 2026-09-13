import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listAiAdminPermissions, setAiAdminPermission } from "@/lib/ai-admin.functions";
import { ACTIONS, ACTION_GROUPS } from "@/lib/ai-admin/catalog";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/owner/ai-admin/permissions")({ component: Page });

function Page() {
  const list = useServerFn(listAiAdminPermissions);
  const set = useServerFn(setAiAdminPermission);
  const qc = useQueryClient();
  const { data = {} } = useQuery({ queryKey: ["ai-admin", "permissions"], queryFn: () => list() });

  async function toggle(key: string, enabled: boolean) {
    try {
      await set({ data: { action_key: key, enabled } });
      qc.invalidateQueries({ queryKey: ["ai-admin", "permissions"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <OwnerPageHeader
        title="Commands & Permissions"
        description="Every action the AI assistant can perform. Disabled actions are refused, even if asked directly."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {ACTION_GROUPS.map((g) => (
          <Card key={g.key}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{g.label}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {ACTIONS.filter((a) => a.group === g.key).map((a) => (
                <div key={a.key} className="flex items-center justify-between gap-3 rounded-md border p-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{a.label}</div>
                    <div className="text-xs text-muted-foreground">{a.key}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.risk === "high" ? "destructive" : a.risk === "medium" ? "secondary" : "outline"}>
                      {a.risk}
                    </Badge>
                    <Switch
                      checked={(data as Record<string, boolean>)[a.key] ?? a.defaultEnabled}
                      onCheckedChange={(v) => toggle(a.key, v)}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
