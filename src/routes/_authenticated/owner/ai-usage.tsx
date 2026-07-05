import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/owner/ComingSoon";

export const Route = createFileRoute("/_authenticated/owner/ai-usage")({
  component: () => <ComingSoon title="AI Usage" description="Detailed token, cost, and per-store AI consumption analytics." />,
});
