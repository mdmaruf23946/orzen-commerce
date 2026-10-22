import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCheck, Bell, ExternalLink } from "lucide-react";
import { listMyNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/notifications-inbox.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DOMPurify from "isomorphic-dompurify";

export const Route = createFileRoute("/_authenticated/admin/inbox")({
  component: Inbox,
  head: () => ({
    meta: [
      { title: "Notifications Inbox — ORZEN Merchant Panel" },
      { name: "description", content: "Your store notifications and alerts." },
      { property: "og:title", content: "Notifications Inbox — ORZEN Merchant Panel" },
      { property: "og:description", content: "Your store notifications and alerts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const priorityColor: Record<string, string> = {
  urgent: "border-l-red-500",
  important: "border-l-amber-500",
  normal: "border-l-blue-500",
};

function Inbox() {
  const nav = useNavigate();
  const list = useServerFn(listMyNotifications);
  const markRead = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const { data = [] } = useQuery({
    queryKey: ["inbox", tab],
    queryFn: () => list({ data: { status: tab } }),
  });

  useEffect(() => { qc.invalidateQueries({ queryKey: ["admin-badge-counts"] }); }, [qc, data]);

  async function handleAction(n: any) {
    if (!n.read_at) {
      await markRead({ data: { id: n.id } });
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["admin-badge-counts"] });
    }
    if (n.action_type === "internal" && n.action_target) {
      nav({ to: n.action_target });
    } else if (n.action_type === "external" && n.action_target) {
      window.open(n.action_target, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <Bell className="h-5 w-5" />
        <h1 className="text-xl font-semibold">Inbox</h1>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant={tab === "unread" ? "default" : "ghost"} onClick={() => setTab("unread")}>Unread</Button>
          <Button size="sm" variant={tab === "all" ? "default" : "ghost"} onClick={() => setTab("all")}>All</Button>
          <Button size="sm" variant="outline" onClick={async () => {
            await markAll(); qc.invalidateQueries({ queryKey: ["inbox"] }); qc.invalidateQueries({ queryKey: ["admin-badge-counts"] });
          }}><CheckCheck className="mr-1 h-4 w-4" />Mark all read</Button>
        </div>
      </div>

      <div className="space-y-2">
        {(data as any[]).length === 0 && (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            {tab === "unread" ? "No unread notifications." : "No notifications yet."}
          </div>
        )}
        {(data as any[]).map((n) => (
          <div key={n.id}
            className={cn("rounded-xl border border-l-4 bg-card p-4", priorityColor[n.priority] ?? "border-l-muted", !n.read_at && "bg-muted/30")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="truncate font-semibold">{n.title}</div>
                  {!n.read_at && <span className="h-2 w-2 rounded-full bg-primary" />}
                  {n.type && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{n.type.replace(/_/g, " ")}</span>}
                </div>
                {(n.meta?.html || n.body) ? (
                  <div className="prose prose-sm mt-1 max-w-none text-sm text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: sanitize(n.meta?.html ?? escapeText(n.body ?? "")) }} />
                ) : null}
                <div className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
              </div>
              <div className="flex flex-col gap-1">
                {n.action_label && n.action_type !== "none" && (
                  <Button size="sm" onClick={() => handleAction(n)}>
                    {n.action_type === "external" && <ExternalLink className="mr-1 h-3 w-3" />}
                    {n.action_label}
                  </Button>
                )}
                {!n.read_at && (
                  <Button size="sm" variant="ghost" onClick={async () => {
                    await markRead({ data: { id: n.id } });
                    qc.invalidateQueries({ queryKey: ["inbox"] });
                    qc.invalidateQueries({ queryKey: ["admin-badge-counts"] });
                  }}>Mark read</Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function escapeText(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function sanitize(html: string): string {
  return DOMPurify.sanitize(String(html ?? ""), {
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button"],
    FORBID_ATTR: ["style"],
  });
}
