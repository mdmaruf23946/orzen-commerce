// Shared return / exchange money math.
// Used by the storefront wizard for the live preview AND re-run on the server
// at submit time so the client can never dictate refund amounts.

export type ReturnKind = "return" | "exchange_same" | "exchange_other";

export type ShippingMode = "customer" | "store" | "split" | "free";

export type ExchangeRules = {
  same_variant: boolean;
  different_variant: boolean;
  different_product: boolean;
  higher_price: boolean;
  lower_price: boolean;
  equal_price: boolean;
};

export type AutoWorkflow = {
  return_courier: boolean;
  replacement_order: boolean;
  reserve_stock: boolean;
  update_inventory: boolean;
  notify_customer: boolean;
  sync_tracking: boolean;
};

export type ReturnPolicy = {
  enabled: boolean;
  eligibility_days: number;
  exchange_window_days: number;
  allow_return: boolean;
  allow_exchange_same: boolean;
  allow_exchange_other: boolean;
  return_shipping_payer: "store" | "customer";
  return_shipping_charge: number;
  replacement_shipping_payer: "store" | "customer";
  replacement_shipping_charge: number;
  return_shipping_mode: ShippingMode;
  return_split_customer: number;
  return_split_store: number;
  replacement_shipping_mode: ShippingMode;
  replacement_split_customer: number;
  replacement_split_store: number;
  restocking_fee_type: "none" | "percent" | "flat";
  restocking_fee_value: number;
  exchange_rules: ExchangeRules;
  replacement_source: "cart" | "wishlist" | "all";
  customer_pays_difference: boolean;
  refund_direction: "refund_bank" | "store_credit" | "no_refund";
  require_photo: boolean;
  policy_note?: string | null;
};

export const DEFAULT_EXCHANGE_RULES: ExchangeRules = {
  same_variant: true,
  different_variant: true,
  different_product: true,
  higher_price: true,
  lower_price: true,
  equal_price: true,
};

export const DEFAULT_AUTO_WORKFLOW: AutoWorkflow = {
  return_courier: false,
  replacement_order: false,
  reserve_stock: false,
  update_inventory: true,
  notify_customer: true,
  sync_tracking: false,
};

export const DEFAULT_POLICY: ReturnPolicy = {
  enabled: true,
  eligibility_days: 7,
  exchange_window_days: 7,
  allow_return: true,
  allow_exchange_same: true,
  allow_exchange_other: true,
  return_shipping_payer: "customer",
  return_shipping_charge: 0,
  replacement_shipping_payer: "store",
  replacement_shipping_charge: 0,
  return_shipping_mode: "customer",
  return_split_customer: 0,
  return_split_store: 0,
  replacement_shipping_mode: "store",
  replacement_split_customer: 0,
  replacement_split_store: 0,
  restocking_fee_type: "none",
  restocking_fee_value: 0,
  exchange_rules: DEFAULT_EXCHANGE_RULES,
  replacement_source: "cart",
  customer_pays_difference: true,
  refund_direction: "refund_bank",
  require_photo: false,
  policy_note: null,
};

export function normalizePolicy(raw: any): ReturnPolicy {
  const p = raw ?? {};
  return {
    ...DEFAULT_POLICY,
    ...p,
    eligibility_days: Number(p.eligibility_days ?? DEFAULT_POLICY.eligibility_days),
    exchange_window_days: Number(
      p.exchange_window_days ?? p.eligibility_days ?? DEFAULT_POLICY.exchange_window_days,
    ),
    return_shipping_charge: Number(p.return_shipping_charge ?? 0),
    replacement_shipping_charge: Number(p.replacement_shipping_charge ?? 0),
    return_shipping_mode: (p.return_shipping_mode ??
      p.return_shipping_payer ??
      DEFAULT_POLICY.return_shipping_mode) as ShippingMode,
    return_split_customer: Number(p.return_split_customer ?? 0),
    return_split_store: Number(p.return_split_store ?? 0),
    replacement_shipping_mode: (p.replacement_shipping_mode ??
      p.replacement_shipping_payer ??
      DEFAULT_POLICY.replacement_shipping_mode) as ShippingMode,
    replacement_split_customer: Number(p.replacement_split_customer ?? 0),
    replacement_split_store: Number(p.replacement_split_store ?? 0),
    restocking_fee_value: Number(p.restocking_fee_value ?? 0),
    exchange_rules: { ...DEFAULT_EXCHANGE_RULES, ...(p.exchange_rules ?? {}) },
    replacement_source: (p.replacement_source ?? DEFAULT_POLICY.replacement_source) as
      | "cart"
      | "wishlist"
      | "all",
    customer_pays_difference: p.customer_pays_difference !== false,
    refund_direction: (p.refund_direction ?? DEFAULT_POLICY.refund_direction) as any,
    require_photo: !!p.require_photo,
  };
}

export function normalizeAutoWorkflow(raw: any): AutoWorkflow {
  return { ...DEFAULT_AUTO_WORKFLOW, ...((raw ?? {}) as Partial<AutoWorkflow>) };
}

/** How much of a shipping leg the customer actually pays. */
export function customerShippingShare(
  mode: ShippingMode,
  charge: number,
  splitCustomer: number,
): number {
  switch (mode) {
    case "free":
    case "store":
      return 0;
    case "split":
      return Math.max(0, Number(splitCustomer) || 0);
    default:
      return Math.max(0, Number(charge) || 0);
  }
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

  const returnShip = money(
    customerShippingShare(
      policy.return_shipping_mode,
      policy.return_shipping_charge,
      policy.return_split_customer,
    ),
  );
  const replacementShip = isExchange
    ? money(
        customerShippingShare(
          policy.replacement_shipping_mode,
          policy.replacement_shipping_charge,
          policy.replacement_split_customer,
        ),
      )
    : 0;

  let restocking = 0;
  if (policy.restocking_fee_type === "percent") {
    restocking = money((itemsValue * Number(policy.restocking_fee_value || 0)) / 100);
  } else if (policy.restocking_fee_type === "flat") {
    restocking = money(policy.restocking_fee_value);
  }

  // Positive net = money back to the customer, negative = customer owes.
  let net = itemsValue - replacementValue - returnShip - replacementShip - restocking;
  // When the store absorbs price differences, the customer never owes extra.
  if (net < 0 && !policy.customer_pays_difference) net = 0;
  if (net > 0 && policy.refund_direction === "no_refund" && isExchange) net = 0;


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
