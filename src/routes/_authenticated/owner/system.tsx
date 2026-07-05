import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/owner/ComingSoon";

export const Route = createFileRoute("/_authenticated/owner/system")({
  component: () => <ComingSoon title="System Settings" description="Platform name, logo, domain, currency, timezone, email, SMS, and WhatsApp." />,
});
