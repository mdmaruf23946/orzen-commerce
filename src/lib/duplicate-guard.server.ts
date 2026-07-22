// Server-only duplicate-order guard used by placeOrder and Messenger AI.
// Do NOT import from client-reachable modules.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type DuplicateCheckInput = {
  storeId: string;
  phone: string | null;
  customerId: string | null;
  fingerprint: string | null;
  deviceId: string | null;
  productIds: string[];
  psid?: string | null;
};

export type DuplicateMatchedOrder = {
  id: string;
  invoice_no: string | null;
  status: string | null;
} | null;

export type DuplicateCheckResult =
  | { action: "allow" }
  | {
      action: "block" | "warn";
      matchedRules: string[];
      matchedOrderId: string | null;
      matchedOrder: DuplicateMatchedOrder;
      message: string;
    };

const FRIENDLY =
  "You have already ordered this product recently. Please contact the store if you need to place another order.";

const ACTIVE_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
] as const;

const EXTRA_ACTIVE_ORDER_STATUSES = new Set([
  "packed",
  "ready_for_courier",
  "ready for courier",
  "courier_assigned",
  "shipped",
]);

function isActiveOrderStatus(status: string | null | undefined) {
  const normalized = String(status ?? "").toLowerCase();
  return (
    (ACTIVE_ORDER_STATUSES as readonly string[]).includes(normalized) ||
    EXTRA_ACTIVE_ORDER_STATUSES.has(normalized)
  );
}

function profileOrderIds(profile: Record<string, any> | null | undefined) {
  const ids = new Set<string>();
  const collect = (value: any) => {
    const id = value?.order_id ?? value?.id;
    if (typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) ids.add(id);
  };
  collect(profile?.last_order);
  if (Array.isArray(profile?.orders)) profile.orders.forEach(collect);
  if (Array.isArray(profile?.order_history)) profile.order_history.forEach(collect);
  return Array.from(ids);
}

