// Client-callable server functions for the ORZEN Subscription
// Payment Gateway. Owner-only unless noted otherwise.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CYCLE_MONTHS, type CycleKey } from "@/lib/billing.functions";
import { listProviderMeta } from "./providers/registry";

async function assertOwner(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const cycleSchema = z.enum(["monthly", "3m", "6m", "yearly"]);

// -------- Provider management (owner) --------

export const listSubscriptionProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("subscription_payment_providers")
      .select("*")
      .order("id");
    const meta = listProviderMeta();
    return (data ?? []).map((row: any) => {
      const m = meta.find((x) => x.id === row.id);
      const creds = (row.credentials ?? {}) as Record<string, unknown>;
      // Mask credential values, only expose which keys are set.
      const has_credentials = Object.keys(creds).some((k) => {
        const v = creds[k];
        return typeof v === "string" ? v.length > 0 : !!v;
      });
      return {
        ...row,
        credentials: undefined,
        has_credentials,
        credential_keys_set: Object.keys(creds).filter((k) => {
          const v = creds[k];
          return typeof v === "string" ? v.length > 0 : !!v;
        }),
        meta: m ?? null,
      };
    });
  });

export const saveSubscriptionProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().min(1),
        credentials: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
        sandbox: z.boolean().optional(),
        enabled: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = {};
    if (data.credentials !== undefined) {
      // Merge with existing so a partial update doesn't wipe other fields.
      const { data: existing } = await supabaseAdmin
        .from("subscription_payment_providers")
        .select("credentials")
        .eq("id", data.id)
        .maybeSingle();
      patch.credentials = { ...((existing as any)?.credentials ?? {}), ...data.credentials };
    }
    if (data.sandbox !== undefined) patch.sandbox = data.sandbox;
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    const { error } = await supabaseAdmin
      .from("subscription_payment_providers")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setActiveSubscriptionProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Clear existing active flag first (unique partial index prevents two actives).
    await supabaseAdmin
      .from("subscription_payment_providers")
      .update({ is_active: false })
      .eq("is_active", true);
    const { error } = await supabaseAdmin
      .from("subscription_payment_providers")
      .update({ is_active: true, enabled: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testSubscriptionProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { loadProvider } = await import("./pay.server");
    const p = await loadProvider(data.id);
    const result = await p.adapter.testConnection(p.config);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("subscription_payment_providers")
      .update({
        status: result.ok ? "connected" : "error",
        status_message: result.message,
        latency_ms: result.latency_ms,
        last_tested_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return result;
  });

// -------- Public: get the currently-active provider meta --------

export const getActiveSubscriptionProviderPublic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { loadActiveProvider } = await import("./pay.server");
    const p = await loadActiveProvider();
    if (!p) return null;
    return {
      id: p.id,
      label: p.label,
      sandbox: p.sandbox,
      methods: p.adapter.meta.methods,
    };
  });

// -------- Coupons (owner) --------

export const listSubscriptionCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("subscription_coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertSubscriptionCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        code: z.string().min(2).max(40),
        type: z.enum(["percent", "fixed"]),
        value: z.number().min(0),
        min_amount: z.number().min(0).default(0),
        applies_to_packages: z.array(z.string().uuid()).default([]),
        applies_to_cycles: z.array(cycleSchema).default([]),
        usage_limit: z.number().int().min(0).nullable().optional(),
        starts_at: z.string().nullable().optional(),
        expires_at: z.string().nullable().optional(),
        active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row: any = {
      code: data.code.trim().toUpperCase(),
      type: data.type,
      value: data.value,
      min_amount: data.min_amount,
      applies_to_packages: data.applies_to_packages,
      applies_to_cycles: data.applies_to_cycles,
      usage_limit: data.usage_limit ?? null,
      starts_at: data.starts_at ?? null,
      expires_at: data.expires_at ?? null,
      active: data.active,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("subscription_coupons").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("subscription_coupons")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (ins as any).id };
  });

export const deleteSubscriptionCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("subscription_coupons").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Dashboard stats + transactions (owner) --------

