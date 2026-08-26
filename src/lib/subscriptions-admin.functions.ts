// Store-owner (admin) server functions for the Subscription Billing system.
import { createServerFn } from "@tanstack/react-start";
import { myStoreRow } from "@/lib/store-access";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CYCLES } from "@/lib/subscriptions";
import { z } from "zod";

async function storeIdOf(sb: any, userId: string) {
  const data = await myStoreRow(sb, userId, "id");
  return (data as any)?.id ?? null;
}

/** List + KPI summary for the admin Subscriptions page. */
export const listAdminSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await storeIdOf(context.supabase, context.userId);
    if (!storeId) return { rows: [], kpis: { active: 0, trialing: 0, pending: 0, expiring: 0, cancelled: 0, mrr: 0 } };
    const { data: rows } = await context.supabase
      .from("store_subscriptions")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(500);

    const list = ((rows as any[]) ?? []);
    const now = Date.now();
    const next7 = now + 7 * 86400000;
    const monthly = (s: any) => {
      const p = Number(s.renewal_price ?? s.price ?? 0);
      switch (s.billing_cycle) {
        case "weekly": return (p * 52) / 12;
        case "quarterly": return p / 3;
        case "half_yearly": return p / 6;
        case "yearly": return p / 12;
        case "lifetime": return 0;
        case "custom": return (p * 30) / Math.max(1, Number(s.custom_cycle_days ?? 30));
        default: return p;
      }
    };
    const kpis = {
      active: list.filter((s) => s.status === "active").length,
      trialing: list.filter((s) => s.status === "trialing").length,
      pending: list.filter((s) => s.status === "pending").length,
      cancelled: list.filter((s) => ["cancelled", "expired"].includes(s.status)).length,
      expiring: list.filter(
        (s) =>
          s.next_billing_date &&
          new Date(s.next_billing_date).getTime() >= now &&
          new Date(s.next_billing_date).getTime() <= next7,
      ).length,
      mrr: Math.round(
        list.filter((s) => ["active", "trialing", "grace"].includes(s.status)).reduce((a, s) => a + monthly(s), 0),
      ),
    };
    return { rows: list, kpis };
  });

