import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/owner/ComingSoon";

export const Route = createFileRoute("/_authenticated/owner/features")({
  component: () => <ComingSoon title="Feature Flags" description="Enable or disable platform features globally across all stores." />,
});
