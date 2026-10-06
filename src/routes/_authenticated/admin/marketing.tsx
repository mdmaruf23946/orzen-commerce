import { createFileRoute, Outlet } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";

export const Route = createFileRoute("/_authenticated/admin/marketing")({
  component: () => (
    <FeatureGate feature="pixel">
      <Outlet />
    </FeatureGate>
  ),
});
