import { createFileRoute } from "@tanstack/react-router";
import { PlatformWorkspace } from "@/components/admin/marketing/PlatformWorkspace";

export const Route = createFileRoute("/_authenticated/admin/marketing/facebook")({
  validateSearch: (s: Record<string, unknown>) => ({ tab: typeof s.tab === "string" ? s.tab : undefined }),
  head: () => ({
    meta: [
      { title: "Facebook Marketing — ORZEN Merchant Panel" },
      { name: "description", content: "Facebook tracking & marketing settings for your store." },
      { property: "og:title", content: "Facebook Marketing — ORZEN Merchant Panel" },
      { property: "og:description", content: "Facebook tracking & marketing settings for your store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const { tab } = Route.useSearch();
  return <PlatformWorkspace id="facebook" tab={tab} />;
}
