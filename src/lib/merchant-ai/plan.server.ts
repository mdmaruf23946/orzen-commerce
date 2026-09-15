// Server-side plan gate for the Merchant AI Command Center.
// Used by the channel router (Messenger / WhatsApp), which has no user session,
// so the panel-side gate in merchant-ai.functions.ts cannot be reused there.
import { hasFeature } from "@/lib/features";
import type { Db } from "./core.server";

const PLAN_FIELDS =
  "id,name,price,features,is_trial,plan_tier,product_limit,order_limit,staff_limit,landing_page_limit";

export async function loadStoreWithPlan(db: Db, storeId: string) {
  const { data: store } = await db
    .from("stores")
    .select(`*, subscription_packages(${PLAN_FIELDS})`)
    .eq("id", storeId)
    .maybeSingle();
  if (!store) return null;
  if (["expired", "suspended", "cancelled"].includes((store as any).subscription_status ?? "active")) {
    const { data: freePkg } = await db
      .from("subscription_packages")
      .select(PLAN_FIELDS)
      .eq("is_active", true)
      .eq("is_trial", false)
      .eq("plan_tier", "free")
      .limit(1)
      .maybeSingle();
    (store as any).free_package = freePkg ?? null;
  }
  return store;
}

/** True when this store's current (possibly downgraded) plan includes the AI agent. */
export async function storeHasAiAgent(db: Db, storeId: string) {
  const store = await loadStoreWithPlan(db, storeId);
  if (!store) return false;
  try {
    return hasFeature(store as any, "ai_agent");
  } catch {
    return false;
  }
}
