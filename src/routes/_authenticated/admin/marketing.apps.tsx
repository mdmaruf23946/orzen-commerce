import { createFileRoute, Link } from "@tanstack/react-router";
import { Facebook, Chrome, Music2 } from "lucide-react";
import { MARKETING_PLATFORMS, useMarketingConnections } from "@/lib/marketing-platforms";
import { TrackingSetup } from "@/components/admin/marketing/TrackingSetup";
import { StatusBadge } from "@/components/admin/marketing/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/marketing/apps")({
  head: () => ({
    meta: [
      { title: "Marketing & Targeting Apps — ORZEN Merchant Panel" },
      { name: "description", content: "Connect Facebook, Google & TikTok tracking for your store." },
      { property: "og:title", content: "Marketing & Targeting Apps — ORZEN Merchant Panel" },
      { property: "og:description", content: "Connect Facebook, Google & TikTok tracking for your store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HubPage,
});

const ICONS = { facebook: Facebook, google: Chrome, tiktok: Music2 } as const;

function HubPage() {
  const { connected } = useMarketingConnections();
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <div>
        <h1 className="text-2xl font-semibold">Marketing & Targeting Apps</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect a platform to get its own menu in the sidebar. Each platform is saved separately.
        </p>
      </div>
      <div className="grid gap-3">
        {MARKETING_PLATFORMS.map((p) => {
          const Icon = ICONS[p.id];
          const on = !!connected[p.id];
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  <StatusBadge kind={on ? "connected" : "not_configured"} label={on ? "Connected" : "Not connected"} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
              </div>
              <Button asChild size="sm" variant={on ? "outline" : "default"}>
                <Link to={p.path} search={{ tab: on ? "overview" : p.setupSection } as any}>{on ? "Manage" : "Connect / Setup"}</Link>
              </Button>
            </div>
          );
        })}
      </div>
      <TrackingSetup />
    </div>
  );
}
