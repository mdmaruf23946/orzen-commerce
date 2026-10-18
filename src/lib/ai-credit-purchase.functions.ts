// Merchant-side AI credit purchase (separate from subscription checkout).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { canBuyAiCredits } from "./ai-credit-eligibility";

const TXN_RE = /^[A-Za-z0-9]{6,32}$/;
const BD_PHONE = /^(?:\+?88)?01[3-9]\d{8}$/;

async function loadContext(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const adm: any = supabaseAdmin;
  const { data: store } = await adm.from("stores")
    .select("id,name,owner_user_id,expires_at,package_id,subscription_packages(name,is_trial,features)")
    .eq("owner_user_id", userId).maybeSingle();
  if (!store) throw new Error("Store not found");
  const pkg = store.subscription_packages ?? null;
  const elig = canBuyAiCredits({ pkg, expiresAt: store.expires_at });
  return { adm, store, pkg, elig };
}

async function loadBundle(adm: any, id: string) {
  const { data: b } = await adm.from("ai_credit_bundles").select("id,name,credits,price_bdt")
    .eq("id", id).eq("is_active", true).maybeSingle();
  if (!b) throw new Error("এই credit pack আর পাওয়া যাচ্ছে না");
  return { id: b.id as string, name: b.name as string, credits: Number(b.credits), price: Number(b.price_bdt) };
}

export const getMyAiCredits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { adm, store, pkg, elig } = await loadContext(context.userId);
    const now = new Date();
    const dayStart = new Date(now.getTime() + 6 * 3600e3); dayStart.setUTCHours(0, 0, 0, 0);
    const dayIso = new Date(dayStart.getTime() - 6 * 3600e3).toISOString();
    const monStart = new Date(dayStart); monStart.setUTCDate(1);
    const monIso = new Date(monStart.getTime() - 6 * 3600e3).toISOString();
    const [c, b, w, l, u] = await Promise.all([
      adm.from("store_ai_credits").select("balance,lifetime_used").eq("store_id", store.id).maybeSingle(),
      adm.from("ai_credit_bundles").select("id,name,credits,price_bdt").eq("is_active", true).order("sort_order").order("credits"),
      adm.from("merchant_wallets").select("balance").eq("user_id", context.userId).maybeSingle(),
      adm.from("ai_credit_ledger").select("delta,kind,note,created_at").eq("store_id", store.id).order("created_at", { ascending: false }).limit(20),
      adm.from("ai_credit_ledger").select("delta,created_at").eq("store_id", store.id).lt("delta", 0).gte("created_at", monIso).limit(20000),
    ]);
    let usedToday = 0, usedMonth = 0;
    for (const r of (u.data ?? []) as any[]) { const d = -Number(r.delta); usedMonth += d; if (String(r.created_at) >= dayIso) usedToday += d; }
    return {
      planName: (pkg?.name ?? null) as string | null,
      eligible: elig.ok,
      reason: elig.reason ?? null,
      balance: Number(c.data?.balance ?? 0),
      used: Number(c.data?.lifetime_used ?? 0),
      usedToday: Math.round(usedToday * 100) / 100,
      usedMonth: Math.round(usedMonth * 100) / 100,
      walletBalance: Number(w.data?.balance ?? 0),
      packs: ((b.data ?? []) as any[]).map((x) => ({ id: x.id as string, name: x.name as string, credits: Number(x.credits), price: Number(x.price_bdt) })),
      history: ((l.data ?? []) as any[]).map((x) => ({ delta: Number(x.delta), kind: String(x.kind), note: (x.note ?? null) as string | null, at: String(x.created_at) })),
    };
  });

export const buyAiCreditsWithWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bundleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { adm, store, elig } = await loadContext(context.userId);
    if (!elig.ok) throw new Error("আপনার plan-এ AI নেই, তাই credit কেনা যাবে না");
    const bundle = await loadBundle(adm, data.bundleId);
    const { debitWallet, creditWallet } = await import("./wallet.server");
    const ref = `AICR-${store.id.slice(0, 8)}-${Date.now()}`;
    const res = await debitWallet(adm, {
      userId: context.userId, amount: bundle.price, type: "adjustment", reference: ref,
      note: `AI credits: ${bundle.credits} (${bundle.name})`, storeId: store.id,
    });
    if (!res?.ok) throw new Error(res?.error === "insufficient_balance" || !res?.error ? "Ad Fund-এ যথেষ্ট টাকা নেই" : res.error);
    const { data: bal, error } = await adm.rpc("grant_ai_credits", {
      _store: store.id, _credits: bundle.credits, _kind: "purchase_wallet", _note: `${bundle.name} via Ad Fund (${ref})`,
    });
    if (error) {
      await creditWallet(adm, { userId: context.userId, amount: bundle.price, type: "refund", reference: `${ref}-R`, note: "AI credit purchase failed — refunded", storeId: store.id }).catch(() => null);
      throw new Error("Credit যোগ করা যায়নি, টাকা ফেরত দেওয়া হয়েছে");
    }
    return { ok: true, balance: Number(bal), walletBalance: Number(res.balance ?? 0) };
  });

export const submitAiCreditPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    bundleId: z.string().uuid(),
    method: z.enum(["bkash", "nagad", "rocket"]),
    txn_id: z.string().trim().regex(TXN_RE, "Transaction ID 6–32 অক্ষর/সংখ্যা"),
    sender_number: z.string().trim().regex(BD_PHONE, "সঠিক মোবাইল নম্বর দিন"),
    customer_email: z.string().trim().email().max(255),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { adm, store, elig } = await loadContext(context.userId);
    if (!elig.ok) throw new Error("আপনার plan-এ AI নেই, তাই credit কেনা যাবে না");
    const bundle = await loadBundle(adm, data.bundleId);
    const { data: pay, error } = await adm.from("payments").insert({
      store_id: store.id, package_id: null, purpose: "ai_credits", amount: bundle.price,
      method: data.method, txn_id: data.txn_id, sender_number: data.sender_number,
      customer_email: data.customer_email, status: "pending",
      ai_credit_bundle_id: bundle.id, ai_credits_extra: bundle.credits, ai_credits_price: bundle.price,
      notes: `AI credits: ${bundle.credits} (${bundle.name}). Awaiting verification.`,
    }).select("id").single();
    if (error) {
      if (error.code === "23505") throw new Error("এই Transaction ID আগেই জমা দেওয়া হয়েছে");
      throw new Error(error.message);
    }
    return { ok: true, paymentId: pay.id as string };
  });
