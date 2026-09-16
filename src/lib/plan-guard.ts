// Server-side plan/subscription enforcement helpers.
// Import into server function handlers so gated features can't be
// invoked by calling the RPC directly (bypassing the client-side UI gate).
import type { FeatureKey } from "@/lib/features";
import { myStoreRow } from "@/lib/store-access";
import { INACTIVE_STATUSES } from "@/lib/features";

const INACTIVE = new Set<string>(INACTIVE_STATUSES as readonly string[]);

export const FREE_PLAN_FIELDS =
  "is_trial, features, product_limit, order_limit, staff_limit, storage_mb, landing_page_limit";

/** The active Free plan every store falls back to when its paid plan lapses. */
export async function loadFreePlan(supabase: any): Promise<any | null> {
  const { data } = await supabase
    .from("subscription_packages")
    .select(FREE_PLAN_FIELDS)
    .eq("is_active", true)
    .eq("is_trial", false)
    .eq("plan_tier", "free")
    .order("price", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/**
 * Returns the plan whose access actually applies: the store's own plan while
 * the subscription is active, otherwise nothing (the store is locked).
 */
export async function resolveEffectivePlan(
  _supabase: any,
  store: { subscription_status?: string | null; subscription_packages?: any },
): Promise<any | null> {
  const status = store?.subscription_status ?? "active";
  if (!INACTIVE.has(status)) return store?.subscription_packages ?? null;
  return null;
}

export const PLAN_LOCKED_MESSAGE =
  "আপনার ট্রায়াল/প্ল্যানের মেয়াদ শেষ — ফ্রি প্ল্যান চালু করুন অথবা একটি প্ল্যান কিনুন, তারপর আবার চেষ্টা করুন।";

type MinimalStore = {
  id: string;
  subscription_status: string | null;
  subscription_packages:
    | { is_trial: boolean | null; features: Record<string, boolean> | null }
    | null;
};

async function loadStoreForUser(supabase: any, userId: string): Promise<MinimalStore | null> {
  const data = await myStoreRow(supabase, userId, "id, subscription_status, subscription_packages(is_trial, features)");
  return (data as MinimalStore | null) ?? null;
}

/**
 * Ensures a plan is actually active and includes the given feature.
 * An ended trial / expired / suspended / cancelled subscription locks the
 * store entirely. Returns the store id for convenience.
 */
export async function assertPlan(
  supabase: any,
  userId: string,
  feature?: FeatureKey,
): Promise<string> {
  const store = await loadStoreForUser(supabase, userId);
  if (!store) throw new Error("No store found for this account");

  const expired = INACTIVE.has(store.subscription_status ?? "active");
  if (expired) throw new Error(PLAN_LOCKED_MESSAGE);

  if (feature) {
    const pkg = await resolveEffectivePlan(supabase, store);
    const allowed = !!pkg && (pkg.is_trial === true || pkg.features?.[feature] === true);
    if (!allowed) {
      throw new Error("This feature is not included in your current plan. Please upgrade to continue.");
    }
  }

  return store.id;
}


type LimitKind = "product" | "order" | "staff" | "landing_page";

const LIMIT_COLUMN: Record<LimitKind, string> = {
  product: "product_limit",
  order: "order_limit",
  staff: "staff_limit",
  landing_page: "landing_page_limit",
};

const LIMIT_LABEL: Record<LimitKind, string> = {
  product: "পণ্য",
  order: "অর্ডার",
  staff: "স্টাফ",
  landing_page: "ল্যান্ডিং পেজ",
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
  const store = await myStoreRow(supabase, userId, "id, subscription_status, subscription_packages(is_trial, product_limit, order_limit, staff_limit, landing_page_limit)");
  if (!store) throw new Error("No store found for this account");

  const pkg = await resolveEffectivePlan(supabase, store as any);
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
  } else if (kind === "landing_page") {
    const { count } = await supabase
      .from("landing_pages")
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
