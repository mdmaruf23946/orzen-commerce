// Legacy Announcements — merged into /owner/communication.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/owner/notifications")({
  beforeLoad: () => {
    throw redirect({ to: "/owner/communication", replace: true });
  },
  component: () => null,
});
