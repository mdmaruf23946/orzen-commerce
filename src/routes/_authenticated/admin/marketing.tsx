import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useState } from "react";
import { TypeFilterTabs } from "@/components/admin/page/TypeFilterTabs";
import { FacebookTab } from "@/components/admin/marketing/FacebookTab";
import { GoogleTab } from "@/components/admin/marketing/GoogleTab";
import { TiktokTab } from "@/components/admin/marketing/TiktokTab";
import { TrackingSetup } from "@/components/admin/marketing/TrackingSetup";

export const Route = createFileRoute("/_authenticated/admin/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing & Tracking — ORZEN Merchant Panel" },
      { name: "description", content: "Facebook, Google and TikTok tracking for your store." },
      { property: "og:title", content: "Marketing & Tracking — ORZEN Merchant Panel" },
      { property: "og:description", content: "Facebook, Google and TikTok tracking for your store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeatureGate feature="pixel">
      <MarketingPage />
    </FeatureGate>
  ),
});

const TABS = [
  { key: "facebook", label: "Facebook" },
  { key: "google", label: "Google" },
  { key: "tiktok", label: "TikTok" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function MarketingPage() {
  const [tab, setTab] = useState<TabKey>("facebook");
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <div>
        <h1 className="text-2xl font-semibold">Marketing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tracking &amp; analytics for your storefront. Each platform is saved separately.
        </p>
      </div>
      <TrackingSetup />
      <div>
        <h2 className="text-sm font-semibold">Advanced platform settings</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Main Store only — server-side events and testing tools.</p>
      </div>
      <TypeFilterTabs tabs={TABS} value={tab} onChange={(k) => setTab(k)} />
      {tab === "facebook" && <FacebookTab />}
      {tab === "google" && <GoogleTab />}
      {tab === "tiktok" && <TiktokTab />}
    </div>
  );
}
