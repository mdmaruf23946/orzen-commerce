import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/owner/ComingSoon";

export const Route = createFileRoute("/_authenticated/owner/support")({
  component: () => <ComingSoon title="Support Center" description="Support tickets, contact requests, feedback, and announcements." />,
});
