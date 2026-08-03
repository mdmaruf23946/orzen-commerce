// Storefront-facing server functions for the Subscription Billing system.
// Isolated from physical / digital / service checkout. Customer identity is
// proven with the store customer session token, never with a Supabase JWT.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DEFAULT_SUBSCRIPTION_SETTINGS } from "@/lib/subscriptions";

/** Public subscription settings a storefront checkout needs. */
export const getPublicSubscriptionSettings = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ storeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: row } = await sb.rpc("get_store_subscription_public_settings", {
      _store_id: data.storeId,
    } as any);
    const r = (row as any) ?? {};
    return {
      auto_renew_default: r.auto_renew_default ?? DEFAULT_SUBSCRIPTION_SETTINGS.auto_renew_default,
      default_billing_cycle: r.default_billing_cycle ?? "monthly",
      allow_free_trial: r.allow_free_trial ?? false,
      trial_days: Number(r.trial_days ?? 0),
      grace_period_days: Number(r.grace_period_days ?? 3),
      cancellation_policy: r.cancellation_policy ?? null,
      refund_policy: r.refund_policy ?? null,
      subscription_terms: r.subscription_terms ?? null,
      setup_fee: Number(r.setup_fee ?? 0),
      tax_percent: Number(r.tax_percent ?? 0),
      payment_methods: Array.isArray(r.payment_methods) ? r.payment_methods : [],
      cod_enabled: r.cod_enabled ?? false,
      success_redirect_url: r.success_redirect_url ?? null,
    };
  });

/** Success page / order details: the subscription created by an order. */
export const getSubscriptionForOrder = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
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
