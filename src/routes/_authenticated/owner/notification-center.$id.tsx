import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCampaign } from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner/notification-center/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const getOne = useServerFn(getCampaign);
  const { data } = useQuery({ queryKey: ["notif-campaign", id], queryFn: () => getOne({ data: { id } }) });
  const c = data?.campaign as any;
  const recips = (data?.recipients ?? []) as any[];

  if (!c) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  const t = c.totals ?? {};
  return (
    <div className="space-y-4">
      <Link to="/owner/notification-center"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Back</Button></Link>
      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-lg font-semibold">{c.title}</h2>
        <div className="mt-1 text-xs text-muted-foreground">{c.type} · {c.priority} · {c.status}</div>
        <div className="prose prose-sm mt-3 max-w-none" dangerouslySetInnerHTML={{ __html: sanitize(c.body_html) }} />
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          ["Recipients", t.recipients ?? recips.length],
          ["Email sent", t.email_sent ?? "—"],
          ["Email failed", t.email_failed ?? "—"],
          ["In-app created", t.inapp_created ?? "—"],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-xl border bg-card p-3">
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className="text-xl font-semibold">{v as any}</div>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">User</th><th className="p-3">Email</th><th className="p-3">Email status</th><th className="p-3">In-app</th><th className="p-3">Read</th></tr>
          </thead>
          <tbody>
            {recips.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-mono text-xs">{r.user_id.slice(0, 8)}</td>
                <td className="p-3">{r.email ?? "—"}</td>
                <td className="p-3"><StatusPill v={r.email_status} /></td>
                <td className="p-3"><StatusPill v={r.inapp_status} /></td>
                <td className="p-3 text-xs">{r.read_at ? new Date(r.read_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ v }: { v: string }) {
  const map: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    sent: "bg-emerald-100 text-emerald-700",
    created: "bg-emerald-100 text-emerald-700",
    read: "bg-blue-100 text-blue-700",
    failed: "bg-red-100 text-red-700",
    suppressed: "bg-amber-100 text-amber-700",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] ${map[v] ?? "bg-muted"}`}>{v}</span>;
}

function sanitize(html: string): string {
  // Basic script strip; DOMPurify runs in browser package if available elsewhere.
  return (html ?? "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/on\w+="[^"]*"/gi, "");
}