export const subscriptionPaymentsStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [totalRes, paidRes, failedRes, pendingRes, monthRes, activeProv] = await Promise.all([
      supabaseAdmin.from("subscription_invoices").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("subscription_invoices").select("total", { count: "exact" }).eq("status", "paid"),
      supabaseAdmin.from("subscription_invoices").select("id", { count: "exact", head: true }).eq("status", "failed"),
      supabaseAdmin.from("subscription_invoices").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin
        .from("subscription_invoices")
        .select("total")
        .eq("status", "paid")
        .gte("paid_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      supabaseAdmin
        .from("subscription_payment_providers")
        .select("id,label,sandbox,enabled,status")
        .eq("is_active", true)
        .maybeSingle(),
    ]);
    const revenue = (paidRes.data ?? []).reduce((a: number, b: any) => a + Number(b.total ?? 0), 0);
    const monthly = (monthRes.data ?? []).reduce((a: number, b: any) => a + Number(b.total ?? 0), 0);
    return {
      total_payments: totalRes.count ?? 0,
      successful: paidRes.count ?? 0,
      failed: failedRes.count ?? 0,
      pending: pendingRes.count ?? 0,
      total_revenue: revenue,
      monthly_revenue: monthly,
      active_provider: (activeProv.data as any) ?? null,
    };
  });

export const listSubscriptionPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("subscription_invoices")
      .select("*, subscription_transactions(provider_id, method, status, sandbox, created_at)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// -------- Checkout initiation (any authenticated store owner) --------

async function generateInvoiceNo(supabaseAdmin: any): Promise<string> {
  const prefix = `SUB-${new Date().toISOString().slice(0, 7).replace("-", "")}`;
  const { data } = await supabaseAdmin
    .from("subscription_invoices")
    .select("invoice_no")
    .like("invoice_no", `${prefix}-%`)
    .order("invoice_no", { ascending: false })
    .limit(1);
  const last = (data?.[0] as any)?.invoice_no as string | undefined;
  const seq = last ? Number(last.slice(prefix.length + 1)) + 1 : 1;
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

export const initiateSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        package_id: z.string().uuid(),
        cycle: cycleSchema,
        coupon_code: z.string().trim().min(1).max(40).optional().nullable(),
        customer_name: z.string().min(1).max(120),
        customer_email: z.string().email().max(200),
        customer_phone: z.string().max(20).optional(),
        return_origin: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadActiveProvider } = await import("./pay.server");

    const provider = await loadActiveProvider();
    if (!provider) throw new Error("No active payment provider is configured");

    const { data: store } = await supabase
      .from("stores")
      .select("id, name")
      .eq("owner_user_id", userId)
      .maybeSingle();

    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from("subscription_packages")
      .select("id, name, price, is_trial")
      .eq("id", data.package_id)
      .maybeSingle();
    if (pkgErr) throw new Error(pkgErr.message);
    if (!pkg || (pkg as any).is_trial) throw new Error("Plan not available for purchase");

    const { data: settings } = await (supabaseAdmin as any).rpc("get_billing_discounts");
    const s = {
      discount_3m: Number(settings?.discount_3m ?? 5),
      discount_6m: Number(settings?.discount_6m ?? 10),
      discount_yearly: Number(settings?.discount_yearly ?? 20),
    };
    const months = CYCLE_MONTHS[data.cycle as CycleKey];
    const base = Number((pkg as any).price) * months;
    const cyclePct = data.cycle === "3m" ? s.discount_3m : data.cycle === "6m" ? s.discount_6m : data.cycle === "yearly" ? s.discount_yearly : 0;
    const afterCycle = Math.round(base * (1 - cyclePct / 100));

    let couponId: string | null = null;
    let couponCode: string | null = null;
    let couponDiscount = 0;
    if (data.coupon_code) {
      const { data: v } = await (supabaseAdmin as any).rpc("validate_subscription_coupon", {
        _code: data.coupon_code,
        _package_id: data.package_id,
        _cycle: data.cycle,
        _amount: afterCycle,
      });
      if (v?.ok) {
        couponId = v.couponId;
        couponCode = v.code;
        couponDiscount = Number(v.discount ?? 0);
      } else {
        throw new Error(v?.error ?? "Invalid coupon");
      }
    }

    const total = Math.max(0, afterCycle - couponDiscount);
    const invoiceNo = await generateInvoiceNo(supabaseAdmin);

    const { data: inv, error: invErr } = await supabaseAdmin
      .from("subscription_invoices")
      .insert({
        invoice_no: invoiceNo,
        store_id: (store as any)?.id ?? null,
        user_id: userId,
        package_id: data.package_id,
        billing_cycle: data.cycle,
        amount: base,
        discount: (base - afterCycle) + couponDiscount,
        coupon_id: couponId,
        total,
        currency: "BDT",
        status: "pending",
      })
      .select("id, invoice_no")
      .single();
    if (invErr) throw new Error(invErr.message);

    const origin = data.return_origin.replace(/\/$/, "");
    const returnUrl = `${origin}/admin/billing/return?invoice=${invoiceNo}`;
    const cancelUrl = `${origin}/admin/billing?cancelled=1&invoice=${invoiceNo}`;
    const webhookUrl = `${origin}/api/public/subscription-pay/webhook/${provider.id}`;

    const checkout = await provider.adapter.createCheckout(provider.config, {
      invoiceId: (inv as any).id,
      invoiceNo,
      amount: total,
      currency: "BDT",
      customerName: data.customer_name,
      customerEmail: data.customer_email,
      customerPhone: data.customer_phone,
      returnUrl,
      cancelUrl,
      webhookUrl,
      packageLabel: `${(pkg as any).name} (${data.cycle})`,
    });

    await supabaseAdmin.from("subscription_transactions").insert({
      invoice_id: (inv as any).id,
      provider_id: provider.id,
      provider_ref: checkout.provider_ref,
      amount: total,
      status: "initiated",
      sandbox: provider.sandbox,
      raw: (checkout.raw as any) ?? null,
    });

    return {
      invoice_id: (inv as any).id,
      invoice_no: invoiceNo,
      redirect_url: checkout.redirect_url,
      total,
    };
  });

