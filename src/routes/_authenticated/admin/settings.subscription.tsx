// Global subscription settings were removed: subscriptions are configured per
// product in the Subscription product form. Old links keep working.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/settings/subscription")({
  head: () => ({
    meta: [
      { title: "Subscription Settings — ORZEN Merchant Panel" },
      { name: "description", content: "Storefront subscription product settings." },
      { property: "og:title", content: "Subscription Settings — ORZEN Merchant Panel" },
      { property: "og:description", content: "Storefront subscription product settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/admin/settings/information" });
  },
});
