import { createFileRoute, Link } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserCog, MessageSquare, Bot } from "lucide-react";
import { listHandoffQueue, returnConversationToAi } from "@/lib/ai-review.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/handoff-queue")({
  head: () => ({
    meta: [
      { title: "Handoff Queue — ORZEN Merchant Panel" },
      { name: "description", content: "Conversations waiting for a human agent." },
      { property: "og:title", content: "Handoff Queue — ORZEN Merchant Panel" },
      { property: "og:description", content: "Conversations waiting for a human agent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeatureGate feature="ai_agent">
      <HandoffQueuePage />
    </FeatureGate>
  ),
});

function HandoffQueuePage() {
  const listFn = useServerFn(listHandoffQueue);
  const returnFn = useServerFn(returnConversationToAi);
  const qc = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["handoff-queue"],
    queryFn: () => listFn(),
    refetchInterval: 15_000,
  });

  async function returnToAi(id: string) {
    try {
      await returnFn({ data: { conversation_id: id } });
      qc.invalidateQueries({ queryKey: ["handoff-queue"] });
      toast.success("Returned to AI");
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <UserCog className="h-6 w-6" /> Handoff Queue
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conversations where the AI needed human help. Review the reason, reply, and hand the conversation back to the AI when done.
        </p>
      </div>

      {(rows as any[]).length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          No conversations waiting for you 🎉
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {(rows as any[]).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="line-clamp-1 text-sm font-semibold">{c.customer_name ?? "Customer"}</p>
                  <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-600 dark:text-amber-400">
                    {c.channel ?? "chat"}
                  </span>
                </div>
                {c.handoff_reason && (
                  <p className="mt-1 text-sm text-foreground/80">
                    <span className="font-medium">Reason:</span> {String(c.handoff_reason).startsWith("auto_spam") ? "AI paused automatically (repeated/spam messages)" : c.handoff_reason}
                  </p>
                )}
                {c.last_message_preview && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">"{c.last_message_preview}"</p>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Escalated {c.handoff_at ? new Date(c.handoff_at).toLocaleString() : "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/admin/omni-inbox"
                  search={{ conversation: c.id } as any}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <MessageSquare className="h-3 w-3" /> Open
                </Link>
                <Button size="sm" variant="outline" onClick={() => returnToAi(c.id)}>
                  <Bot className="mr-1 h-3 w-3" /> Return to AI
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
