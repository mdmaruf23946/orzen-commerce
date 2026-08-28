// Merchant Wallet — client-callable server functions.
import { createServerFn } from "@tanstack/react-start";
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

    const origin = data.return_origin.replace(/\/$/, "");
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
