// Server-side plan/subscription enforcement helpers.
// Import into server function handlers so gated features can't be
// invoked by calling the RPC directly (bypassing the client-side UI gate).
import type { FeatureKey } from "@/lib/features";

const READ_ONLY_STATUSES = new Set(["expired", "suspended", "cancelled"]);

type MinimalStore = {
  id: string;
  subscription_status: string | null;
  subscription_packages:
    | { is_trial: boolean | null; features: Record<string, boolean> | null }
    | null;
};

async function loadStoreForUser(supabase: any, userId: string): Promise<MinimalStore | null> {
  const { data } = await supabase
    .from("stores")
    .select("id, subscription_status, subscription_packages(is_trial, features)")
    .eq("owner_user_id", userId)
    .maybeSingle();
  return (data as MinimalStore | null) ?? null;
}

/**
 * Ensures the current user's store has an active subscription and (optionally)
 * that the given feature is included in the active plan. Returns the store id
 * for convenience. Throws a user-facing Error when access is denied.
 */
export async function assertPlan(
  supabase: any,
  userId: string,
  feature?: FeatureKey,
): Promise<string> {
  const store = await loadStoreForUser(supabase, userId);
  if (!store) throw new Error("No store found for this account");

  const status = store.subscription_status ?? "active";
  if (READ_ONLY_STATUSES.has(status)) {
    throw new Error(
      "Your subscription is not active. Please renew your plan to continue.",
    );
  }

  if (feature) {
    const pkg = store.subscription_packages;
    const allowed = !!pkg && (pkg.is_trial === true || pkg.features?.[feature] === true);
    if (!allowed) {
      throw new Error(
        "This feature is not included in your current plan. Please upgrade to continue.",
      );
    }
  }

  return store.id;
}
