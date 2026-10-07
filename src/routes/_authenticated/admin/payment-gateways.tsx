import { createFileRoute, Outlet } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";

export const Route = createFileRoute("/_authenticated/admin/payment-gateways")({
  component: () => (
    <FeatureGate feature="payment_gateways">
      <Outlet />
    </FeatureGate>
  ),
});
