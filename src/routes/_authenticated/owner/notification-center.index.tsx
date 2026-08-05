import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Send, Ban, Eye } from "lucide-react";
import { listCampaigns, deleteCampaign, cancelCampaign, sendCampaign } from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/owner/notification-center/")({ component: Page });

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-100 text-blue-700",
  sending: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-zinc-200 text-zinc-700",
};

function Page() {
  const list = useServerFn(listCampaigns);
  const del = useServerFn(deleteCampaign);
  const cancel = useServerFn(cancelCampaign);
  const send = useServerFn(sendCampaign);
  const qc = useQueryClient();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const { data = [] } = useQuery({
    queryKey: ["notif-campaigns", q, status],
    queryFn: () => list({ data: { q: q || undefined, status: status || undefined } }),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title..." className="max-w-xs" />
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">All status</option>
          {["draft", "scheduled", "sending", "completed", "failed", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="ml-auto">
          <Link to="/owner/notification-center/compose" search={{}}><Button size="sm"><Plus className="mr-1 h-4 w-4" />New campaign</Button></Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Title</th>
              <th className="p-3">Type</th>
              <th className="p-3">Channels</th>
              <th className="p-3">Status</th>
              <th className="p-3">Recipients</th>
              <th className="p-3">Sent</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data as any[]).length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No campaigns yet.</td></tr>
            )}
            {(data as any[]).map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-medium">{c.title}</td>
                <td className="p-3 text-muted-foreground">{c.type}</td>
                <td className="p-3 text-xs">{(c.channels ?? []).join(", ")}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusColors[c.status] ?? ""}`}>{c.status}</span>
                </td>
                <td className="p-3 text-xs">{c.totals?.recipients ?? "—"}</td>
                <td className="p-3 text-xs text-muted-foreground">{c.sent_at ? new Date(c.sent_at).toLocaleString() : "—"}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Link to="/owner/notification-center/$id" params={{ id: c.id }}>
                      <Button size="icon" variant="ghost"><Eye className="h-4 w-4" /></Button>
                    </Link>
                    {c.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={async () => {
                        if (!confirm("Send this campaign now?")) return;
                        try { const r = await send({ data: { id: c.id } }); toast.success(`Sent to ${r.recipients} recipients`); qc.invalidateQueries({ queryKey: ["notif-campaigns"] }); }
                        catch (e) { toast.error((e as Error).message); }
                      }}><Send className="mr-1 h-3 w-3" />Send</Button>
                    )}
                    {c.status === "scheduled" && (
                      <Button size="icon" variant="ghost" onClick={async () => {
                        await cancel({ data: { id: c.id } }); qc.invalidateQueries({ queryKey: ["notif-campaigns"] });
                      }}><Ban className="h-4 w-4" /></Button>
                    )}
                    {["draft", "cancelled", "failed"].includes(c.status) && (
                      <Button size="icon" variant="ghost" onClick={async () => {
                        if (!confirm("Delete?")) return;
                        await del({ data: { id: c.id } }); qc.invalidateQueries({ queryKey: ["notif-campaigns"] });
                      }}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
