import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { MARKETING_HUB_PATH, MARKETING_PLATFORMS, useMarketingConnections, type MarketingPlatform } from "@/lib/marketing-platforms";
import { FacebookTab } from "./FacebookTab";
import { GoogleTab } from "./GoogleTab";
import { TiktokTab } from "./TiktokTab";
import { AUTO_EVENTS, StatusBadge } from "./ui";
import { TrackingSetup } from "./TrackingSetup";
import { PlatformOverview } from "./PlatformOverview";

const SETTINGS = { facebook: FacebookTab, google: GoogleTab, tiktok: TiktokTab } as const;

export function PlatformWorkspace({ id, tab }: { id: MarketingPlatform["id"]; tab?: string }) {
  const p = MARKETING_PLATFORMS.find((x) => x.id === id);
  if (!p) return null;
  const navigate = useNavigate();
  const { connected } = useMarketingConnections();
  const isOn = !!connected[id];
  const current = p.sections.find((s) => s.key === tab)?.key ?? (isOn ? "overview" : p.setupSection);
  const Settings = SETTINGS[id];

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <Link to={MARKETING_HUB_PATH} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Marketing & Targeting Apps
      </Link>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{p.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
        </div>
        <StatusBadge kind={isOn ? "connected" : "not_configured"} />
      </div>
      <div className="-mx-3 overflow-x-auto px-3">
        <div className="flex w-max gap-1">
          {p.sections.map((s) => (
            <button key={s.key} type="button" onClick={() => navigate({ to: p.path, search: { tab: s.key } as any })}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium ${current === s.key ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>
              <s.icon className="h-3.5 w-3.5" /> {s.label}
            </button>
          ))}
        </div>
      </div>

      {current === "overview" && <PlatformOverview platformName={p.name} />}
      {current === "integration" && <div className="space-y-5">
        <Settings />
        <div className="rounded-md border bg-card p-4"><h2 className="text-sm font-semibold">Storefront event coverage</h2><p className="mt-1 text-xs text-muted-foreground">{String(AUTO_EVENTS)}</p></div>
        <TrackingSetup platform={id} />
      </div>}
    </div>
  );
}
