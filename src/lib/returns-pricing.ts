// Shared return / exchange money math.
// Used by the storefront wizard for the live preview AND re-run on the server
// at submit time so the client can never dictate refund amounts.

export type ReturnKind = "return" | "exchange_same" | "exchange_other";

export type ReturnPolicy = {
  enabled: boolean;
  eligibility_days: number;
  allow_return: boolean;
  allow_exchange_same: boolean;
  allow_exchange_other: boolean;
  return_shipping_payer: "store" | "customer";
  return_shipping_charge: number;
  replacement_shipping_payer: "store" | "customer";
  replacement_shipping_charge: number;
  restocking_fee_type: "none" | "percent" | "flat";
  restocking_fee_value: number;
  policy_note?: string | null;
};

export const DEFAULT_POLICY: ReturnPolicy = {
  enabled: true,
  eligibility_days: 7,
  allow_return: true,
  allow_exchange_same: true,
  allow_exchange_other: true,
  return_shipping_payer: "customer",
  return_shipping_charge: 0,
  replacement_shipping_payer: "store",
  replacement_shipping_charge: 0,
  restocking_fee_type: "none",
  restocking_fee_value: 0,
  policy_note: null,
};

export function normalizePolicy(raw: any): ReturnPolicy {
  const p = raw ?? {};
  return {
    ...DEFAULT_POLICY,
    ...p,
    eligibility_days: Number(p.eligibility_days ?? DEFAULT_POLICY.eligibility_days),
    return_shipping_charge: Number(p.return_shipping_charge ?? 0),
    replacement_shipping_charge: Number(p.replacement_shipping_charge ?? 0),
    restocking_fee_value: Number(p.restocking_fee_value ?? 0),
  };
}

export type ReturnLine = {
  order_item_id?: string | null;
  product_id?: string | null;
  name: string;
  variant?: string | null;
  qty: number;
  price: number;
  image_url?: string | null;
};

export type ReturnAmounts = {
  items_value: number;
  replacement_value: number;
  return_shipping_charge: number;
  replacement_shipping_charge: number;
  restocking_fee: number;
  refund_amount: number;
  extra_payment_due: number;
};

const money = (n: number) => Math.max(0, Math.round((Number(n) || 0) * 100) / 100);

export function computeReturnAmounts(
  policy: ReturnPolicy,
  kind: ReturnKind,
  lines: ReturnLine[],
  replacements: ReturnLine[],
): ReturnAmounts {
  const itemsValue = money(lines.reduce((s, l) => s + Number(l.price || 0) * Number(l.qty || 0), 0));
  const isExchange = kind !== "return";
  const replacementValue = isExchange
    ? money(replacements.reduce((s, l) => s + Number(l.price || 0) * Number(l.qty || 0), 0))
    : 0;

  const returnShip =
    policy.return_shipping_payer === "customer" ? money(policy.return_shipping_charge) : 0;
  const replacementShip =
    isExchange && policy.replacement_shipping_payer === "customer"
      ? money(policy.replacement_shipping_charge)
      : 0;

  let restocking = 0;
  if (policy.restocking_fee_type === "percent") {
    restocking = money((itemsValue * Number(policy.restocking_fee_value || 0)) / 100);
  } else if (policy.restocking_fee_type === "flat") {
    restocking = money(policy.restocking_fee_value);
  }

  // Positive net = money back to the customer, negative = customer owes.
  const net = itemsValue - replacementValue - returnShip - replacementShip - restocking;

  return {
    items_value: itemsValue,
    replacement_value: replacementValue,
    return_shipping_charge: returnShip,
    replacement_shipping_charge: replacementShip,
    restocking_fee: restocking,
    refund_amount: net > 0 ? money(net) : 0,
    extra_payment_due: net < 0 ? money(-net) : 0,
  };
}

export const KIND_LABEL: Record<ReturnKind, string> = {
  return: "Return only",
  exchange_same: "Exchange — same product",
  exchange_other: "Exchange — different product",
};

export const STATUS_FLOW = [
  "requested",
  "approved",
  "shipment_created",
  "in_transit",
  "received",
  "inspection_passed",
  "replacement_created",
  "refunded",
  "completed",
] as const;

export const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  shipment_created: "Return shipment created",
  in_transit: "In transit",
  received: "Received by store",
  inspection_passed: "Inspection passed",
  inspection_failed: "Inspection failed",
  replacement_created: "Replacement created",
  refunded: "Refund processed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const REFUND_METHOD_LABEL: Record<string, string> = {
  original: "Original payment method",
  store_credit: "Store credit",
  manual: "Manual / cash",
  cod_adjust: "COD adjustment",
};
