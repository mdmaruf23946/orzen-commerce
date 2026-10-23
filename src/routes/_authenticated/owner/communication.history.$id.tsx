import DOMPurify from "isomorphic-dompurify";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { getCommunicationDetail, retryFailedEmail } from "@/lib/communication.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/owner/communication/history/$id")({
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const get = useServerFn(getCommunicationDetail);
  const retry = useServerFn(retryFailedEmail);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["comm-detail", id], queryFn: () => get({ data: { id } }),
  });

  async function doRetry(rid: string) {
    try {
      await retry({ data: { recipient_id: rid } });
      toast.success("Retried");
      qc.invalidateQueries({ queryKey: ["comm-detail", id] });
    } catch (e: any) { toast.error(e?.message ?? "Retry failed"); }
  }

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  if (!data) return null;
  const c: any = data.campaign;
  const totals = c.totals ?? {};

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="text-lg font-semibold">{c.subject || c.title}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {new Date(c.created_at).toLocaleString()} · Sender: {c.sender_email ?? "—"} · Status: {c.status}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-muted px-2 py-0.5">Recipients: {totals.recipients ?? 0}</span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">Sent: {totals.email_sent ?? 0}</span>
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">Failed: {totals.email_failed ?? 0}</span>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">In-app: {totals.inapp_created ?? 0}</span>
        </div>
        {c.body_html && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">Preview email body</summary>
            <div className="mt-2 rounded-md border bg-background p-3" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(c.body_html), { FORBID_TAGS: ["script","style","iframe","object","embed","form","input","button"], FORBID_ATTR: ["style"] }) }} />
          </details>
        )}
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b p-3 font-semibold">Recipients ({data.recipients.length})</div>
        <div className="divide-y">
          {data.recipients.map((r: any) => (
            <div key={r.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="truncate font-medium">{r.email ?? "(no email)"}</div>
                <div className="text-xs text-muted-foreground">
                  Email: {r.email_status ?? "—"}
                  {r.email_sent_at ? ` · ${new Date(r.email_sent_at).toLocaleString()}` : ""}
                  · In-app: {r.inapp_status ?? "—"}
                  {r.read_at ? ` (read ${new Date(r.read_at).toLocaleTimeString()})` : ""}
                </div>
                {r.email_last_error && (
                  <div className="mt-1 truncate text-xs text-rose-600">{r.email_last_error}</div>
                )}
              </div>
              {r.email_status === "failed" && r.email && (
                <Button size="sm" variant="outline" onClick={() => doRetry(r.id)}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
