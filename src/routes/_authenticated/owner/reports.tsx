import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/owner/ComingSoon";

export const Route = createFileRoute("/_authenticated/owner/reports")({
  component: () => <ComingSoon title="Reports & Analytics" description="Revenue, subscription, growth, orders, and AI usage reports." />,
});
