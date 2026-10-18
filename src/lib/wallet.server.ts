// Server-only merchant wallet helpers. Never import from route/component
// modules — go through `wallet.functions.ts`.
import { CYCLE_MONTHS, type CycleKey } from "@/lib/billing.functions";

type Sb = any;

export async function admin(): Promise<Sb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function ensureWallet(sb: Sb, userId: string, storeId: string | null) {
  const { data, error } = await sb.rpc("wallet_ensure", {
    _user_id: userId,
    _store_id: storeId,
  });
  if (error) throw new Error(error.message);
  return data as any;
}

export async function creditWallet(
  sb: Sb,
  args: {
    userId: string;
    amount: number;
    type: "topup" | "refund" | "adjustment";
    invoiceId?: string | null;
    reference?: string | null;
    note?: string | null;
    storeId?: string | null;
  },
) {
  const { data, error } = await sb.rpc("wallet_credit", {
    _user_id: args.userId,
    _amount: args.amount,
    _type: args.type,
    _invoice_id: args.invoiceId ?? null,
    _reference: args.reference ?? null,
    _note: args.note ?? null,
    _store_id: args.storeId ?? null,
  });
  if (error) throw new Error(error.message);
  return data as { ok: boolean; balance?: number; already?: boolean; error?: string };
}

export async function debitWallet(
  sb: Sb,
  args: {
    userId: string;
    amount: number;
    type: "plan_payment" | "auto_renewal" | "adjustment";
    invoiceId?: string | null;
    reference?: string | null;
    note?: string | null;
    storeId?: string | null;
  },
) {
  const { data, error } = await sb.rpc("wallet_debit", {
    _user_id: args.userId,
    _amount: args.amount,
    _type: args.type,
    _invoice_id: args.invoiceId ?? null,
    _reference: args.reference ?? null,
    _note: args.note ?? null,
    _store_id: args.storeId ?? null,
  });
  if (error) throw new Error(error.message);
  return data as { ok: boolean; balance?: number; error?: string };
}

// Credits a verified wallet top-up invoice. Idempotent at the SQL level.
export async function creditTopupInvoice(sb: Sb, inv: any) {
  if (!inv || inv.purpose !== "wallet_topup") return { ok: false, skipped: true };
  return creditWallet(sb, {
    userId: inv.user_id,
    amount: Number(inv.total),
    type: "topup",
    invoiceId: inv.id,
    reference: inv.invoice_no,
    note: "Fund added via payment gateway",
    storeId: inv.store_id ?? null,
  });
}

