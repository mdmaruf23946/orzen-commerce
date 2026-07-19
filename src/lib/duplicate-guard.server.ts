// Server-only duplicate-order guard used by placeOrder.
// Do NOT import from client-reachable modules.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type DuplicateCheckInput = {
  storeId: string;
  phone: string | null;
  customerId: string | null;
  fingerprint: string | null;
  deviceId: string | null;
  productIds: string[];
};

export type DuplicateCheckResult =
  | { action: "allow" }
  | {
      action: "block" | "warn";
      matchedRules: string[];
      matchedOrderId: string | null;
      message: string;
    };

const FRIENDLY =
  "You have already ordered this product recently. Please contact the store if you need to place another order.";

export async function checkDuplicate(
  input: DuplicateCheckInput,
): Promise<DuplicateCheckResult> {
  const sb = supabaseAdmin;
  const { data: settings } = await sb
    .from("store_duplicate_protection")
    .select("*")
    .eq("store_id", input.storeId)
    .maybeSingle();

  if (!settings || !settings.enabled || settings.mode === "off") {
    return { action: "allow" };
  }

  // Whitelist check
  if (input.customerId || input.phone) {
    const { data: wl } = await sb
      .from("store_duplicate_whitelist_customers")
      .select("id")
      .eq("store_id", input.storeId)
      .or(
        [
          input.customerId ? `customer_id.eq.${input.customerId}` : null,
          input.phone ? `phone.eq.${input.phone}` : null,
        ]
          .filter(Boolean)
          .join(","),
      )
      .limit(1);
    if (wl && wl.length > 0) return { action: "allow" };
  }

  // Excluded products: if ALL items in this order are excluded, skip.
  if (input.productIds.length > 0) {
    const { data: excl } = await sb
      .from("store_duplicate_excluded_products")
      .select("product_id")
      .eq("store_id", input.storeId)
      .in("product_id", input.productIds);
    const excludedSet = new Set((excl ?? []).map((r) => r.product_id));
    const allExcluded = input.productIds.every((id) => excludedSet.has(id));
    if (allExcluded) return { action: "allow" };
  }

  const since = new Date(
    Date.now() - settings.period_days * 24 * 60 * 60 * 1000,
  ).toISOString();

  type RuleHit = { rule: string; orderId: string | null };
  const hits: RuleHit[] = [];

  async function findByColumn(col: "phone" | "customer_id" | "fingerprint" | "device_id", value: string) {
    const { data } = await sb
      .from("orders")
      .select("id")
      .eq("store_id", input.storeId)
      .eq(col, value)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);
    return data?.[0]?.id ?? null;
  }

  if (settings.rule_phone && input.phone) {
    const id = await findByColumn("phone", input.phone);
    if (id) hits.push({ rule: "phone", orderId: id });
  }
  if (settings.rule_customer && input.customerId) {
    const id = await findByColumn("customer_id", input.customerId);
    if (id) hits.push({ rule: "customer", orderId: id });
  }
  if (settings.rule_fingerprint && input.fingerprint) {
    const id = await findByColumn("fingerprint", input.fingerprint);
    if (id) hits.push({ rule: "fingerprint", orderId: id });
  }
  if (settings.rule_device && input.deviceId) {
    const id = await findByColumn("device_id", input.deviceId);
    if (id) hits.push({ rule: "device", orderId: id });
  }
  if (settings.rule_product && input.productIds.length > 0) {
    // Find any recent order for this store that contains any of these products.
    const { data: items } = await sb
      .from("order_items")
      .select("order_id, product_id, orders!inner(store_id, created_at)")
      .in("product_id", input.productIds)
      .eq("orders.store_id", input.storeId)
      .gte("orders.created_at", since)
      .limit(1);
    const orderId = (items?.[0] as any)?.order_id ?? null;
    if (orderId) hits.push({ rule: "product", orderId });
  }

  // Count enabled rules
  const enabledCount =
    (settings.rule_phone ? 1 : 0) +
    (settings.rule_customer ? 1 : 0) +
    (settings.rule_fingerprint ? 1 : 0) +
    (settings.rule_device ? 1 : 0) +
    (settings.rule_product ? 1 : 0);

  const matched =
    settings.match_logic === "all"
      ? hits.length > 0 && hits.length === enabledCount
      : hits.length > 0;

  if (!matched) return { action: "allow" };

  const matchedRules = hits.map((h) => h.rule);
  const matchedOrderId = hits[0]?.orderId ?? null;

  if (settings.mode === "warn") {
    return { action: "warn", matchedRules, matchedOrderId, message: FRIENDLY };
  }
  return { action: "block", matchedRules, matchedOrderId, message: FRIENDLY };
}

export const DUPLICATE_MESSAGE = FRIENDLY;
