import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { MARKETING_HUB_PATH, MARKETING_PLATFORMS, useMarketingConnections, type MarketingPlatform } from "@/lib/marketing-platforms";
import { FacebookTab } from "./FacebookTab";
import { GoogleTab } from "./GoogleTab";
import { TiktokTab } from "./TiktokTab";
import { AUTO_EVENTS, StatusBadge } from "./ui";

const SETTINGS = { facebook: FacebookTab, google: GoogleTab, tiktok: TiktokTab } as const;

/** Sections that render the platform's own existing settings form. */
const SETTINGS_SECTIONS: Record<string, string[]> = {
  facebook: ["integration", "pixel", "capi", "settings"],
  google: ["integration", "ads", "conversions", "settings"],
  tiktok: ["integration", "pixel", "conversions", "settings"],
};

function NotAvailable({ what }: { what: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
      {what} is not available yet — no real data source is connected for this, so nothing is shown instead of fake numbers.
    </div>
  );
}

export function PlatformWorkspace({ id, tab }: { id: MarketingPlatform["id"]; tab?: string }) {
  const p = MARKETING_PLATFORMS.find((x) => x.id === id)!;
  const navigate = useNavigate();
  const { connected } = useMarketingConnections();
  const isOn = !!connected[id];
  const current = p.sections.find((s) => s.key === tab)?.key ?? (isOn ? "overview" : p.setupSection);
  const Settings = SETTINGS[id];
  const label = p.sections.find((s) => s.key === current)!.label;

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

      {current === "overview" && (
        <div className="space-y-3">
          <div className="rounded-xl border bg-card p-4 text-sm">
            {isOn ? `${p.name} is connected and tracking your store.` : `${p.name} is not connected yet. Open Integration to set it up.`}
          </div>
          <Settings />
        </div>
      )}
      {SETTINGS_SECTIONS[id].includes(current) && <Settings />}
      {current === "events" && (
        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Automatically tracked events</h2>
          <p className="mt-1 text-xs text-muted-foreground">{String(AUTO_EVENTS)}</p>
        </div>
      )}
      {(current === "audiences" || current === "attribution") && <NotAvailable what={label} />}
    </div>
  );
}
