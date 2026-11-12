// Pure promo-code (subscription coupon) rules. Shared by the server validator
// and tests — the browser never decides the discount.
export type PromoCoupon = {
  id: string;
  code: string;
  type: "percent" | "fixed" | string;
  value: number;
  min_amount?: number | null;
  max_discount?: number | null;
  plan_amounts?: Record<string, number> | null;
  applies_to_packages?: string[] | null;
  applies_to_cycles?: string[] | null;
  usage_limit?: number | null;
  used_count?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  active: boolean;
};

export type PromoResult =
  | { ok: true; couponId: string; code: string; discount: number; total: number }
  | { ok: false; error: string };

export function evaluatePromo(
  c: PromoCoupon | null | undefined,
  input: { packageId: string; cycle: string; amount: number; pendingUses?: number; now?: Date },
): PromoResult {
  const now = input.now ?? new Date();
  const amount = Math.max(0, Number(input.amount) || 0);
  if (!c || !c.active) return { ok: false, error: "প্রোমো কোডটি সঠিক নয়" };
  if (c.starts_at && new Date(c.starts_at) > now) return { ok: false, error: "প্রোমো কোডটি এখনো চালু হয়নি" };
  if (c.expires_at && new Date(c.expires_at) < now) return { ok: false, error: "প্রোমো কোডের মেয়াদ শেষ" };
  const used = Number(c.used_count ?? 0) + Number(input.pendingUses ?? 0);
  if (c.usage_limit != null && c.usage_limit > 0 && used >= c.usage_limit)
    return { ok: false, error: "প্রোমো কোডের ব্যবহারের সীমা শেষ" };
  const pkgs = c.applies_to_packages ?? [];
  if (pkgs.length > 0 && !pkgs.includes(input.packageId))
    return { ok: false, error: "এই প্যাকেজে প্রোমো কোডটি প্রযোজ্য নয়" };
  const cycles = c.applies_to_cycles ?? [];
  if (cycles.length > 0 && !cycles.includes(input.cycle))
    return { ok: false, error: "এই মেয়াদে প্রোমো কোডটি প্রযোজ্য নয়" };
  if (amount < Number(c.min_amount ?? 0))
    return { ok: false, error: `কমপক্ষে ৳${Number(c.min_amount)} এর প্ল্যানে প্রযোজ্য` };

  let discount: number;
  const perPlan = c.plan_amounts?.[input.packageId];
  if (perPlan != null && Number(perPlan) > 0) {
    discount = Number(perPlan);
  } else if (c.type === "percent") {
    discount = (amount * Number(c.value)) / 100;
    if (c.max_discount != null && Number(c.max_discount) > 0) discount = Math.min(discount, Number(c.max_discount));
  } else {
    discount = Number(c.value);
  }
  discount = Math.round(Math.min(Math.max(0, discount), amount));
  return { ok: true, couponId: c.id, code: c.code, discount, total: amount - discount };
}
