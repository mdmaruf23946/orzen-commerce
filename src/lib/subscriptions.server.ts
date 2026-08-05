// Server-only engine for the Subscription Billing system.
// Isolated from physical / digital / service fulfilment. Route and component
// code must never import this file directly — go through the *.functions.ts
// wrappers.
import {
  DEFAULT_SUBSCRIPTION_SETTINGS,
  billingSummary,
  nextBillingDate,
  normalizeSubscriptionSettings,
  type SubCycle,
  type SubNotificationKind,
  type SubscriptionSettings,
} from "@/lib/subscriptions";

type Sb = any;

export async function admin(): Promise<Sb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function myStoreId(sb: Sb, userId: string): Promise<string | null> {
  const { data } = await sb.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
  return (data as any)?.id ?? null;
}

/**
 * Store-level values a subscription still needs. There is no subscription
 * settings page any more — everything product specific lives on the product,
 * and the few store-wide bits come from the store's own settings.
 */
export async function loadSettings(sb: Sb, storeId: string): Promise<SubscriptionSettings> {
  const [{ data: inv }, { data: store }] = await Promise.all([
    sb.from("store_invoice_settings").select("prefix").eq("store_id", storeId).maybeSingle(),
    sb.from("stores").select("payments_config").eq("id", storeId).maybeSingle(),
  ]);
  const pc = ((store as any)?.payments_config ?? {}) as any;
  return normalizeSubscriptionSettings(storeId, {
    ...DEFAULT_SUBSCRIPTION_SETTINGS,
    invoice_prefix: (inv as any)?.prefix || "SUB",
    cod_enabled: pc?.cod?.enabled !== false,
  });
}

/** Custom cycle length (days) from the product's subscription metadata. */
export function customDaysFromMeta(meta: any): number {
  const cc = meta?.custom_cycle ?? {};
  const n = Number(cc.number ?? 0);
  if (!n) return 30;
  switch (cc.unit) {
    case "days":
      return n;
    case "weeks":
      return n * 7;
    case "years":
      return n * 365;
    default:
      return n * 30;
  }
}

/** Trial length in days — product metadata is the only source of truth. */
export function trialDaysFromMeta(meta: any): number {
  const t = meta?.trial;
  if (t?.enabled && t.duration) {
    const n = Number(t.duration);
    if (t.unit === "weeks") return n * 7;
    if (t.unit === "months") return n * 30;
    return n;
  }
  return 0;
}


export async function logEvent(
  sb: Sb,
  args: { storeId: string; subscriptionId: string; type: string; message?: string; actor?: string; meta?: any },
) {
  await sb.from("store_subscription_events").insert({
    store_id: args.storeId,
    subscription_id: args.subscriptionId,
    event_type: args.type,
    message: args.message ?? null,
    actor: args.actor ?? "system",
    meta: args.meta ?? {},
  });
}

function money(n: number) {
  return `৳${Number(n || 0).toLocaleString()}`;
}

const NOTIFY_COPY: Record<SubNotificationKind, (s: any, extra: any) => { subject: string; body: string }> = {
  activated: (s) => ({
    subject: `Your subscription is active — ${s.plan_name}`,
    body: `<p>Hi ${s.customer_name ?? "there"},</p><p>Your subscription <b>${s.plan_name}</b> (${s.subscription_no}) is now active.</p><p>Next billing date: <b>${s.next_billing_date ? new Date(s.next_billing_date).toLocaleDateString() : "—"}</b></p>`,
  }),
  payment_received: (s, e) => ({
    subject: `Payment received — ${s.plan_name}`,
    body: `<p>We received your payment of <b>${money(e?.amount ?? s.price)}</b> for ${s.plan_name} (${s.subscription_no}).</p>`,
  }),
  upcoming_renewal: (s, e) => ({
    subject: `Your subscription renews soon — ${s.plan_name}`,
    body: `<p>${s.plan_name} (${s.subscription_no}) renews on <b>${s.next_billing_date ? new Date(s.next_billing_date).toLocaleDateString() : "—"}</b> for <b>${money(s.renewal_price ?? s.price)}</b>.</p>${e?.payUrl ? `<p><a href="${e.payUrl}">Renew now</a></p>` : ""}`,
  }),
  expiring: (s, e) => ({
    subject: `Your subscription is expiring — ${s.plan_name}`,
    body: `<p>${s.plan_name} (${s.subscription_no}) expires soon. Renew to keep your access.</p>${e?.payUrl ? `<p><a href="${e.payUrl}">Renew now</a></p>` : ""}`,
  }),
  renewed: (s) => ({
    subject: `Subscription renewed — ${s.plan_name}`,
    body: `<p>${s.plan_name} (${s.subscription_no}) has been renewed. Next billing date: <b>${s.next_billing_date ? new Date(s.next_billing_date).toLocaleDateString() : "—"}</b>.</p>`,
  }),
  payment_failed: (s) => ({
    subject: `Payment failed — ${s.plan_name}`,
    body: `<p>We could not confirm payment for ${s.plan_name} (${s.subscription_no}). Please retry to avoid interruption.</p>`,
  }),
  cancelled: (s) => ({
    subject: `Subscription cancelled — ${s.plan_name}`,
    body: `<p>${s.plan_name} (${s.subscription_no}) has been cancelled.${s.current_period_end ? ` Access remains until ${new Date(s.current_period_end).toLocaleDateString()}.` : ""}</p>`,
  }),
};

