import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/owner/ComingSoon";

export const Route = createFileRoute("/_authenticated/owner/notifications")({
  component: () => <ComingSoon title="Notification Center" description="Broadcast messages, email campaigns, and maintenance notices." />,
});
