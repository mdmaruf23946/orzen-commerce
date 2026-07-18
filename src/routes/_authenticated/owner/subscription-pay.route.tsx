// Parent layout for /owner/subscription-pay so index + providers can nest.
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/owner/subscription-pay")({
  component: () => <Outlet />,
});
