import { createFileRoute, redirect } from "@tanstack/react-router";

// Old "Payment Gateways" URL — keep bookmarks working.
export const Route = createFileRoute("/_authenticated/admin/payment-gateway")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/payment-gateways/apps", replace: true });
  },
});
