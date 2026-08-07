import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TypeFilterTabs } from "@/components/admin/page/TypeFilterTabs";
import { FacebookTab } from "@/components/admin/marketing/FacebookTab";
import { GoogleTab } from "@/components/admin/marketing/GoogleTab";
import { TiktokTab } from "@/components/admin/marketing/TiktokTab";

export const Route = createFileRoute("/_authenticated/admin/marketing")({
  component: MarketingPage,
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
      <TypeFilterTabs tabs={TABS} value={tab} onChange={(k) => setTab(k)} />
      {tab === "facebook" && <FacebookTab />}
      {tab === "google" && <GoogleTab />}
      {tab === "tiktok" && <TiktokTab />}
    </div>
  );
}
