import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/payment-gateways/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/payment-gateways/apps", replace: true });
  },
});
