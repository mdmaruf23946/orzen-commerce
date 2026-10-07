import { createFileRoute, Link } from "@tanstack/react-router";
import { COURIERS } from "@/components/admin/couriers/providers";
import { BrandBadge } from "@/components/admin/couriers/BrandBadge";
import { StatusBadge } from "@/components/admin/marketing/ui";
import { Button } from "@/components/ui/button";
import { imgSrc, useCourierBrandAssets, useCourierConnections } from "@/lib/courier-apps";

export const Route = createFileRoute("/_authenticated/admin/couriers/apps")({
  head: () => ({
    meta: [
      { title: "Courier Apps — ORZEN Merchant Panel" },
      { name: "description", content: "Connect courier providers for parcel delivery." },
      { property: "og:title", content: "Courier Apps — ORZEN Merchant Panel" },
      { property: "og:description", content: "Connect courier providers for parcel delivery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HubPage,
});

function HubPage() {
  const { connected } = useCourierConnections();
  const { logo, wordmark } = useCourierBrandAssets();
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <div>
        <h1 className="text-2xl font-semibold">Courier Apps</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect a courier to get its own menu in the sidebar. Each courier is saved separately.
        </p>
      </div>
      <div className="grid gap-3">
        {COURIERS.map((m) => {
          const on = !!connected[m.key];
          const wm = imgSrc(wordmark[m.key]);
          return (
            <div key={m.key} className="flex items-center gap-3 rounded-xl border bg-card p-4">
              <BrandBadge meta={m} logoUrl={logo[m.key] ?? null} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {wm ? (
                    <img src={wm} alt={m.label} loading="lazy" decoding="async" className="h-5 max-w-[140px] object-contain dark:brightness-0 dark:invert" />
                  ) : (
                    <span className="font-medium">{m.label}</span>
                  )}
                  <StatusBadge kind={on ? "connected" : "not_configured"} label={on ? "Connected" : "Not connected"} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{m.label} · {m.tagline}</p>
              </div>
              <Button asChild size="sm" variant={on ? "outline" : "default"}>
                <Link to="/admin/couriers/$provider" params={{ provider: m.key }} search={{ section: on ? "overview" : "integration" }}>
                  {on ? "Manage" : "Connect"}
                </Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
