import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/owner/ComingSoon";

export const Route = createFileRoute("/_authenticated/owner/logs")({
  component: () => <ComingSoon title="Login Logs" description="Authentication history and suspicious login detection." />,
});
