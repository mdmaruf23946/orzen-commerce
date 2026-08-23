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

type LimitKind = "product" | "order" | "staff";

const LIMIT_COLUMN: Record<LimitKind, string> = {
  product: "product_limit",
  order: "order_limit",
  staff: "staff_limit",
};

const LIMIT_LABEL: Record<LimitKind, string> = {
  product: "পণ্য",
  order: "অর্ডার",
  staff: "স্টাফ",
};

/**
 * Enforces a numeric plan limit (products / orders / staff).
 * A missing, null or <= 0 limit means "unlimited".
 * Returns the store id so callers can reuse it.
 */
export async function assertLimit(
  supabase: any,
  userId: string,
  kind: LimitKind,
): Promise<string> {
  const { data: store } = await supabase
    .from("stores")
    .select(
      "id, subscription_status, subscription_packages(is_trial, product_limit, order_limit, staff_limit)",
    )
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!store) throw new Error("No store found for this account");

  const pkg = (store as any).subscription_packages;
  const limit = pkg ? Number(pkg[LIMIT_COLUMN[kind]] ?? 0) : 0;
  if (!pkg || !limit || limit <= 0) return (store as any).id;

  const storeId = (store as any).id as string;
  let used = 0;

  if (kind === "product") {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId);
    used = count ?? 0;
  } else if (kind === "staff") {
    const { count } = await supabase
      .from("store_staff")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId);
    used = count ?? 0;
  } else {
    // Orders are counted for the current calendar month.
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .gte("created_at", start.toISOString());
    used = count ?? 0;
  }

  if (used >= limit) {
    throw new Error(
      `আপনার প্ল্যানের ${LIMIT_LABEL[kind]} সীমা (${limit}) শেষ হয়ে গেছে। আরও যোগ করতে Billing & Plans থেকে প্ল্যান আপগ্রেড করুন।`,
    );
  }
  return storeId;
}
