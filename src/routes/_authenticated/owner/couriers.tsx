import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/owner/ComingSoon";

export const Route = createFileRoute("/_authenticated/owner/couriers")({
  component: () => <ComingSoon title="Courier Management" description="Configure courier providers, credentials, and default routing." />,
});
