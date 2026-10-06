// Registry of Marketing & Targeting platforms. A platform gets its own sidebar
// menu ONLY while it is connected (ID saved + turned on); otherwise it shows
// only on the "Marketing & Targeting Apps" hub. Platform settings never mix.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity, BarChart3, LayoutDashboard, Megaphone, Plug, Radar, Server, Settings, Target, Users, type LucideIcon,
} from "lucide-react";
import { getMyStore } from "@/lib/admin.functions";

export type MarketingSection = { key: string; label: string; icon: LucideIcon };
export type MarketingPlatform = {
  id: "facebook" | "google" | "tiktok";
  name: string;
  path: string;
  description: string;
  setupSection: string;
  sections: MarketingSection[];
};

export const MARKETING_HUB_PATH = "/admin/marketing/apps";

export const MARKETING_PLATFORMS: MarketingPlatform[] = [
  {
    id: "facebook", name: "Facebook Marketing", path: "/admin/marketing/facebook", setupSection: "integration",
    description: "Meta Pixel, Conversions API & test events for your store.",
    sections: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
      { key: "integration", label: "Integration", icon: Plug },
      { key: "pixel", label: "Tracking & Pixel", icon: Radar },
      { key: "capi", label: "Conversions API", icon: Server },
      { key: "events", label: "Events", icon: Activity },
      { key: "audiences", label: "Audiences", icon: Users },
      { key: "attribution", label: "Attribution", icon: BarChart3 },
      { key: "settings", label: "Settings", icon: Settings },
    ],
  },
  {
    id: "google", name: "Google Marketing", path: "/admin/marketing/google", setupSection: "integration",
    description: "Google Analytics 4, Google Ads conversions & Tag Manager.",
    sections: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
      { key: "integration", label: "Integration", icon: Plug },
      { key: "ads", label: "Google Ads", icon: Megaphone },
      { key: "conversions", label: "Conversion Tracking", icon: Target },
      { key: "audiences", label: "Audiences", icon: Users },
      { key: "settings", label: "Settings", icon: Settings },
    ],
  },
  {
    id: "tiktok", name: "TikTok Marketing", path: "/admin/marketing/tiktok", setupSection: "integration",
    description: "TikTok Pixel, Events API & advanced matching.",
    sections: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
      { key: "integration", label: "Integration", icon: Plug },
      { key: "pixel", label: "Pixel", icon: Radar },
      { key: "events", label: "Events", icon: Activity },
      { key: "conversions", label: "Conversion Tracking", icon: Target },
      { key: "settings", label: "Settings", icon: Settings },
    ],
  },
];

export type MarketingConnectionMap = Record<string, boolean>;

export function marketingConnections(marketing: any): MarketingConnectionMap {
  const m = marketing ?? {};
  const g = m.google ?? {};
  const t = m.tiktok ?? {};
  return {
    facebook: !!m.fb_pixel_id && m.fb_pixel_enabled !== false,
    google: !!(g.ga4_enabled && (g.ga4_id || m.ga4_id)) || !!(g.ads_enabled && g.ads_conversion_id) || !!(g.gtm_enabled && g.gtm_id),
    tiktok: !!(t.pixel_enabled && (t.pixel_id || m.tiktok_pixel_id)),
  };
}

/** Same query key as the settings forms, so saving refreshes the sidebar instantly. */
export function useMarketingConnections(enabled = true) {
  const fn = useServerFn(getMyStore);
  const q = useQuery({ queryKey: ["admin", "store"], queryFn: () => fn(), enabled, staleTime: 30_000 });
  return { connected: marketingConnections((q.data as any)?.marketing), isLoading: q.isLoading };
}
