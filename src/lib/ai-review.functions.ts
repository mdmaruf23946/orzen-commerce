// AI review, low-stock and handoff-queue server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function myStoreId(supabase: any, userId: string) {
  const { data } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
  return data?.id as string | undefined;
}

// ---------- AI recommendation history ----------
export const listAiRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ days: z.number().int().min(1).max(90).optional().default(14) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return [];
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const { data: rows } = await context.supabase
      .from("ai_product_recommendations")
      .select("id, created_at, tool_name, context, conversation_id, product_id, products(id,name,price,stock,primary_image_url), ai_conversations(customer_name, external_id)")
      .eq("store_id", sid)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    return rows ?? [];
  });

// ---------- Blacklist ----------
export const listAiBlacklist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return [];
    const { data } = await context.supabase
      .from("ai_product_blacklist")
      .select("id, product_id, reason, created_at, products(id,name,primary_image_url)")
      .eq("store_id", sid)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const addAiBlacklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ product_id: z.string().uuid(), reason: z.string().max(400).optional().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { error } = await context.supabase
      .from("ai_product_blacklist")
      .upsert({ store_id: sid, product_id: data.product_id, reason: data.reason ?? null }, { onConflict: "store_id,product_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeAiBlacklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { error } = await context.supabase.from("ai_product_blacklist").delete().eq("id", data.id).eq("store_id", sid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Low stock alerts ----------
export const listLowStockAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return [];
    const { data } = await context.supabase
      .from("low_stock_alerts")
      .select("id, product_id, current_stock, threshold, created_at, resolved_at, products(id,name,primary_image_url,stock,low_stock_threshold,category_id,product_type)")
      .eq("store_id", sid)
      .is("resolved_at", null)
      .or("products.product_type.eq.physical,products.product_type.is.null")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const resolveLowStockAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { error } = await context.supabase
      .from("low_stock_alerts")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("store_id", sid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Handoff queue ----------
export const listHandoffQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return [];
    const { data } = await context.supabase
      .from("ai_conversations")
      .select("id, customer_name, external_id, channel, handoff_mode, handoff_reason, handoff_at, last_message_preview, last_message_at, unread_count")
      .eq("store_id", sid)
      .eq("handoff_mode", "human")
      .order("handoff_at", { ascending: true, nullsFirst: false });
    return data ?? [];
  });

export const returnConversationToAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { error } = await context.supabase
      .from("ai_conversations")
      .update({ handoff_mode: "ai", handoff_reason: null, handoff_at: null } as any)
      .eq("id", data.conversation_id)
      .eq("store_id", sid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Order courier update ----------
export const updateOrderCourierInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      order_id: z.string().uuid(),
      courier_name: z.string().trim().max(80).optional().nullable(),
      courier_code: z.string().trim().max(40).optional().nullable(),
      courier_tracking_id: z.string().trim().max(80).optional().nullable(),
      courier_status: z.string().trim().max(80).optional().nullable(),
      estimated_delivery: z.string().optional().nullable(),
      note: z.string().trim().max(300).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const patch: Record<string, any> = { courier_last_synced_at: new Date().toISOString() };
    if (data.courier_name !== undefined) patch.courier_name = data.courier_name;
    if (data.courier_code !== undefined) patch.courier_code = data.courier_code;
    if (data.courier_tracking_id !== undefined) patch.courier_tracking_id = data.courier_tracking_id;
    if (data.courier_status !== undefined) patch.courier_status = data.courier_status;
    const { error } = await context.supabase
      .from("orders")
      .update(patch as any)
      .eq("id", data.order_id)
      .eq("store_id", sid);
    if (error) throw new Error(error.message);
    // Append a timeline event
    const note = data.note
      || [data.courier_name, data.courier_tracking_id ? `#${data.courier_tracking_id}` : null, data.estimated_delivery ? `ETA ${data.estimated_delivery}` : null]
        .filter(Boolean)
        .join(" · ");
    if (note) {
      await context.supabase.from("order_timeline").insert({
        store_id: sid,
        order_id: data.order_id,
        stage: "courier_assigned",
        note,
      } as any);
    }
    return { ok: true };
  });
