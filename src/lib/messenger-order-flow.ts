// Shared (client + server safe) config for the Messenger "Buy Now" order flow.
// Stored per store on store_ai_agents.order_flow.

export const ORDER_FIELD_KEYS = [
  "customer_name",
  "phone",
  "district",
  "upazila",
  "union",
  "village",
  "area",
  "full_address",
  "qty",
  "payment_method",
  "note",
] as const;

export type OrderFieldKey = (typeof ORDER_FIELD_KEYS)[number];

export type OrderFieldConfig = { enabled: boolean; required: boolean };

export type OrderFlowConfig = {
  buy_now_message: string;
  collection_style: "one_by_one" | "combined";
  confirmation_message: string;
  fields: Record<OrderFieldKey, OrderFieldConfig>;
};

export const ORDER_FIELD_LABELS: Record<OrderFieldKey, string> = {
  customer_name: "Customer name",
  phone: "Phone number",
  district: "District",
  upazila: "Thana / Upazila",
  union: "Union",
  village: "Village",
  area: "Area / Market",
  full_address: "Full delivery address",
  qty: "Product quantity",
  payment_method: "Payment method",
  note: "Additional note",
};

export const DEFAULT_BUY_NOW_MESSAGE =
  "ঠিক আছে, অর্ডারটি কনফার্ম করার জন্য কয়েকটি তথ্য প্রয়োজন।";

export const DEFAULT_CONFIRMATION_MESSAGE =
  "ধন্যবাদ! আপনার অর্ডারটি সফলভাবে নেওয়া হয়েছে। আমাদের টিম খুব শিগগিরই আপনার সঙ্গে যোগাযোগ করবে।";

const DEFAULT_FIELDS: Record<OrderFieldKey, OrderFieldConfig> = {
  customer_name: { enabled: true, required: true },
  phone: { enabled: true, required: true },
  district: { enabled: false, required: false },
  upazila: { enabled: false, required: false },
  union: { enabled: false, required: false },
  village: { enabled: false, required: false },
  area: { enabled: false, required: false },
  full_address: { enabled: true, required: true },
  qty: { enabled: true, required: true },
  payment_method: { enabled: true, required: true },
  note: { enabled: false, required: false },
};

export const ORDER_FLOW_DEFAULTS: OrderFlowConfig = {
  buy_now_message: DEFAULT_BUY_NOW_MESSAGE,
  collection_style: "one_by_one",
  confirmation_message: DEFAULT_CONFIRMATION_MESSAGE,
  fields: DEFAULT_FIELDS,
};

export function normalizeOrderFlow(raw: any): OrderFlowConfig {
  const src = (raw ?? {}) as Partial<OrderFlowConfig>;
  const rawFields = ((src as any).fields ?? {}) as Record<string, any>;
  const fields = {} as Record<OrderFieldKey, OrderFieldConfig>;
  for (const key of ORDER_FIELD_KEYS) {
    const d = DEFAULT_FIELDS[key];
    const f = rawFields[key] ?? {};
    const enabled = typeof f.enabled === "boolean" ? f.enabled : d.enabled;
    const required = enabled ? (typeof f.required === "boolean" ? f.required : d.required) : false;
    fields[key] = { enabled, required };
  }
  // Name + phone are the minimum an order can be created with.
  fields.customer_name = { enabled: true, required: true };
  fields.phone = { enabled: true, required: true };
  return {
    buy_now_message: String(src.buy_now_message ?? "").trim() || DEFAULT_BUY_NOW_MESSAGE,
    collection_style: src.collection_style === "combined" ? "combined" : "one_by_one",
    confirmation_message:
      String(src.confirmation_message ?? "").trim() || DEFAULT_CONFIRMATION_MESSAGE,
    fields,
  };
}

/** Slot keys that must be filled before finalizeOrder is allowed. */
export function requiredSlotFields(cfg: OrderFlowConfig): string[] {
  const req: string[] = ["product_id"];
  for (const key of ORDER_FIELD_KEYS) {
    if (cfg.fields[key].enabled && cfg.fields[key].required) req.push(key);
  }
  // Address can be satisfied by the structured parts when full_address is off.
  if (!cfg.fields.full_address.enabled) {
    const structured = (["district", "upazila", "union", "village", "area"] as OrderFieldKey[]).some(
      (k) => cfg.fields[k].enabled && cfg.fields[k].required,
    );
    if (!structured) req.push("full_address");
  }
  return Array.from(new Set(req));
}

export function optionalSlotFields(cfg: OrderFlowConfig): string[] {
  return ORDER_FIELD_KEYS.filter((k) => cfg.fields[k].enabled && !cfg.fields[k].required);
}

export type MessengerPaymentMethod = { id: string; label: string };

/** Payment options a Messenger (COD/manual) order may use, from the store's payments_config. */
export function messengerPaymentMethods(paymentsConfig: any): MessengerPaymentMethod[] {
  const pc = (paymentsConfig ?? {}) as Record<string, any>;
  const out: MessengerPaymentMethod[] = [];
  if (pc.cod?.enabled !== false) out.push({ id: "cod", label: "Cash on Delivery" });
  if (pc.bkash?.enabled !== false && pc.bkash?.number) out.push({ id: "bkash", label: "bKash" });
  if (pc.nagad?.enabled !== false && pc.nagad?.number) out.push({ id: "nagad", label: "Nagad" });
  if (pc.rocket?.enabled && pc.rocket?.number) out.push({ id: "rocket", label: "Rocket" });
  if (pc.bank?.enabled && pc.bank?.account) out.push({ id: "bank", label: "Bank Transfer" });
  return out;
}

/** Fill {{placeholders}} in the admin confirmation template; drop unknown/empty ones. */
export function renderConfirmation(template: string, vars: Record<string, string | number | null | undefined>) {
  let text = String(template || DEFAULT_CONFIRMATION_MESSAGE);
  text = text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => {
    const v = vars[key.toLowerCase()];
    return v === null || v === undefined || v === "" ? "" : String(v);
  });
  return text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export const CONFIRMATION_PLACEHOLDERS = [
  "product",
  "qty",
  "total",
  "customer_name",
  "address",
  "payment_method",
  "invoice_no",
] as const;
