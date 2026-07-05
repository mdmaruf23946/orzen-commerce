import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/owner/ComingSoon";

export const Route = createFileRoute("/_authenticated/owner/dev-logs")({
  component: () => <ComingSoon title="System Logs" description="Application, edge function, and error logs." />,
});
