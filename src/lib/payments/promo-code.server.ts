import { evaluatePromo, type PromoResult } from "./promo-code";

// Loads the coupon with the admin client and evaluates it. Pending (not yet
// verified) payments using the code count toward the usage limit.
export async function validatePromoCode(
  code: string,
  input: { packageId: string; cycle: string; amount: number },
): Promise<PromoResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb: any = supabaseAdmin;
  const clean = code.trim().toUpperCase();
  if (!clean) return { ok: false, error: "প্রোমো কোড লিখুন" };
  const { data: c } = await sb.from("subscription_coupons").select("*").eq("code", clean).maybeSingle();
  if (!c) return { ok: false, error: "প্রোমো কোডটি সঠিক নয়" };
  let pendingUses = 0;
  if (c.usage_limit) {
    const { count } = await sb
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", c.id)
      .eq("status", "pending");
    pendingUses = count ?? 0;
  }
  return evaluatePromo(c, { ...input, pendingUses });
}
