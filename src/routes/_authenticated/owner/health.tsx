import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/owner/ComingSoon";

export const Route = createFileRoute("/_authenticated/owner/health")({
  component: () => <ComingSoon title="Store Health" description="Monitor uptime, quota usage, and errors across all stores." />,
});
