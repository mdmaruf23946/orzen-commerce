// Merchant Wallet — client-callable server functions.
import { createServerFn } from "@tanstack/react-start";
import { safeReturnOrigin } from "@/lib/safe-return-origin.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const cycleSchema = z.enum(["monthly", "3m", "6m", "yearly"]);

export const getMyWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();
    const { admin, ensureWallet } = await import("./wallet.server");
    const sb = await admin();
    const wallet = await ensureWallet(sb, userId, (store as any)?.id ?? null);
    return {
      id: (wallet as any).id as string,
      balance: Number((wallet as any).balance ?? 0),
      currency: ((wallet as any).currency ?? "BDT") as string,
      auto_renew: !!(wallet as any).auto_renew,
      auto_renew_cycle: ((wallet as any).auto_renew_cycle ?? "monthly") as string,
      store_id: ((wallet as any).store_id ?? null) as string | null,
    };
  });

export const listWalletTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("wallet_transactions")
      .select("id, type, amount, balance_after, status, reference, note, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const setWalletAutoRenew = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ auto_renew: z.boolean(), auto_renew_cycle: cycleSchema.optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();
    const { admin, ensureWallet } = await import("./wallet.server");
    const sb = await admin();
    const wallet = await ensureWallet(sb, userId, (store as any)?.id ?? null);
    const patch: Record<string, unknown> = { auto_renew: data.auto_renew };
    if (data.auto_renew_cycle) patch.auto_renew_cycle = data.auto_renew_cycle;
    const { error } = await sb.from("merchant_wallets").update(patch).eq("id", (wallet as any).id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Start a top-up through the SAME subscription payment gateway.
export const initiateWalletTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        amount: z.number().min(50).max(1_000_000),
        customer_name: z.string().min(1).max(120),
        customer_email: z.string().email().max(200),
        customer_phone: z.string().max(20).optional(),
        return_origin: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const amount = Math.round(data.amount);

    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();

    const { admin, ensureWallet, nextInvoiceNo } = await import("./wallet.server");
    const { loadActiveProvider } = await import("./subscription-pay/pay.server");
    const sb = await admin();

    const provider = await loadActiveProvider();
    if (!provider) throw new Error("No active payment provider is configured");

    await ensureWallet(sb, userId, (store as any)?.id ?? null);

    const invoiceNo = await nextInvoiceNo(sb);
    const { data: inv, error: invErr } = await sb
      .from("subscription_invoices")
      .insert({
        invoice_no: invoiceNo,
        store_id: (store as any)?.id ?? null,
        user_id: userId,
        package_id: null,
        billing_cycle: "monthly",
        amount,
        discount: 0,
        total: amount,
        currency: "BDT",
        status: "pending",
        purpose: "wallet_topup",
      })
      .select("id, invoice_no")
      .single();
    if (invErr) throw new Error(invErr.message);

    const origin = safeReturnOrigin(data.return_origin);
    const checkout = await provider.adapter.createCheckout(provider.config, {
      invoiceId: (inv as any).id,
      invoiceNo,
      amount,
      currency: "BDT",
      customerName: data.customer_name,
      customerEmail: data.customer_email,
      customerPhone: data.customer_phone,
      returnUrl: `${origin}/admin/billing/return?invoice=${invoiceNo}`,
      cancelUrl: `${origin}/admin/billing?cancelled=1&invoice=${invoiceNo}`,
      webhookUrl: `${origin}/api/public/subscription-pay/webhook/${provider.id}`,
      packageLabel: `Wallet top-up (৳${amount})`,
    });

    await sb.from("subscription_transactions").insert({
      invoice_id: (inv as any).id,
      provider_id: provider.id,
      provider_ref: checkout.provider_ref,
      amount,
      status: "initiated",
      sandbox: provider.sandbox,
      raw: (checkout.raw as any) ?? null,
    });

    return { invoice_no: invoiceNo, redirect_url: checkout.redirect_url, total: amount };
  });

// Pay for / renew a plan straight from the wallet balance.
export const payPlanWithWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ package_id: z.string().uuid(), cycle: cycleSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();

    const { admin, ensureWallet, payPlanFromWallet } = await import("./wallet.server");
    const sb = await admin();
    await ensureWallet(sb, userId, (store as any)?.id ?? null);

    const res = await payPlanFromWallet(sb, {
      userId,
      storeId: (store as any)?.id ?? null,
      packageId: data.package_id,
      cycle: data.cycle,
      kind: "plan_payment",
    });
    return res;
  });

