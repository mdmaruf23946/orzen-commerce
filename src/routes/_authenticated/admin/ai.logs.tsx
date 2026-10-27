import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity } from "lucide-react";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { aiGetLogs } from "@/lib/merchant-ai.functions";

export const Route = createFileRoute("/_authenticated/admin/ai/logs")({
  head: () => ({
    meta: [
      { title: "AI Activity Log — ORZEN Merchant Panel" },
      { name: "description", content: "Every step your AI agents took, with timestamps." },
      { property: "og:title", content: "AI Activity Log — ORZEN Merchant Panel" },
      { property: "og:description", content: "Every step your AI agents took, with timestamps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeatureGate feature="ai_agent">
      <LogsPage />
    </FeatureGate>
  ),
});

const LEVEL_CLASS: Record<string, string> = {
  info: "bg-muted text-muted-foreground",
  warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  error: "bg-destructive/10 text-destructive",
};

function LogsPage() {
  const logsFn = useServerFn(aiGetLogs);
  const { data } = useQuery({ queryKey: ["ai-cc-logs"], queryFn: () => logsFn(),});
  const logs = data?.logs ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Activity className="h-6 w-6" /> Activity Log
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A complete, timestamped trail of every AI action. Secrets are never recorded here.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {logs.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No activity yet.</div>
        ) : (
          <ul className="divide-y">
            {logs.map((l: any) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="w-40 shrink-0 text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString()}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${LEVEL_CLASS[l.level] ?? LEVEL_CLASS.info}`}>
                  {l.level}
                </span>
                {l.agent_key && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                    {l.agent_key}
                  </span>
                )}
                <span className="min-w-0 flex-1 break-words">{l.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
