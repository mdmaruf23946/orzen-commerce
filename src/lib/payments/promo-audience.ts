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