export async function nextInvoiceNo(sb: Sb): Promise<string> {
  const prefix = `SUB-${new Date().toISOString().slice(0, 7).replace("-", "")}`;
  const { data } = await sb
    .from("subscription_invoices")
    .select("invoice_no")
    .like("invoice_no", `${prefix}-%`)
    .order("invoice_no", { ascending: false })
    .limit(1);
  const last = (data?.[0] as any)?.invoice_no as string | undefined;
  const seq = last ? Number(last.slice(prefix.length + 1)) + 1 : 1;
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

export async function cycleDiscounts(sb: Sb) {
  const { data } = await sb.rpc("get_billing_discounts");
  return {
    discount_3m: Number((data as any)?.discount_3m ?? 5),
    discount_6m: Number((data as any)?.discount_6m ?? 10),
    discount_yearly: Number((data as any)?.discount_yearly ?? 20),
  };
}

export function cycleTotal(
  monthlyPrice: number,
  cycle: CycleKey,
  s: { discount_3m: number; discount_6m: number; discount_yearly: number },
) {
  const months = CYCLE_MONTHS[cycle];
  const base = Number(monthlyPrice) * months;
  const pct = cycle === "3m" ? s.discount_3m : cycle === "6m" ? s.discount_6m : cycle === "yearly" ? s.discount_yearly : 0;
  const total = Math.round(base * (1 - pct / 100));
  return { months, base, total };
}

// Activates/extends a store's plan and writes a paid invoice paid from the
// wallet. Shared by manual "pay from wallet" and auto-renewal.
export async function payPlanFromWallet(
  sb: Sb,
  args: {
    userId: string;
    storeId: string | null;
    packageId: string;
    cycle: CycleKey;
    kind: "plan_payment" | "auto_renewal";
  },
) {
  const { data: pkg } = await sb
    .from("subscription_packages")
    .select("id, name, price, is_trial, is_active")
    .eq("id", args.packageId)
    .maybeSingle();
  if (!pkg || (pkg as any).is_trial) return { ok: false, error: "Plan not available" as const };

  const s = await cycleDiscounts(sb);
  const { months, base, total } = cycleTotal(Number((pkg as any).price), args.cycle, s);
  if (total <= 0) return { ok: false, error: "This plan has no payable amount" as const };

  // Wallet balance check happens atomically in wallet_debit.
  const invoiceNo = await nextInvoiceNo(sb);
  const now = new Date();
  const { data: inv, error: invErr } = await sb
    .from("subscription_invoices")
    .insert({
      invoice_no: invoiceNo,
      store_id: args.storeId,
      user_id: args.userId,
      package_id: args.packageId,
      billing_cycle: args.cycle,
      amount: base,
      discount: base - total,
      total,
      currency: "BDT",
      status: "pending",
      purpose: "plan",
    })
    .select("id, invoice_no")
    .single();
  if (invErr) return { ok: false, error: invErr.message };

  const debit = await debitWallet(sb, {
    userId: args.userId,
    amount: total,
    type: args.kind,
    invoiceId: (inv as any).id,
    reference: invoiceNo,
    note: `${(pkg as any).name} — ${args.cycle}`,
    storeId: args.storeId,
  });

  if (!debit?.ok) {
    await sb.from("subscription_invoices").update({ status: "failed" }).eq("id", (inv as any).id);
    return { ok: false, error: debit?.error ?? "Insufficient balance", balance: debit?.balance ?? 0, required: total };
  }

  // Renewing the SAME plan stacks on the remaining time; switching to a
  // different plan starts the new period from today.
  let start = now;
  if (args.storeId) {
    const { data: st } = await sb.from("stores").select("expires_at, package_id").eq("id", args.storeId).maybeSingle();
    const cur = (st as any)?.expires_at ? new Date((st as any).expires_at) : null;
    const samePlan = (st as any)?.package_id === args.packageId;
    if (samePlan && cur && cur > now) start = cur;
  }
  const expires = new Date(start.getTime());
  expires.setMonth(expires.getMonth() + months);

  if (args.storeId) {
    await sb
      .from("stores")
      .update({
        package_id: args.packageId,
        subscription_status: "active",
        last_renewed_at: now.toISOString(),
        expires_at: expires.toISOString(),
        trial_ends_at: null,
      })
      .eq("id", args.storeId);
    await grantPlanAiCredits(sb, args.storeId, args.packageId, invoiceNo);
  }

  await sb
    .from("subscription_invoices")
    .update({ status: "paid", paid_at: now.toISOString() })
    .eq("id", (inv as any).id);

  return {
    ok: true as const,
    invoice_no: invoiceNo,
    total,
    balance: debit.balance ?? 0,
    expires_at: expires.toISOString(),
  };
}

// Daily job: renew plans from the wallet when auto-renew is on.
export async function processWalletAutoRenewals(sb: Sb) {
  const stats = { checked: 0, renewed: 0, insufficient: 0, skipped: 0 };
  const now = new Date();

  const { data: wallets } = await sb
    .from("merchant_wallets")
    .select("id, user_id, store_id, balance, auto_renew, auto_renew_cycle")
    .eq("auto_renew", true)
    .limit(1000);

  for (const w of (wallets ?? []) as any[]) {
    if (!w.store_id) { stats.skipped++; continue; }
    const { data: store } = await sb
      .from("stores")
      .select("id, package_id, expires_at, subscription_status")
      .eq("id", w.store_id)
      .maybeSingle();
    if (!store) { stats.skipped++; continue; }
    stats.checked++;

    const expires = (store as any).expires_at ? new Date((store as any).expires_at) : null;
    // Renew only when the current period has run out (or ends today).
    if (expires && expires.getTime() - now.getTime() > 12 * 3600 * 1000) { stats.skipped++; continue; }

    const packageId = (store as any).package_id;
    if (!packageId) { stats.skipped++; continue; }

    const { data: pkg } = await sb
      .from("subscription_packages")
      .select("id, name, price, plan_tier, is_trial")
      .eq("id", packageId)
      .maybeSingle();
    if (!pkg || (pkg as any).is_trial || Number((pkg as any).price) <= 0) { stats.skipped++; continue; }

    const cycle = (["monthly", "3m", "6m", "yearly"].includes(w.auto_renew_cycle)
      ? w.auto_renew_cycle
      : "monthly") as CycleKey;

    const res = await payPlanFromWallet(sb, {
      userId: w.user_id,
      storeId: w.store_id,
      packageId,
      cycle,
      kind: "auto_renewal",
    });

    if (res.ok) {
      stats.renewed++;
      await sb.from("subscription_notifications").insert({
        store_id: w.store_id,
        type: "auto_renewed",
        meta: {
          message: `Auto renewal successful — ${(pkg as any).name} (${cycle}). ৳${(res as any).total} deducted from your wallet.`,
          plan: (pkg as any).name,
          cycle,
          amount: (res as any).total,
        },
      }).then(() => null, () => null);
    } else {
      stats.insufficient++;
      const required = (res as any).required ?? 0;
      const balance = (res as any).balance ?? 0;
      await sb.from("subscription_notifications").insert({
        store_id: w.store_id,
        type: "auto_renew_failed",
        meta: {
          message: `Auto renewal failed — wallet balance ৳${balance} is short of the ৳${required} needed for ${(pkg as any).name} (${cycle}). Please add funds to your wallet.`,
          plan: (pkg as any).name,
          cycle,
          required,
          balance,
        },
      }).then(() => null, () => null);
    }
  }

  return stats;
}
