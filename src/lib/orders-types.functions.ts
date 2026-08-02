// Store Admin operations for non-physical orders: confirmation, service
// scheduling and subscription lifecycle. Physical orders are never touched.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function myStoreId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

async function ownedOrder(supabase: any, userId: string, orderId: string) {
  const storeId = await myStoreId(supabase, userId);
  if (!storeId) throw new Error("Store not found");
  const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
  const { data: order } = await sb
    .from("orders")
    .select("id,store_id,order_type,confirmation_status,fulfillment_meta")
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!order) throw new Error("Order not found");
  return { sb, storeId, order: order as any };
}

const orderInput = z.object({ orderId: z.string().uuid() });

/** Store-level auto/manual confirmation preferences. */
export const getOrderConfirmationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    if (!storeId) return { digital: "auto", service: "manual", subscription: "manual" };
    const { data } = await context.supabase
      .from("stores")
      .select("order_confirmation")
      .eq("id", storeId)
      .maybeSingle();
    const { normalizeConfirmation } = await import("@/lib/orders-confirm.server");
    return normalizeConfirmation((data as any)?.order_confirmation);
  });

export const setOrderConfirmationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        digital: z.enum(["auto", "manual"]),
        service: z.enum(["auto", "manual"]),
        subscription: z.enum(["auto", "manual"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    if (!storeId) throw new Error("Store not found");
    const { error } = await context.supabase
      .from("stores")
      .update({ order_confirmation: data } as any)
      .eq("id", storeId);
    if (error) throw new Error(error.message);
    return data;
  });

/** Manual confirmation — runs the same actions auto-confirm would. */
export const confirmOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => orderInput.parse(d))
  .handler(async ({ data, context }) => {
    const { sb, order } = await ownedOrder(context.supabase, context.userId, data.orderId);
    if (order.order_type === "physical") throw new Error("Physical orders use the existing workflow");
    const { confirmOrderRow } = await import("@/lib/orders-confirm.server");
    return confirmOrderRow(sb as any, order.id);
  });

/** Books or reschedules a service order. */
export const scheduleService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    orderInput
      .extend({
        booking_date: z.string().max(30).nullable().optional(),
        booking_time: z.string().max(20).nullable().optional(),
        staff: z.string().trim().max(120).nullable().optional(),
        note: z.string().trim().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb, order } = await ownedOrder(context.supabase, context.userId, data.orderId);
    if (order.order_type !== "service") throw new Error("Not a service order");
    const meta = { ...(order.fulfillment_meta ?? {}) };
    if (data.booking_date !== undefined) meta.booking_date = data.booking_date || null;
    if (data.booking_time !== undefined) meta.booking_time = data.booking_time || null;
    if (data.staff !== undefined) meta.staff = data.staff || null;
    if (data.note !== undefined) meta.note = data.note || null;
    meta.service_state = meta.service_state === "completed" ? "completed" : "scheduled";
    const { error } = await sb.from("orders").update({ fulfillment_meta: meta }).eq("id", order.id);
    if (error) throw new Error(error.message);
    return meta;
  });

/** Marks a service order as delivered/completed. */
export const completeService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => orderInput.parse(d))
  .handler(async ({ data, context }) => {
    const { sb, order } = await ownedOrder(context.supabase, context.userId, data.orderId);
    if (order.order_type !== "service") throw new Error("Not a service order");
    const meta = {
      ...(order.fulfillment_meta ?? {}),
      service_state: "completed",
      completed_at: new Date().toISOString(),
    };
    const { error } = await sb.from("orders").update({ fulfillment_meta: meta }).eq("id", order.id);
    if (error) throw new Error(error.message);
    return meta;
  });

/** Pushes a subscription renewal date forward. */
export const extendSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => orderInput.extend({ days: z.number().int().min(1).max(3650) }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, order } = await ownedOrder(context.supabase, context.userId, data.orderId);
    if (order.order_type !== "subscription") throw new Error("Not a subscription order");
    const meta = { ...(order.fulfillment_meta ?? {}) };
    const base = meta.renewal_at && new Date(meta.renewal_at) > new Date() ? new Date(meta.renewal_at) : new Date();
    base.setDate(base.getDate() + data.days);
    meta.renewal_at = base.toISOString();
    meta.subscription_state = "active";
    const { error } = await sb.from("orders").update({ fulfillment_meta: meta }).eq("id", order.id);
    if (error) throw new Error(error.message);
    return meta;
  });

/** Cancels an active subscription. */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => orderInput.parse(d))
  .handler(async ({ data, context }) => {
    const { sb, order } = await ownedOrder(context.supabase, context.userId, data.orderId);
    if (order.order_type !== "subscription") throw new Error("Not a subscription order");
    const meta = {
      ...(order.fulfillment_meta ?? {}),
      subscription_state: "cancelled",
      cancelled_at: new Date().toISOString(),
    };
    const { error } = await sb.from("orders").update({ fulfillment_meta: meta }).eq("id", order.id);
    if (error) throw new Error(error.message);
    return meta;
  });