// Which top-up options are available: the online gateway (if any provider is
// active) and the manual methods configured by the platform owner.
export const getWalletTopupOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prov } = await (supabaseAdmin.from("subscription_payment_providers") as any)
      .select("id")
      .eq("is_active", true)
      .eq("enabled", true)
      .maybeSingle();
    const { data } = await (supabaseAdmin.from("platform_payment_settings" as any) as any)
      .select("bkash,nagad,rocket")
      .eq("id", "global")
      .maybeSingle();
    const pick = (v: any) => ({
      enabled: !!v?.enabled,
      number: v?.number ?? null,
      instructions: v?.instructions ?? null,
      merchant_name: v?.merchant_name ?? null,
    });
    return {
      gateway: prov ? { id: (prov as any).id as string } : null,
      manual: {
        bkash: pick(data?.bkash),
        nagad: pick(data?.nagad),
        rocket: pick(data?.rocket),
      },
    };
  });

// Manual (bKash / Nagad / Rocket) wallet top-up request. Works for every
// merchant account regardless of plan state; funds are credited only after the
// platform owner verifies the payment.
export const submitWalletTopupManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        amount: z.number().min(50).max(1_000_000),
        method: z.enum(["bkash", "nagad", "rocket"]),
        txn_id: z.string().trim().regex(/^[A-Za-z0-9]{6,32}$/, "Transaction ID must be 6–32 letters or digits"),
        sender_number: z.string().trim().regex(/^01[3-9]\d{8}$/, "Enter a valid Bangladesh mobile number"),
        customer_email: z.string().trim().email().max(255),
        customer_note: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const amount = Math.round(data.amount);

    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!store) throw new Error("No store found for your account");

    const { admin, ensureWallet, nextInvoiceNo } = await import("./wallet.server");
    const sb = await admin();
    await ensureWallet(sb, userId, (store as any).id);

    const invoiceNo = await nextInvoiceNo(sb);
    const { error: invErr } = await sb.from("subscription_invoices").insert({
      invoice_no: invoiceNo,
      store_id: (store as any).id,
      user_id: userId,
      package_id: null,
      billing_cycle: "monthly",
      amount,
      discount: 0,
      total: amount,
      currency: "BDT",
      status: "pending",
      purpose: "wallet_topup",
    });
    if (invErr) throw new Error(invErr.message);

    const { data: payment, error } = await sb
      .from("payments")
      .insert({
        store_id: (store as any).id,
        package_id: null,
        purpose: "wallet_topup",
        amount,
        method: data.method,
        txn_id: data.txn_id,
        sender_number: data.sender_number,
        customer_email: data.customer_email,
        customer_note: data.customer_note ?? null,
        status: "pending",
        invoice_no: invoiceNo,
        notes: `Wallet top-up ৳${amount}. Awaiting verification.`,
      })
      .select("id")
      .single();
    if (error) {
      if ((error.message || "").toLowerCase().includes("txn") || (error as any).code === "23505") {
        throw new Error("This transaction ID has already been submitted.");
      }
      throw new Error(error.message);
    }

    await sb
      .from("subscription_notifications")
      .insert({
        store_id: (store as any).id,
        type: "payment_pending",
        meta: { payment_id: (payment as any).id, purpose: "wallet_topup", amount },
      })
      .then(() => null, () => null);

    if (data.customer_email) {
      try {
        const { enqueueEmail, tplWalletTopupSubmitted } = await import("./emails.server");
        const { data: st } = await sb.from("stores").select("name").eq("id", (store as any).id).maybeSingle();
        const tpl = await tplWalletTopupSubmitted({
          ownerName: null,
          storeName: (st as any)?.name ?? null,
          customerEmail: data.customer_email,
          amount,
          method: data.method,
          txnId: data.txn_id,
          invoiceNo,
          submittedAt: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
          walletUrl: "/admin/billing",
        });
        await enqueueEmail({
          to: data.customer_email,
          template: "wallet_topup_submitted",
          subject: tpl.subject,
          html: tpl.html,
          payload: { payment_id: (payment as any).id, amount },
          relatedPaymentId: (payment as any).id,
        });
      } catch (e) {
        console.error("[wallet] submit email failed", (e as Error).message);
      }
    }

    // Push the request to the platform owner's Messenger with Approve/Reject
    // buttons so it can be verified without opening the panel.
    try {
      const { notifyOwnerTopupSubmitted } = await import("./ai-admin/topup-messenger.server");
      await notifyOwnerTopupSubmitted((payment as any).id);
    } catch (e) {
      console.error("[wallet] owner messenger alert failed", (e as Error).message);
    }

    return { ok: true as const, paymentId: (payment as any).id, invoice_no: invoiceNo, amount };
  });
