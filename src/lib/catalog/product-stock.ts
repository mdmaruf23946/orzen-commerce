// Digital, service and subscription products are not inventory-based:
// they can always be purchased regardless of the `stock` column value.
export const STOCKLESS_TYPES = ["digital", "service", "subscription"] as const;

export function isStockless(productType?: string | null) {
  return STOCKLESS_TYPES.includes((productType ?? "physical") as any);
}

export function isPurchasable(p: { stock?: number | null; status?: string | null; product_type?: string | null }) {
  if (p.status === "draft") return false;
  if (isStockless(p.product_type)) return true;
  return Number(p.stock ?? 0) > 0;
}
