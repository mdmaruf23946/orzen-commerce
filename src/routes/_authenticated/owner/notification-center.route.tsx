// Legacy Notification Center — merged into /owner/communication.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/owner/notification-center")({
  beforeLoad: () => {
    throw redirect({ to: "/owner/communication", replace: true });
  },
  component: () => null,
});
