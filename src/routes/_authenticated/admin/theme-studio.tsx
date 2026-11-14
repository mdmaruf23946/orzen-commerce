import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { ThemeStudio } from "@/components/admin/theme/ThemeStudio";

export const Route = createFileRoute("/_authenticated/admin/theme-studio")({
  component: () => (
    <FeatureGate feature="themes">
      <ThemeStudio />
    </FeatureGate>
  ),
  head: () => ({
    meta: [
      { title: "Theme Studio — ORZEN Merchant Panel" },
      { name: "description", content: "Pick header-to-footer designs for your storefront with a live preview, then publish." },
      { property: "og:title", content: "Theme Studio — ORZEN Merchant Panel" },
      { property: "og:description", content: "Visual header-to-footer storefront designer with live preview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
