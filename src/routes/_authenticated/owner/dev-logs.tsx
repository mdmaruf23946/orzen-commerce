import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDevLogs } from "@/lib/owner-ext.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";

export const Route = createFileRoute("/_authenticated/owner/dev-logs")({ component: Page });

function Page() {
  const list = useServerFn(listDevLogs);
  const { data = [] } = useQuery({ queryKey: ["owner", "devLogs"], queryFn: () => list() });
  return (
    <div>
      <OwnerPageHeader title="System Logs" description="Recent audit events and subscription notifications." />
      <div className="rounded-xl border bg-card p-2">
        {(data as any[]).length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No events yet.</div>}
        <ul className="divide-y">
          {(data as any[]).map((it, i) => (
            <li key={i} className="flex items-start gap-3 px-3 py-2">
              <span className={"mt-0.5 rounded-full px-2 py-0.5 text-[10px] " + (it.kind === "audit" ? "bg-primary/10 text-primary" : "bg-muted")}>{it.kind}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{it.text}</div>
                <div className="text-xs text-muted-foreground">{new Date(it.at).toLocaleString()}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
