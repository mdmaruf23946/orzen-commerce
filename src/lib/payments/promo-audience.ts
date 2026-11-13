// Pure rules for picking promo-email recipients by current plan.
export type PromoAudienceGroup = "free" | "trial" | "paid" | "inactive";

const INACTIVE_STATUSES = new Set(["expired", "cancelled", "suspended", "past_due"]);

/** "inactive" = no running plan: lapsed status, or trial/paid end date already passed. */
export function classifyStorePlan(s: {
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  expires_at?: string | null;
  package?: { price?: number | null; is_trial?: boolean | null } | null;
}, now = new Date()): PromoAudienceGroup {
  const past = (d?: string | null) => !!d && new Date(d).getTime() < now.getTime();
  if (INACTIVE_STATUSES.has(String(s.subscription_status ?? ""))) return "inactive";
  const trial = s.subscription_status === "trialing" || !!s.package?.is_trial;
  if (trial && (past(s.trial_ends_at) || (!s.trial_ends_at && past(s.expires_at)))) return "inactive";
  if (!trial && Number(s.package?.price ?? 0) > 0 && past(s.expires_at)) return "inactive";
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

export const DEFAULT_PROMO_BENEFITS = "আপনার ব্যবসা বাড়ানোর জন্য প্যাকেজের সব প্রিমিয়াম সুবিধা এক জায়গায়\nবিক্রি, অর্ডার ও কাস্টমার সামলানো আরও সহজ ও দ্রুত\nআপনার স্টোরকে আরও পেশাদার ও বিশ্বাসযোগ্য করে তোলার সুযোগ";

/** Headline for the biggest monthly discount a coupon offers, e.g. "৳১০০০ পর্যন্ত ছাড়". */
export function promoDiscountHeadline(c: { type: string; value: number | string | null; plan_amounts?: Record<string, number> | null; max_discount?: number | null }): string {
  const planMax = Math.max(0, ...Object.values(c.plan_amounts ?? {}).map(Number).filter((n) => n > 0));
  const value = Number(c.value) || 0;
  if (c.type === "percent") {
    if (planMax > 0) return `৳${bnNum(planMax)} পর্যন্ত ছাড়`;
    if (value > 0) return c.max_discount ? `৳${bnNum(Number(c.max_discount))} পর্যন্ত ছাড়` : `${bnNum(value)}% পর্যন্ত ছাড়`;
    return "বিশেষ ছাড়";
  }
  const top = Math.max(planMax, value);
  return top > 0 ? `৳${bnNum(top)} পর্যন্ত ছাড়` : "বিশেষ ছাড়";
}
