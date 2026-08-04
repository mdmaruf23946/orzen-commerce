import { createFileRoute } from "@tanstack/react-router";
import { SubscriptionSettingsSection } from "@/components/admin/settings/SubscriptionSettingsSection";

export const Route = createFileRoute("/_authenticated/admin/settings/subscription")({
  component: SubscriptionSettingsPage,
});

function SubscriptionSettingsPage() {
  return (
    <div className="pb-24">
      <div className="mb-5">
        <h1 className="text-xl font-semibold sm:text-2xl">Subscription Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Global rules for subscription plans and renewals.
        </p>
      </div>
      <SubscriptionSettingsSection />
    </div>
  );
}
