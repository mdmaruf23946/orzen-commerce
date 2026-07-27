import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listCommunicationHistory } from "@/lib/communication.functions";

export const Route = createFileRoute("/_authenticated/owner/communication/history")({
  component: HistoryList,
});

function HistoryList() {
  const listFn = useServerFn(listCommunicationHistory);
  const { data = [], isLoading } = useQuery({
    queryKey: ["comm-history-full"], queryFn: () => listFn({ data: { limit: 200 } }),
  });

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b p-4 font-semibold">Communication History</div>
      {isLoading ? (
        <div className="p-6 text-sm text-muted-foreground">Loading…</div>
      ) : data.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">No campaigns yet.</div>
      ) : (
        <div className="divide-y">
          {(data as any[]).map((c) => {
            const t = c.totals ?? {};
            return (
              <Link
                key={c.id}
                to="/owner/communication/history/$id"
                params={{ id: c.id }}
                className="flex flex-col gap-2 p-4 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.subject || c.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleString()} · {(c.channels ?? []).join(", ") || "—"}
                    {c.sender_email ? ` · from ${c.sender_email}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-muted px-2 py-0.5">{c.status}</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                    {t.email_sent ?? 0} sent
                  </span>
                  {(t.email_failed ?? 0) > 0 && (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">
                      {t.email_failed} failed
                    </span>
                  )}
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                    {t.inapp_created ?? 0} in-app
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
