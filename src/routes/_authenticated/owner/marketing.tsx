import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/owner/ComingSoon";

export const Route = createFileRoute("/_authenticated/owner/marketing")({
  component: () => <ComingSoon title="Marketing Integrations" description="Platform-wide Facebook Pixel, GA4, GTM, TikTok, and CAPI defaults." />,
});
