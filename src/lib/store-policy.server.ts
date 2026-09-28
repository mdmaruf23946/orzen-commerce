// Merchant business facts (delivery time + return policy) straight from the
// store's own settings — the single source for the AI tool, fast path and
// reply guard, so chat never states a policy the merchant didn't set.
import { fetchDeliveryZones } from "./chat-order-format";

export type StorePolicy = {
  delivery: { zone: string; eta: string | null }[];
  product_delivery_days: number | null;
  returns: {
    configured: boolean;
    accepts_returns: boolean;
    return_days: number | null;
    exchange: boolean;
    exchange_days: number | null;
    note: string | null;
  };
  product_return_policy: string | null;
};

export async function loadStorePolicy(sb: any, storeId: string, productId?: string | null): Promise<StorePolicy> {
  const [zones, rs, prod] = await Promise.all([
    fetchDeliveryZones(sb, storeId).catch(() => []),
    sb
      .from("store_return_settings")
      .select("enabled,allow_return,eligibility_days,allow_exchange_same,allow_exchange_other,exchange_window_days,policy_note")
      .eq("store_id", storeId)
      .maybeSingle()
      .then((r: any) => r.data)
      .catch(() => null),
    productId
      ? sb
          .from("products")
          .select("delivery_time_days,return_policy")
          .eq("store_id", storeId)
          .eq("id", productId)
          .maybeSingle()
          .then((r: any) => r.data)
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  const enabled = !!rs?.enabled;
  return {
    delivery: (zones as any[]).map((z) => ({ zone: z.name, eta: z.eta ?? null })),
    product_delivery_days: prod?.delivery_time_days != null ? Number(prod.delivery_time_days) : null,
    returns: {
      configured: !!rs,
      accepts_returns: enabled && rs?.allow_return !== false,
      return_days: enabled && rs?.eligibility_days != null ? Number(rs.eligibility_days) : null,
      exchange: enabled && !!(rs?.allow_exchange_same || rs?.allow_exchange_other),
      exchange_days: enabled && rs?.exchange_window_days != null ? Number(rs.exchange_window_days) : null,
      note: rs?.policy_note ? String(rs.policy_note).slice(0, 400) : null,
    },
    product_return_policy: prod?.return_policy ? String(prod.return_policy).slice(0, 400) : null,
  };
}

const BN = "০১২৩৪৫৬৭৮৯";
const toAscii = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));

/** All day-numbers the merchant actually set (zone ETAs, product days, return/exchange windows). */
export function allowedDelivery(p: StorePolicy) {
  const s = new Set<number>();
  for (const z of p.delivery) for (const m of toAscii(z.eta ?? "").matchAll(/\d+/g)) s.add(Number(m[0]));
  if (p.product_delivery_days != null) s.add(p.product_delivery_days);
  return s;
}
export function allowedReturn(p: StorePolicy) {
  const s = new Set<number>();
  if (p.returns.return_days != null) s.add(p.returns.return_days);
  if (p.returns.exchange_days != null) s.add(p.returns.exchange_days);
  for (const t of [p.returns.note, p.product_return_policy]) for (const m of toAscii(t ?? "").matchAll(/\d+/g)) s.add(Number(m[0]));
  return s;
}

export function deliveryTimeText(p: StorePolicy, bn: boolean) {
  const rows = p.delivery.filter((z) => z.eta);
  if (!rows.length) return null;
  const lines = rows.map((z) => `• ${z.zone}: ${z.eta}`).join("\n");
  return bn ? `ডেলিভারি সময়:\n${lines}` : `Delivery time:\n${lines}`;
}

export function returnPolicyText(p: StorePolicy, bn: boolean) {
  const r = p.returns;
  if (!r.configured) return null;
  if (!r.accepts_returns && !r.exchange) {
    return bn ? "দুঃখিত, এই দোকানে বর্তমানে রিটার্ন/এক্সচেঞ্জ সুবিধা নেই।" : "Sorry, this store currently doesn't accept returns or exchanges.";
  }
  const parts: string[] = [];
  if (bn) {
    if (r.accepts_returns) parts.push(r.return_days ? `ডেলিভারির ${r.return_days} দিনের মধ্যে রিটার্ন করা যাবে।` : "রিটার্ন করা যাবে।");
    if (r.exchange) parts.push(r.exchange_days ? `${r.exchange_days} দিনের মধ্যে এক্সচেঞ্জ করা যাবে।` : "এক্সচেঞ্জ করা যাবে।");
  } else {
    if (r.accepts_returns) parts.push(r.return_days ? `Returns accepted within ${r.return_days} days of delivery.` : "Returns are accepted.");
    if (r.exchange) parts.push(r.exchange_days ? `Exchange within ${r.exchange_days} days.` : "Exchanges are accepted.");
  }
  if (r.note) parts.push(r.note);
  return parts.join(" ");
}
