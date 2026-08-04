// Legacy URL. Subscription orders are now managed from Orders → Subscription.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/orders" });
  },
});
