import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { aiDecideAction, aiGetOverview } from "@/lib/merchant-ai.functions";

export const Route = createFileRoute("/_authenticated/admin/ai/approvals")({
  head: () => ({
    meta: [
      { title: "AI Approvals — ORZEN Merchant Panel" },
      { name: "description", content: "Approve or reject the actions your AI prepared." },
      { property: "og:title", content: "AI Approvals — ORZEN Merchant Panel" },
      { property: "og:description", content: "Approve or reject the actions your AI prepared." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeatureGate feature="ai_agent">
      <ApprovalsPage />
    </FeatureGate>
  ),
});

function ApprovalsPage() {
  const overviewFn = useServerFn(aiGetOverview);
  const decideFn = useServerFn(aiDecideAction);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["ai-cc-overview"],
    queryFn: () => overviewFn(),
  });

  async function decide(id: string, decision: "approve" | "reject") {
    setBusy(id);
    try {
      await decideFn({ data: { id, decision } });
      toast.success(decision === "approve" ? "Approved and executed" : "Rejected");
      await qc.invalidateQueries({ queryKey: ["ai-cc-overview"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const pending = data?.pending ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShieldCheck className="h-6 w-6" /> Approvals
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sensitive actions wait here. Nothing runs until you approve it.
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          Nothing is waiting for you right now.
        </div>
      ) : (
        <ul className="space-y-3">
          {pending.map((p: any) => (
            <li key={p.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{p.title}</div>
                  <div className="mt-1 break-words text-xs text-muted-foreground">{p.summary}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {p.agent_key} · requested {new Date(p.created_at).toLocaleString()}
                    {p.expires_at ? ` · expires ${new Date(p.expires_at).toLocaleString()}` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy === p.id} onClick={() => decide(p.id, "approve")}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === p.id}
                    onClick={() => decide(p.id, "reject")}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
