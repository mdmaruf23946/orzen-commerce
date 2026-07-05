import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/owner/ComingSoon";

export const Route = createFileRoute("/_authenticated/owner/api")({
  component: () => <ComingSoon title="API Keys" description="Manage owner-issued API keys for external integrations." />,
});