// -------- Verify + activate (called from return URL or webhook) --------

export const verifyAndActivateSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        invoice_no: z.string().min(1),
        provider_payload: z.record(z.string(), z.any()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadProvider } = await import("./pay.server");

    const { data: inv } = await supabaseAdmin
      .from("subscription_invoices")
      .select("*")
      .eq("invoice_no", data.invoice_no)
      .maybeSingle();
    if (!inv) throw new Error("Invoice not found");
    if ((inv as any).user_id !== userId) {
      // Owner may still verify — check role.
      await assertOwner(context.supabase, userId);
    }

    if ((inv as any).status === "paid") {
      return { ok: true, status: "paid", already: true, invoice_no: data.invoice_no };
    }

    const { data: tx } = await supabaseAdmin
      .from("subscription_transactions")
      .select("*")
      .eq("invoice_id", (inv as any).id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!tx) throw new Error("No transaction found for this invoice");

    const provider = await loadProvider((tx as any).provider_id);
    const result = await provider.adapter.verifyPayment(provider.config, {
      provider_ref: (tx as any).provider_ref,
      raw: data.provider_payload ?? {},
    });

    await supabaseAdmin
      .from("subscription_transactions")
      .update({
        status: result.status === "paid" ? "success" : result.status === "failed" ? "failed" : "pending",
        method: result.method ?? null,
        raw: (result.raw as any) ?? (tx as any).raw,
        verified_at: new Date().toISOString(),
      })
      .eq("id", (tx as any).id);

    if (result.status === "paid" && (inv as any).purpose === "wallet_topup") {
      // Wallet top-up: credit the balance (idempotent) — no plan activation.
      const { creditTopupInvoice } = await import("@/lib/wallet.server");
      await creditTopupInvoice(supabaseAdmin as any, inv);
      await supabaseAdmin
        .from("subscription_invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", (inv as any).id);
      return { ok: true, status: "paid", purpose: "wallet_topup", invoice_no: data.invoice_no };
    }

    if (result.status !== "paid") {
      if (result.status === "failed") {
        await supabaseAdmin
          .from("subscription_invoices")
          .update({ status: "failed" })
          .eq("id", (inv as any).id);
      }
      return { ok: false, status: result.status, invoice_no: data.invoice_no };
    }

    // Activate subscription
    const { data: pkg } = await supabaseAdmin
      .from("subscription_packages")
      .select("id, name, duration_days")
      .eq("id", (inv as any).package_id)
      .maybeSingle();
    const months = CYCLE_MONTHS[(inv as any).billing_cycle as CycleKey];
    const now = new Date();
    const expires = new Date(now.getTime());
    expires.setMonth(expires.getMonth() + months);

    if ((inv as any).store_id) {
      await supabaseAdmin
        .from("stores")
        .update({
          package_id: (pkg as any)?.id ?? (inv as any).package_id,
          subscription_status: "active",
          last_renewed_at: now.toISOString(),
          expires_at: expires.toISOString(),
          trial_ends_at: null,
        })
        .eq("id", (inv as any).store_id);
    }

    // Record coupon redemption
    if ((inv as any).coupon_id) {
      await supabaseAdmin.from("subscription_coupon_redemptions").insert({
        coupon_id: (inv as any).coupon_id,
        invoice_id: (inv as any).id,
        user_id: (inv as any).user_id,
        amount_off: Number((inv as any).discount ?? 0),
      });
      const { data: cur } = await supabaseAdmin
        .from("subscription_coupons")
        .select("used_count")
        .eq("id", (inv as any).coupon_id)
        .maybeSingle();
      await supabaseAdmin
        .from("subscription_coupons")
        .update({ used_count: Number((cur as any)?.used_count ?? 0) + 1 })
        .eq("id", (inv as any).coupon_id);
    }

    // Generate + store invoice HTML, email receipt
    let pdfPath: string | null = null;
    try {
      const { generateAndStoreInvoice, signedInvoiceUrl } = await import("./invoice.server");
      const { sendSubscriptionEmail, receiptEmailHtml } = await import("./email.server");

      const { data: userRow } = await supabaseAdmin.auth.admin.getUserById((inv as any).user_id);
      const email = userRow?.user?.email ?? "";
      const name = (userRow?.user?.user_metadata as any)?.full_name ?? email;
      const { data: storeRow } = (inv as any).store_id
        ? await supabaseAdmin.from("stores").select("name").eq("id", (inv as any).store_id).maybeSingle()
        : { data: null };

      pdfPath = await generateAndStoreInvoice({
        invoice_no: (inv as any).invoice_no,
        issued_at: (inv as any).issued_at,
        customer_name: name,
        customer_email: email,
        store_name: (storeRow as any)?.name ?? null,
        package_name: (pkg as any)?.name ?? "Subscription",
        billing_cycle: (inv as any).billing_cycle,
        amount: Number((inv as any).amount),
        discount: Number((inv as any).discount ?? 0),
        tax: Number((inv as any).tax ?? 0),
        total: Number((inv as any).total),
        currency: (inv as any).currency,
        coupon_code: null,
        provider_label: provider.label,
        method: result.method ?? null,
      });

      const signed = pdfPath ? await signedInvoiceUrl(pdfPath, 7 * 24 * 3600) : null;

      if (email) {
        await sendSubscriptionEmail({
          to: email,
          subject: `Payment received — ${(inv as any).invoice_no}`,
          html: receiptEmailHtml({
            customerName: name,
            invoiceNo: (inv as any).invoice_no,
            packageName: (pkg as any)?.name ?? "Subscription",
            cycle: (inv as any).billing_cycle,
            total: Number((inv as any).total),
            currency: (inv as any).currency,
            invoiceUrl: signed,
          }),
        });
      }
    } catch (e) {
      // Non-fatal: activation stands even if invoice/email fails.
      console.error("[subscription-pay] invoice/email step failed", e);
    }

    try {
      const { notifySubscription } = await import("@/lib/platform-notify.server");
      const { data: u } = await supabaseAdmin.auth.admin.getUserById((inv as any).user_id);
      await notifySubscription({
        email: u?.user?.email ?? null,
        ownerName: ((u?.user?.user_metadata as any)?.full_name as string) ?? null,
        planName: (pkg as any)?.name ?? "Subscription",
        amount: Number((inv as any).total),
        expiresAt: expires.toISOString(),
        invoiceNo: (inv as any).invoice_no,
      });
    } catch (e) {
      console.error("[subscription-pay] notification email failed", e);
    }

    await supabaseAdmin
      .from("subscription_invoices")
      .update({ status: "paid", paid_at: now.toISOString(), pdf_path: pdfPath })
      .eq("id", (inv as any).id);

    return { ok: true, status: "paid", invoice_no: data.invoice_no };
  });

// -------- Signed invoice URL (owner OR invoice owner) --------

export const getSubscriptionInvoiceUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ invoice_no: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("subscription_invoices")
      .select("user_id, pdf_path")
      .eq("invoice_no", data.invoice_no)
      .maybeSingle();
    if (!inv) throw new Error("Not found");
    if ((inv as any).user_id !== context.userId) {
      await assertOwner(context.supabase, context.userId);
    }
    if (!(inv as any).pdf_path) return { url: null };
    const { signedInvoiceUrl } = await import("./invoice.server");
    const url = await signedInvoiceUrl((inv as any).pdf_path, 3600);
    return { url };
  });
