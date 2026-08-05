// Global subscription settings were removed: subscriptions are configured per
// product in the Subscription product form. Old links keep working.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/settings/subscription")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/settings/information" });
  },
});
