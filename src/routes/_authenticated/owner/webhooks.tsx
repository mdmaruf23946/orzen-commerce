import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/owner/ComingSoon";

export const Route = createFileRoute("/_authenticated/owner/webhooks")({
  component: () => <ComingSoon title="Webhooks" description="Register outbound webhooks and inspect delivery history." />,
});
