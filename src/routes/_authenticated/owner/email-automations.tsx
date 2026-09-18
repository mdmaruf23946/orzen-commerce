// Moved into the Communication & Emails section.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/owner/email-automations")({
  beforeLoad: () => {
    throw redirect({ to: "/owner/communication/automations", replace: true });
  },
  component: () => null,
});