/** Full detail drawer: subscription + invoices + events. */
export const getAdminSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdOf(context.supabase, context.userId);
    if (!storeId) return null;
    const { data: sub } = await context.supabase
      .from("store_subscriptions")
      .select("*")
      .eq("id", data.id)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!sub) return null;
    const [{ data: invoices }, { data: events }] = await Promise.all([
      context.supabase
        .from("store_subscription_invoices")
        .select("*")
        .eq("subscription_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("store_subscription_events")
        .select("*")
        .eq("subscription_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return { subscription: sub as any, invoices: (invoices ?? []) as any[], events: (events ?? []) as any[] };
  });

const ACTIONS = [
  "activate",
  "suspend",
  "resume",
  "cancel",
  "cancel_now",
  "renew",
  "extend",
  "expire",
  "change_cycle",
  "note",
  "auto_renew_on",
  "auto_renew_off",
] as const;


export const adminSubscriptionAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(ACTIONS),
        days: z.number().int().min(1).max(3650).optional(),
        cycle: z.enum(CYCLES as [string, ...string[]]).optional(),
        note: z.string().max(1000).optional(),

      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await storeIdOf(context.supabase, context.userId);
    if (!storeId) throw new Error("Store not found");
    const { data: sub } = await context.supabase
      .from("store_subscriptions")
      .select("id,store_id,order_id,current_period_end,next_billing_date,expires_at")
      .eq("id", data.id)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!sub) throw new Error("Subscription not found");
    const s = sub as any;

    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const engine = await import("@/lib/subscriptions.server");

    switch (data.action) {
      case "activate":
        if (s.order_id) await engine.activateSubscriptionForOrder(sb as any, s.order_id);
        break;
      case "suspend":
        await sb.from("store_subscriptions").update({ status: "suspended" }).eq("id", s.id);
        break;
      case "resume":
        await sb
          .from("store_subscriptions")
          .update({ status: "active", cancel_at_period_end: false, cancelled_at: null })
          .eq("id", s.id);
        break;
      case "cancel":
        await engine.cancelSubscription(sb as any, s.id, { actor: "owner", reason: data.note });
        break;
      case "cancel_now":
        await engine.cancelSubscription(sb as any, s.id, { immediate: true, actor: "owner", reason: data.note });
        break;
      case "renew":
        await engine.applyRenewal(sb as any, s.id);
        break;
      case "extend": {
        const base = s.current_period_end ? new Date(s.current_period_end) : new Date();
        const from = base.getTime() > Date.now() ? base : new Date();
        const end = new Date(from.getTime() + (data.days ?? 30) * 86400000).toISOString();
        await sb
          .from("store_subscriptions")
          .update({ current_period_end: end, next_billing_date: end, expires_at: end, status: "active" })
          .eq("id", s.id);
        break;
      }
      case "expire":
        await sb
          .from("store_subscriptions")
          .update({ status: "expired", expires_at: new Date().toISOString(), auto_renew: false })
          .eq("id", s.id);
        break;
      case "change_cycle": {
        if (data.cycle) {
          const { nextBillingDate } = await import("@/lib/subscriptions");
          const end = nextBillingDate(new Date(), data.cycle as any, Number((s as any).custom_cycle_days ?? 30));
          await sb
            .from("store_subscriptions")
            .update({
              billing_cycle: data.cycle,
              current_period_start: new Date().toISOString(),
              current_period_end: end,
              next_billing_date: end,
            })
            .eq("id", s.id);
        }

        break;
      }
      case "auto_renew_on":

        await sb.from("store_subscriptions").update({ auto_renew: true }).eq("id", s.id);
        break;
      case "auto_renew_off":
        await sb.from("store_subscriptions").update({ auto_renew: false }).eq("id", s.id);
        break;
      case "note":
        await sb.from("store_subscriptions").update({ admin_note: data.note ?? null }).eq("id", s.id);
        break;
    }
    if (data.action !== "note") {
      await sb.from("store_subscription_events").insert({
        store_id: storeId,
        subscription_id: s.id,
        event_type: data.action,
        actor: "owner",
        message: data.note ?? null,
      });
    }
    return { ok: true };
  });

export const markSubscriptionInvoicePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ invoiceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdOf(context.supabase, context.userId);
    if (!storeId) throw new Error("Store not found");
    const { data: inv } = await context.supabase
      .from("store_subscription_invoices")
      .select("id,subscription_id,is_renewal")
      .eq("id", data.invoiceId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!inv) throw new Error("Invoice not found");
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const engine = await import("@/lib/subscriptions.server");
    if ((inv as any).is_renewal) {
      await engine.applyRenewal(sb as any, (inv as any).subscription_id, (inv as any).id);
    } else {
      await sb
        .from("store_subscription_invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", (inv as any).id);
      const { data: sub } = await sb
        .from("store_subscriptions")
        .select("order_id")
        .eq("id", (inv as any).subscription_id)
        .maybeSingle();
      if ((sub as any)?.order_id) await engine.activateSubscriptionForOrder(sb as any, (sub as any).order_id);
    }
    return { ok: true };
  });


/** Detail lookup keyed by the order id (Orders → Subscription tab controller). */
export const getAdminSubscriptionByOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdOf(context.supabase, context.userId);
    if (!storeId) return null;
    const { data: sub } = await context.supabase
      .from("store_subscriptions")
      .select("*")
      .eq("order_id", data.orderId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!sub) return null;
    const [{ data: invoices }, { data: events }] = await Promise.all([
      context.supabase
        .from("store_subscription_invoices")
        .select("*")
        .eq("subscription_id", (sub as any).id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("store_subscription_events")
        .select("*")
        .eq("subscription_id", (sub as any).id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return { subscription: sub as any, invoices: (invoices ?? []) as any[], events: (events ?? []) as any[] };
  });
