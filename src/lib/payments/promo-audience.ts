// Pure rules for picking promo-email recipients by current plan.
export type PromoAudienceGroup = "free" | "trial" | "paid";

export function classifyStorePlan(s: {
  subscription_status?: string | null;
  package?: { price?: number | null; is_trial?: boolean | null } | null;
}): PromoAudienceGroup {
  if (s.subscription_status === "trialing" || s.package?.is_trial) return "trial";
  if (!s.package || Number(s.package.price ?? 0) <= 0) return "free";
  return "paid";
}

export function fillPromoTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in vars ? vars[k] : m));
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const BN_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
export const bnNum = (n: number | string) => String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

/** Expiry date (Dhaka time) and whole days left for a promo code. */
export function promoValidity(expiresAt: string | null | undefined, now = new Date()) {
  if (!expiresAt) return { date: "", daysLeft: null as number | null, text: "সীমিত সময়ের জন্য" };
  const exp = new Date(expiresAt);
  const dhaka = new Date(exp.getTime() + 6 * 3600_000);
  const date = `${bnNum(dhaka.getUTCDate())} ${BN_MONTHS[dhaka.getUTCMonth()]} ${bnNum(dhaka.getUTCFullYear())}`;
  const daysLeft = Math.max(0, Math.ceil((exp.getTime() - now.getTime()) / 86400_000));
  const text = daysLeft <= 0 ? "আজই শেষ দিন" : `আর মাত্র ${bnNum(daysLeft)} দিন বাকি`;
  return { date, daysLeft, text };
}

/** Personal name only — never the store/site name. */
export function recipientName(meta: Record<string, any> | null | undefined, storeOwnerName?: string | null) {
  const n = [meta?.owner_name, meta?.full_name, meta?.name, storeOwnerName].map((v) => String(v ?? "").trim()).find(Boolean);
  return n || "সম্মানিত মার্চেন্ট";
}
