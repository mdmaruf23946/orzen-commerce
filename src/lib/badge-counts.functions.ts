import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FEATURES = [
  "orders",
  "returns",
  "customers",
  "messenger",
  "payments",
  "payment_gateway",
  "delivery",
  "landing_pages",
  "duplicate_protection",
  "ai_recommendations",
] as const;

export type BadgeFeature = (typeof FEATURES)[number];
export type BadgeCounts = {
  orders: number;
  returns: number;
  customers: number;
  messenger: number;
  handoff: number;
  low_stock: number;
  notifications: number;
  payments: number;
  payment_gateway: number;
  delivery: number;
  landing_pages: number;
  duplicate_protection: number;
  ai_recommendations: number;
};

const EPOCH = "1970-01-01T00:00:00Z";
const COURIER_EXCEPTION_STATUSES = [
  "failed",
  "returned",
  "cancelled",
  "exception",
  "hold",
  "lost",
];

async function count(
  supabase: any,
  table: string,
  build: (q: any) => any,
): Promise<number> {
  const q = build(supabase.from(table).select("id", { count: "exact", head: true }));
  const { count: c, error } = await q;
  if (error) {
    console.error(`[badge-counts] ${table}:`, error.message);
    return 0;
  }
  return c ?? 0;
}

export const getAdminBadgeCounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ store_id: string | null; counts: BadgeCounts }> => {
    const { supabase, userId } = context;

    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();
    const storeId = store?.id ?? null;
    const empty: BadgeCounts = {
      orders: 0, returns: 0, customers: 0, messenger: 0, handoff: 0,
      low_stock: 0, notifications: 0, payments: 0, payment_gateway: 0,
      delivery: 0, landing_pages: 0, duplicate_protection: 0, ai_recommendations: 0,
    };
    if (!storeId) return { store_id: null, counts: empty };


    // Load cursors
    const { data: cursorRows } = await supabase
      .from("admin_read_cursors")
      .select("feature,last_seen_at")
      .eq("user_id", userId)
      .eq("store_id", storeId);

    const cursors = new Map<string, string>();
    for (const r of cursorRows ?? []) cursors.set(r.feature, r.last_seen_at);
    const c = (f: BadgeFeature) => cursors.get(f) ?? EPOCH;

    const [
      orders,
      returns,
      customers,
      payments,
      payment_gateway,
      delivery,
      landing_pages,
      duplicate_protection,
      ai_recommendations,
      handoff,
      low_stock,
      notifications,
    ] = await Promise.all([
      count(supabase, "orders", (q) =>
        q.eq("store_id", storeId).gt("created_at", c("orders")).neq("status", "cancelled"),
      ),
      count(supabase, "returns", (q) =>
        q.eq("store_id", storeId).gt("created_at", c("returns")).eq("status", "pending"),
      ),
      count(supabase, "store_customers", (q) =>
        q.eq("store_id", storeId).gt("created_at", c("customers")),
      ),
      count(supabase, "payments", (q) =>
        q
          .eq("store_id", storeId)
          .gt("created_at", c("payments"))
          .in("status", ["failed", "requires_action", "pending_verification", "pending"]),
      ),
      count(supabase, "payment_webhook_events", (q) =>
        q
          .eq("store_id", storeId)
          .gt("received_at", c("payment_gateway"))
          .or("signature_valid.eq.false,error_message.not.is.null"),
      ),
      count(supabase, "orders", (q) =>
        q
          .eq("store_id", storeId)
          .gt("updated_at", c("delivery"))
          .in("courier_status", COURIER_EXCEPTION_STATUSES),
      ),
      count(supabase, "landing_page_logs", (q) =>
        q.eq("store_id", storeId).gt("received_at", c("landing_pages")).eq("status", "failed"),
      ),
      count(supabase, "store_duplicate_blocks", (q) =>
        q
          .eq("store_id", storeId)
          .gt("created_at", c("duplicate_protection"))
          .eq("status", "blocked"),
      ),
      count(supabase, "ai_product_recommendations", (q) =>
        q.eq("store_id", storeId).gt("created_at", c("ai_recommendations")),
      ),
      count(supabase, "ai_conversations", (q) =>
        q
          .eq("store_id", storeId)
          .not("handoff_at", "is", null)
          .neq("handoff_mode", "ai"),
      ),
      count(supabase, "low_stock_alerts", (q) =>
        q.eq("store_id", storeId).is("resolved_at", null),
      ),
      count(supabase, "admin_notifications", (q) =>
        q.eq("store_id", storeId).is("read_at", null),
      ),
    ]);

    // Messenger: distinct conversations with new customer messages since cursor.
    // Approximation: conversations whose last_message_at > cursor (channel != null).
    const messenger = await count(supabase, "ai_conversations", (q) =>
      q.eq("store_id", storeId).gt("last_message_at", c("messenger")),
    );

    return {
      orders,
      returns,
      customers,
      messenger,
      handoff,
      low_stock,
      notifications,
      payments,
      payment_gateway,
      delivery,
      landing_pages,
      duplicate_protection,
      ai_recommendations,
    };
  });

export const markFeatureSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { store_id: string; feature: BadgeFeature | string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("admin_read_cursors")
      .upsert(
        {
          user_id: userId,
          store_id: data.store_id,
          feature: data.feature,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,store_id,feature" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversation_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("ai_conversations")
      .update({ last_read_at: new Date().toISOString(), unread_count: 0 })
      .eq("id", data.conversation_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { store_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("admin_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("store_id", data.store_id)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
