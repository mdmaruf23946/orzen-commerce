import { createFileRoute } from "@tanstack/react-router";
import { ThemeCustomizer } from "@/components/admin/theme/ThemeCustomizer";

export const Route = createFileRoute("/_authenticated/admin/theme")({
  component: ThemeCustomizer,
  head: () => ({
    meta: [
      { title: "Theme Customization — ORZEN Merchant Panel" },
      {
        name: "description",
        content: "Choose a platform theme and safely customize your storefront colors, fonts and sections.",
      },
      { property: "og:title", content: "Theme Customization — ORZEN Merchant Panel" },
      { property: "og:description", content: "Choose a platform theme and safely customize your storefront." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
