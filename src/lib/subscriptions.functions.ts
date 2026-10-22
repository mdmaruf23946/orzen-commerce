// Storefront-facing server functions for the Subscription Billing system.
// Isolated from physical / digital / service checkout. Customer identity is
// proven with the store customer session token, never with a Supabase JWT.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Store-level checkout bits a subscription checkout still needs. Plan, trial,
 * fees and policies now live on the subscription product itself.
 */
export const getPublicSubscriptionSettings = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ storeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: store } = await sb
      .from("stores")
      .select("payments_config")
      .eq("id", data.storeId)
      .maybeSingle();
    const pc = ((store as any)?.payments_config ?? {}) as any;
    return {
      cod_enabled: pc?.cod?.enabled !== false,
      payment_methods: Array.isArray(pc?.methods) ? pc.methods : [],
    };
  });


/** Success page / order details: the subscription created by an order. */
export const getSubscriptionForOrder = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        storeId: z.string().uuid().optional(),
        token: z.string().min(16).max(128).optional(),
        contact: z.string().trim().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    // Ownership proof required: customer session token or the order's phone/email.
    const { data: order } = await sb
      .from("orders")
      .select("id,store_id,customer_id,phone,email")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) return null;
    const { ownsOrderRecord } = await import("@/lib/order-ownership.server");
    const ok = await ownsOrderRecord(sb, order as any, {
      storeId: data.storeId,
      token: data.token,
      contact: data.contact,
    });
    if (!ok) return null;
    const { data: row } = await sb.rpc("get_public_subscription_order", {
      _order_id: data.orderId,
    } as any);
    return (row as any) ?? null;
  });

/** Customer dashboard: every subscription owned by the signed-in customer. */
export const listMySubscriptions = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({ storeId: z.string().uuid(), token: z.string().min(16).max(128) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await sb.rpc("get_customer_subscriptions", {
      _token: data.token,
      _store_id: data.storeId,
    } as any);
    return ((rows as any[]) ?? []) as any[];
  });

async function ownedSubscription(sb: any, storeId: string, token: string, subscriptionId: string) {
  const { data: c } = await sb.rpc("customer_from_token", { _token: token, _store_id: storeId } as any);
  const customerId = (c as any)?.id;
  if (!customerId) throw new Error("Please sign in again");
  const { data: sub } = await sb
    .from("store_subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .eq("store_id", storeId)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (!sub) throw new Error("Subscription not found");
  return sub as any;
}

const ownArgs = {
  storeId: z.string().uuid(),
  token: z.string().min(16).max(128),
  subscriptionId: z.string().uuid(),
};

export const cancelMySubscription = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ ...ownArgs, immediate: z.boolean().optional(), reason: z.string().max(300).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    await ownedSubscription(sb, data.storeId, data.token, data.subscriptionId);
    const { cancelSubscription } = await import("@/lib/subscriptions.server");
    await cancelSubscription(sb, data.subscriptionId, {
      immediate: !!data.immediate,
      actor: "customer",
      reason: data.reason,
    });
    return { ok: true };
  });

export const setMyAutoRenew = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ...ownArgs, autoRenew: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    await ownedSubscription(sb, data.storeId, data.token, data.subscriptionId);
    await sb
      .from("store_subscriptions")
      .update({ auto_renew: data.autoRenew, cancel_at_period_end: data.autoRenew ? false : undefined })
      .eq("id", data.subscriptionId);
    return { ok: true };
  });

export const setMyReminders = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ...ownArgs, optIn: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    await ownedSubscription(sb, data.storeId, data.token, data.subscriptionId);
    await sb
      .from("store_subscriptions")
      .update({ reminders_opt_in: data.optIn })
      .eq("id", data.subscriptionId);
    return { ok: true };
  });

/** Customer-triggered renewal: makes sure an open renewal invoice exists. */
export const renewMySubscription = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object(ownArgs).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    await ownedSubscription(sb, data.storeId, data.token, data.subscriptionId);
    const { createRenewalInvoice } = await import("@/lib/subscriptions.server");
    const inv = await createRenewalInvoice(sb, data.subscriptionId);
    return { ok: true, invoiceId: (inv as any).id, invoiceNo: (inv as any).invoice_no, total: Number((inv as any).total) };
  });
