import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/owner/ComingSoon";

export const Route = createFileRoute("/_authenticated/owner/backups")({
  component: () => <ComingSoon title="Backups" description="Database backup, restore, and disaster recovery." />,
});
