// Amount the courier must collect from the customer at the door (COD).
// `orders.subtotal` already stores the grand total (items + delivery − discount),
// so delivery is never added again. Prepaid → 0; partial advance → the rest.
export function collectAmount(o: {
  subtotal?: number | string | null;
  paid_amount?: number | string | null;
  payment_method?: string | null;
  payment_status?: string | null;
}): number {
  const total = Math.max(0, Number(o.subtotal ?? 0) || 0);
  if (o.payment_status === "paid" && o.payment_method !== "cod") return 0;
  const paid = Math.max(0, Number(o.paid_amount ?? 0) || 0);
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}