export async function checkDuplicate(
  input: DuplicateCheckInput,
): Promise<DuplicateCheckResult> {
  const sb = supabaseAdmin;
  const { data: existing } = await sb
    .from("store_duplicate_protection")
    .select("*")
    .eq("store_id", input.storeId)
    .maybeSingle();

  // Default to ON with safe rules when a store has never opened the settings
  // page, so duplicate protection works out of the box.
  const settings: any = existing ?? {
    enabled: true,
    mode: "block",
    period_days: 7,
    rule_phone: true,
    rule_product: true,
    rule_customer: true,
    rule_fingerprint: true,
    rule_device: true,
    rule_psid: true,
    match_logic: "any",
    messenger_enabled: true,
  };

  if (!settings.enabled || settings.mode === "off") {
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

  // Messenger needs stricter matching than generic checkout rules: the same
  // customer/page identity AND the same product must point to the same active
  // order. This prevents both false negatives (PSID-only not checked early) and
  // false positives (another customer ordered the same product).
  if (input.psid && input.productIds.length > 0 && settings.rule_product !== false) {
    const identityMatches = new Map<string, Set<string>>();
    const addIdentityHit = (orderId: string | null | undefined, rule: string) => {
      if (!orderId) return;
      const set = identityMatches.get(orderId) ?? new Set<string>();
      set.add(rule);
      identityMatches.set(orderId, set);
    };

    async function addByColumn(
      col: "phone" | "customer_id" | "fingerprint" | "device_id",
      value: string,
      rule: string,
    ) {
      const { data } = await sb
        .from("orders")
        .select("id")
        .eq("store_id", input.storeId)
        .eq(col, value)
        .eq("allow_duplicate", false)
        .in("status", ACTIVE_ORDER_STATUSES)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10);
      for (const row of data ?? []) addIdentityHit((row as any).id, rule);
    }

    if (settings.rule_phone && input.phone) await addByColumn("phone", input.phone, "phone");
    if (settings.rule_customer && input.customerId) await addByColumn("customer_id", input.customerId, "customer");
    if (settings.rule_fingerprint && input.fingerprint) await addByColumn("fingerprint", input.fingerprint, "fingerprint");
    if (settings.rule_device && input.deviceId) await addByColumn("device_id", input.deviceId, "device");

    if ((settings as any).rule_psid) {
      const { data: convs } = await sb
        .from("ai_conversations")
        .select("psid_profile")
        .eq("store_id", input.storeId)
        .eq("channel", "messenger")
        .eq("external_id", input.psid)
        .limit(5);
      const ids = Array.from(
        new Set((convs ?? []).flatMap((c) => profileOrderIds((c as any).psid_profile as any))),
      );
      if (ids.length > 0) {
        const { data: orders } = await sb
          .from("orders")
          .select("id")
          .eq("store_id", input.storeId)
          .eq("allow_duplicate", false)
          .in("status", ACTIVE_ORDER_STATUSES)
          .gte("created_at", since)
          .in("id", ids);
        for (const row of orders ?? []) addIdentityHit((row as any).id, "psid");
      }
    }

    if (identityMatches.size === 0) return { action: "allow" };

    const { data: items } = await sb
      .from("order_items")
      .select("order_id, product_id, orders!inner(store_id, created_at, status, allow_duplicate)")
      .in("product_id", input.productIds)
      .eq("orders.store_id", input.storeId)
      .eq("orders.allow_duplicate", false)
      .in("orders.status", ACTIVE_ORDER_STATUSES)
      .gte("orders.created_at", since)
      .limit(50);
    const productOrderIds = new Set((items ?? []).map((row: any) => row.order_id).filter(Boolean));
    const matchedOrderId = Array.from(identityMatches.keys()).find((id) => productOrderIds.has(id)) ?? null;
    if (!matchedOrderId) return { action: "allow" };

    const matchedRules = Array.from(identityMatches.get(matchedOrderId) ?? []);
    if (!matchedRules.includes("product")) matchedRules.push("product");
    let matchedOrder: DuplicateMatchedOrder = null;
    const { data: mo } = await sb
      .from("orders")
      .select("id, invoice_no, status")
      .eq("id", matchedOrderId)
      .maybeSingle();
    matchedOrder = (mo as any) ?? null;
    // Messenger duplicate protection must stop duplicate creation immediately;
    // admin override is handled per-order with allow_duplicate.
    return { action: "block", matchedRules, matchedOrderId, matchedOrder, message: FRIENDLY };
  }

  async function findByColumn(
    col: "phone" | "customer_id" | "fingerprint" | "device_id",
    value: string,
  ) {
    const { data } = await sb
      .from("orders")
      .select("id")
      .eq("store_id", input.storeId)
      .eq(col, value)
      .eq("allow_duplicate", false)
      .in("status", ACTIVE_ORDER_STATUSES)
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
  if ((settings as any).rule_psid && input.psid) {
    // Match by PSID via ai_conversations.psid_profile.last_order (populated on
    // Messenger order finalization). Verify the referenced order is still active.
    const { data: convs } = await sb
      .from("ai_conversations")
      .select("psid_profile")
      .eq("store_id", input.storeId)
      .eq("channel", "messenger")
      .eq("external_id", input.psid)
      .limit(5);
    for (const c of convs ?? []) {
      const last = ((c as any).psid_profile as any)?.last_order;
      const oid = last?.order_id as string | undefined;
      if (!oid) continue;
      const { data: o } = await sb
        .from("orders")
        .select("id, status, allow_duplicate, created_at")
        .eq("id", oid)
        .maybeSingle();
      if (
        o &&
        !(o as any).allow_duplicate &&
        isActiveOrderStatus((o as any).status) &&
        new Date((o as any).created_at).toISOString() >= since
      ) {
        hits.push({ rule: "psid", orderId: oid });
        break;
      }
    }
  }
  if (settings.rule_product && input.productIds.length > 0) {
    // Find any recent order for this store that contains any of these products.
    const { data: items } = await sb
      .from("order_items")
      .select("order_id, product_id, orders!inner(store_id, created_at, status, allow_duplicate)")
      .in("product_id", input.productIds)
      .eq("orders.store_id", input.storeId)
      .eq("orders.allow_duplicate", false)
      .in("orders.status", ACTIVE_ORDER_STATUSES)
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
    (settings.rule_product ? 1 : 0) +
    ((settings as any).rule_psid ? 1 : 0);

  const matched =
    settings.match_logic === "all"
      ? hits.length > 0 && hits.length === enabledCount
      : hits.length > 0;

  if (!matched) return { action: "allow" };

  const matchedRules = hits.map((h) => h.rule);
  const matchedOrderId = hits[0]?.orderId ?? null;

  let matchedOrder: DuplicateMatchedOrder = null;
  if (matchedOrderId) {
    const { data: mo } = await sb
      .from("orders")
      .select("id, invoice_no, status")
      .eq("id", matchedOrderId)
      .maybeSingle();
    matchedOrder = (mo as any) ?? null;
  }

  if (settings.mode === "warn") {
    return { action: "warn", matchedRules, matchedOrderId, matchedOrder, message: FRIENDLY };
  }
  return { action: "block", matchedRules, matchedOrderId, matchedOrder, message: FRIENDLY };
}

export const DUPLICATE_MESSAGE = FRIENDLY;