/** Records + best-effort sends a subscription notification. */
export async function notify(
  sb: Sb,
  sub: any,
  kind: SubNotificationKind,
  extra: Record<string, any> = {},
) {
  const settings = await loadSettings(sb, sub.store_id);
  const recipient = sub.customer_email ?? null;
  const copy = NOTIFY_COPY[kind](sub, extra);
  const { data: row } = await sb
    .from("store_subscription_notifications")
    .insert({
      store_id: sub.store_id,
      subscription_id: sub.id,
      kind,
      channel: "email",
      recipient,
      payload: { subject: copy.subject, ...extra },
    })
    .select("id")
    .maybeSingle();

  if (!settings.notify_email || !recipient) return;
  try {
    const { enqueueEmail } = await import("@/lib/emails.server");
    await enqueueEmail({
      to: recipient,
      template: `subscription_${kind}`,
      subject: copy.subject,
      html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6">${copy.body}</div>`,
      payload: { subscriptionId: sub.id, kind },
    });
    if (row) {
      await sb
        .from("store_subscription_notifications")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", (row as any).id);
    }
  } catch (e: any) {
    if (row) {
      await sb
        .from("store_subscription_notifications")
        .update({ error: String(e?.message ?? e).slice(0, 400) })
        .eq("id", (row as any).id);
    }
  }
}

