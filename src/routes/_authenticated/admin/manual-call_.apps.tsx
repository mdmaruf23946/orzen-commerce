import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PhoneCall, CheckCircle2, Plug } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listManualLines } from "@/lib/manual-call.functions";

export const Route = createFileRoute("/_authenticated/admin/manual-call_/apps")({
  component: CallAppsPage,
  head: () => ({
    meta: [
      { title: "Call Apps — ORZEN Merchant Panel" },
      { name: "description", content: "Connect one or more call providers; all calls appear in one Calls Hub." },
      { property: "og:title", content: "Call Apps — ORZEN Merchant Panel" },
      { property: "og:description", content: "Connect one or more call providers; all calls appear in one Calls Hub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function CallAppsPage() {
  const fn = useServerFn(listManualLines);
  const q = useQuery({ queryKey: ["manual-lines"], queryFn: () => fn() });
  const gateways: any[] = (q.data as any)?.gateways ?? [];
  const lines: any[] = (q.data as any)?.lines ?? [];
  return (
    <div className="space-y-4">
      <AdminPageHeader title="Call Apps" description="Connect your call providers here. Every connected provider works together in the single Calls Hub." />
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !gateways.length ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No call provider is available yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gateways.map((g) => {
            const count = lines.filter((l) => l.gateway_id === g.id).length;
            return (
              <div key={g.id} className="flex flex-col rounded-xl border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <PhoneCall className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{g.name}</div>
                    <div className="text-xs text-muted-foreground">Manual calling</div>
                  </div>
                  {count > 0 && (
                    <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />{count} line{count > 1 ? "s" : ""}</Badge>
                  )}
                </div>
                {g.help_text && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{g.help_text}</p>}
                <div className="mt-4 flex gap-2 pt-1">
                  <Button asChild size="sm" variant={count ? "outline" : "default"}>
                    <Link to="/admin/manual-call" search={{ tab: "setup" }}><Plug className="mr-1 h-4 w-4" />{count ? "Manage" : "Connect"}</Link>
                  </Button>
                  {count > 0 && (
                    <Button asChild size="sm">
                      <Link to="/admin/manual-call" search={{ tab: "dialer" }}>Open Calls Hub</Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