export async function createInvoice(
  sb: Sb,
  sub: any,
  args: {
    orderId?: string | null;
    periodStart?: string | null;
    periodEnd?: string | null;
    planAmount: number;
    setupFee?: number;
    taxAmount?: number;
    discount?: number;
    total: number;
    status?: string;
    isRenewal?: boolean;
    dueAt?: string | null;
    paymentMethod?: string | null;
  },
) {
  const settings = await loadSettings(sb, sub.store_id);
  const seq = Date.now().toString().slice(-8);
  const invoiceNo = `${settings.invoice_prefix || "SUB"}-${seq}`;
  const { data, error } = await sb
    .from("store_subscription_invoices")
    .insert({
      store_id: sub.store_id,
      subscription_id: sub.id,
      order_id: args.orderId ?? null,
      invoice_no: invoiceNo,
      period_start: args.periodStart ?? null,
      period_end: args.periodEnd ?? null,
      plan_amount: args.planAmount,
      setup_fee: args.setupFee ?? 0,
      tax_amount: args.taxAmount ?? 0,
      discount_amount: args.discount ?? 0,
      total: args.total,
      currency: sub.currency ?? "BDT",
      status: args.status ?? "open",
      due_at: args.dueAt ?? null,
      is_renewal: !!args.isRenewal,
      payment_method: args.paymentMethod ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as any;
}

/**
 * Creates the subscription record for a freshly placed subscription order.
 * The record starts in `pending` and is activated once payment is confirmed
 * (or immediately when there is nothing to pay / a trial applies).
 */
export async function createSubscriptionForOrder(sb: Sb, orderId: string) {
  const { data: order } = await sb.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) throw new Error("Order not found");
  const o = order as any;

  const { data: existing } = await sb
    .from("store_subscriptions")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existing) return existing as any;

  const { data: items } = await sb
    .from("order_items")
    .select("product_id,name_snapshot,price_snapshot,qty")
    .eq("order_id", orderId);
  const first = (items ?? [])[0] as any;
  if (!first) throw new Error("Order has no items");

  const { data: product } = await sb
    .from("products")
    .select("id,name,price,meta")
    .eq("id", first.product_id)
    .maybeSingle();
  const meta = ((product as any)?.meta ?? {}).subscription ?? {};
  const settings = await loadSettings(sb, o.store_id);
  const fm = (o.fulfillment_meta ?? {}).subscription ?? {};

  // The plan the customer picked at checkout (validated server-side when the
  // order was placed) drives cycle, price and renewal price.
  const { resolveBillingPlans, findPlan, planDays } = await import(
    "@/components/admin/product-form/subscription/subscription-meta"
  );
  const plans = resolveBillingPlans(meta, Number((product as any)?.price ?? first.price_snapshot));
  const plan = findPlan(plans as any, fm.plan_id ?? null);

  const cycle = (plan?.cycle ?? fm.billing_cycle ?? meta.billing_cycle ?? "monthly") as SubCycle;
  const customDays =
    plan?.cycle === "custom" ? (planDays(plan) ?? 30) : customDaysFromMeta(meta);
  const price = Number(first.price_snapshot) * Number(first.qty ?? 1);
  const renewalPrice =
    meta.renewal_price_mode === "different" && meta.renewal_price != null
      ? Number(meta.renewal_price)
      : price;


  const { data: noRow } = await sb.rpc("next_subscription_no", { _store_id: o.store_id } as any);

  const { data: sub, error } = await sb
    .from("store_subscriptions")
    .insert({
      store_id: o.store_id,
      customer_id: o.customer_id ?? null,
      order_id: orderId,
      product_id: first.product_id,
      subscription_no: (noRow as any) ?? `SUB-${Date.now().toString().slice(-8)}`,
      plan_name: (product as any)?.name ?? first.name_snapshot,
      plan_snapshot: {
        badge: plan?.badge ?? meta.badge ?? null,
        plan_type: meta.plan_type ?? null,
        access_items: meta.access_items ?? [],
        benefits: meta.benefits ?? [],
        usage_limits: meta.usage_limits ?? [],
        policies: meta.policies ?? {},
        cycle_label: cycle,
        plan_id: plan?.id ?? null,
        plan_label: plan?.label ?? null,
        // Per-product renewal rules — the renewal engine reads them from here.
        renewal: {
          grace_period_days: Number(meta.renewal?.grace_period_days ?? 3),
          renewal_reminder_days: Number(meta.renewal?.renewal_reminder_days ?? 7),
        },
      },
      billing_cycle: cycle,
      custom_cycle_days: cycle === "custom" ? customDays : null,
      status: "pending",
      price,
      renewal_price: renewalPrice,
      setup_fee: Number(fm.setup_fee ?? meta.setup_fee ?? 0),

      tax_amount: Number(fm.tax_amount ?? 0),
      discount_amount: Number(o.discount_amount ?? 0),
      currency: "BDT",
      customer_name: o.customer_name,
      customer_email: o.email,
      customer_phone: o.phone,
      customer_country: o.country,
      customer_company: o.company,
      customer_vat: fm.vat ?? null,
      customer_notes: o.notes ?? null,
      payment_method: o.payment_method,
      auto_renew: fm.auto_renew ?? settings.auto_renew_default,
      reminders_opt_in: fm.reminders_opt_in ?? true,
      license_qty: Number(first.qty ?? 1),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await logEvent(sb, {
    storeId: o.store_id,
    subscriptionId: (sub as any).id,
    type: "created",
    message: "Subscription created from checkout",
  });

  const summary = billingSummary({
    price: Number(first.price_snapshot),
    qty: Number(first.qty ?? 1),
    setupFee: (sub as any).setup_fee,
    taxPercent: settings.tax_percent,
    discount: Number(o.discount_amount ?? 0),
  });
  await createInvoice(sb, sub, {
    orderId,
    planAmount: summary.plan,
    setupFee: summary.setup,
    taxAmount: summary.tax,
    discount: summary.discount,
    total: summary.total,
    status: summary.total <= 0 ? "paid" : "open",
    paymentMethod: o.payment_method,
  });

  return sub as any;
}

/** Marks a subscription (and its open invoice) active. Idempotent. */
export async function activateSubscriptionForOrder(sb: Sb, orderId: string) {
  let { data: sub } = await sb
    .from("store_subscriptions")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!sub) sub = await createSubscriptionForOrder(sb, orderId);
  const s = sub as any;
  if (["active", "trialing"].includes(s.status)) return s;

  const { data: product } = await sb.from("products").select("meta").eq("id", s.product_id).maybeSingle();
  const meta = ((product as any)?.meta ?? {}).subscription ?? {};
  const trialDays = trialDaysFromMeta(meta);


  const now = new Date();
  const trialEnds = trialDays > 0 ? new Date(now.getTime() + trialDays * 86400000).toISOString() : null;
  const periodStart = now.toISOString();
  const periodEnd = trialEnds ?? nextBillingDate(now, s.billing_cycle, s.custom_cycle_days);

  const { data: updated } = await sb
    .from("store_subscriptions")
    .update({
      status: trialEnds ? "trialing" : "active",
      activated_at: s.activated_at ?? periodStart,
      started_at: s.started_at ?? periodStart,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      next_billing_date: periodEnd,
      trial_ends_at: trialEnds,
      expires_at: periodEnd,
    })
    .eq("id", s.id)
    .select("*")
    .single();

  await sb
    .from("store_subscription_invoices")
    .update({ status: "paid", paid_at: periodStart, period_start: periodStart, period_end: periodEnd })
    .eq("subscription_id", s.id)
    .eq("status", "open")
    .is("is_renewal", false);

  await logEvent(sb, {
    storeId: s.store_id,
    subscriptionId: s.id,
    type: "activated",
    message: trialEnds ? "Trial started" : "Subscription activated",
  });
  await notify(sb, updated ?? s, "activated");
  await notify(sb, updated ?? s, "payment_received", { amount: s.price });
  return (updated ?? s) as any;
}

export async function cancelSubscription(
  sb: Sb,
  subscriptionId: string,
  opts: { immediate?: boolean; actor?: string; reason?: string } = {},
) {
  const { data: sub } = await sb
    .from("store_subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!sub) throw new Error("Subscription not found");
  const s = sub as any;
  const now = new Date().toISOString();
  const patch = opts.immediate
    ? { status: "cancelled", cancelled_at: now, auto_renew: false, cancel_at_period_end: false, expires_at: now }
    : { cancel_at_period_end: true, auto_renew: false, cancelled_at: now };
  const { data: updated } = await sb
    .from("store_subscriptions")
    .update(patch)
    .eq("id", subscriptionId)
    .select("*")
    .single();
  await logEvent(sb, {
    storeId: s.store_id,
    subscriptionId,
    type: "cancelled",
    actor: opts.actor ?? "customer",
    message: opts.reason ?? (opts.immediate ? "Cancelled immediately" : "Cancels at period end"),
  });
  await notify(sb, updated ?? s, "cancelled");
  return updated as any;
}

/** Creates (or reuses) an open renewal invoice and returns its pay token. */
export async function createRenewalInvoice(sb: Sb, subscriptionId: string) {
  const { data: sub } = await sb
    .from("store_subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!sub) throw new Error("Subscription not found");
  const s = sub as any;
  if (s.billing_cycle === "lifetime") throw new Error("Lifetime subscriptions never renew");

  const { data: open } = await sb
    .from("store_subscription_invoices")
    .select("*")
    .eq("subscription_id", subscriptionId)
    .eq("status", "open")
    .eq("is_renewal", true)
    .maybeSingle();
  if (open) return open as any;

  const settings = await loadSettings(sb, s.store_id);
  const amount = Number(s.renewal_price ?? s.price);
  const summary = billingSummary({ price: amount, taxPercent: settings.tax_percent });
  const start = s.current_period_end ?? new Date().toISOString();
  return createInvoice(sb, s, {
    periodStart: start,
    periodEnd: nextBillingDate(start, s.billing_cycle, s.custom_cycle_days),
    planAmount: summary.plan,
    taxAmount: summary.tax,
    total: summary.total,
    status: "open",
    isRenewal: true,
    dueAt: start,
  });
}

/** Applies a paid renewal: extends the period and logs it. */
export async function applyRenewal(sb: Sb, subscriptionId: string, invoiceId?: string) {
  const { data: sub } = await sb
    .from("store_subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!sub) throw new Error("Subscription not found");
  const s = sub as any;
  const start =
    s.current_period_end && new Date(s.current_period_end) > new Date()
      ? s.current_period_end
      : new Date().toISOString();
  const end = nextBillingDate(start, s.billing_cycle, s.custom_cycle_days);
  const { data: updated } = await sb
    .from("store_subscriptions")
    .update({
      status: "active",
      current_period_start: start,
      current_period_end: end,
      next_billing_date: end,
      expires_at: end,
    })
    .eq("id", subscriptionId)
    .select("*")
    .single();
  if (invoiceId) {
    await sb
      .from("store_subscription_invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", invoiceId);
  }
  await logEvent(sb, { storeId: s.store_id, subscriptionId, type: "renewed", message: "Subscription renewed" });
  await notify(sb, updated ?? s, "renewed");
  return updated as any;
}

/**
 * Daily renewal engine: sends reminders, generates renewal invoices,
 * moves lapsed subscriptions into grace and finally expires them.
 */
export async function processRenewals(sb: Sb) {
  const now = new Date();
  const stats = { reminded: 0, invoiced: 0, grace: 0, expired: 0, trialsEnded: 0 };

  const { data: subs } = await sb
    .from("store_subscriptions")
    .select("*")
    .in("status", ["active", "trialing", "past_due", "grace"])
    .limit(1000);

  for (const s of (subs ?? []) as any[]) {
    // Grace + reminder windows come from the product plan snapshot.
    const rules = (s.plan_snapshot ?? {}).renewal ?? {};
    const reminderDays = Number(rules.renewal_reminder_days ?? 7);
    const graceDays = Number(rules.grace_period_days ?? 3);
    if (s.billing_cycle === "lifetime") continue;


    // Trial that has run out becomes a normal billing period.
    if (s.status === "trialing" && s.trial_ends_at && new Date(s.trial_ends_at) <= now) {
      await sb
        .from("store_subscriptions")
        .update({ status: "active", current_period_start: s.trial_ends_at })
        .eq("id", s.id);
      stats.trialsEnded++;
    }

    const due = s.next_billing_date ? new Date(s.next_billing_date) : null;
    if (!due) continue;
    const daysToDue = Math.ceil((due.getTime() - now.getTime()) / 86400000);

    if (daysToDue > 0 && daysToDue <= reminderDays && s.reminders_opt_in) {
      const { data: already } = await sb
        .from("store_subscription_notifications")
        .select("id")
        .eq("subscription_id", s.id)
        .eq("kind", "upcoming_renewal")
        .gte("created_at", new Date(now.getTime() - 5 * 86400000).toISOString())
        .maybeSingle();
      if (!already) {
        const inv = await createRenewalInvoice(sb, s.id).catch(() => null);
        await notify(sb, s, "upcoming_renewal", { payUrl: inv ? `/subscription/pay/${inv.pay_token}` : null });
        stats.reminded++;
        if (inv) stats.invoiced++;
      }
    }

    if (daysToDue <= 0) {
      const graceEnd = new Date(due.getTime() + graceDays * 86400000);
      if (now <= graceEnd) {
        if (s.status !== "grace") {
          await sb.from("store_subscriptions").update({ status: "grace" }).eq("id", s.id);
          await createRenewalInvoice(sb, s.id).catch(() => null);
          await notify(sb, s, "expiring", {});
          await logEvent(sb, { storeId: s.store_id, subscriptionId: s.id, type: "grace", message: "Entered grace period" });
          stats.grace++;
        }
      } else {
        await sb
          .from("store_subscriptions")
          .update({ status: "expired", expires_at: graceEnd.toISOString() })
          .eq("id", s.id);
        await logEvent(sb, { storeId: s.store_id, subscriptionId: s.id, type: "expired", message: "Subscription expired" });
        await notify(sb, s, "payment_failed", {});
        stats.expired++;
      }
    }
  }
  return stats;
}

export const SETTINGS_DEFAULTS = DEFAULT_SUBSCRIPTION_SETTINGS;
