// Shared (browser-safe) types + defaults for the dedicated Service Checkout.
// Service checkout is intentionally isolated from physical / digital /
// subscription checkout: no address, no courier, no delivery zone, no COD.

export type ServiceFieldType =
  | "short_text"
  | "long_text"
  | "dropdown"
  | "radio"
  | "checkbox"
  | "date"
  | "url"
  | "number"
  | "file"
  | "files";

export const FIELD_TYPE_LABEL: Record<ServiceFieldType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  dropdown: "Dropdown",
  radio: "Radio buttons",
  checkbox: "Checkbox",
  date: "Date picker",
  url: "URL",
  number: "Number",
  file: "File upload",
  files: "Multiple file upload",
};

export type ServiceIntakeField = {
  id: string;
  label: string;
  field_key: string;
  field_type: ServiceFieldType;
  options: string[];
  placeholder: string | null;
  help_text: string | null;
  is_required: boolean;
  is_visible: boolean;
  sort_order: number;
};

export type ServiceCustomerFields = {
  company?: boolean;
  website?: boolean;
  business_name?: boolean;
  country?: boolean;
  language?: boolean;
};

export type ServiceTermsConfig = {
  terms?: boolean;
  refund?: boolean;
  service?: boolean;
  privacy?: boolean;
};

export type ServiceCheckoutSettings = {
  store_id: string;
  customer_fields: ServiceCustomerFields;
  payment_methods: string[];
  default_payment_method: string | null;
  payment_mode: "full" | "advance" | "advance_required";
  min_advance_percent: number;
  terms: ServiceTermsConfig;
  upload_max_mb: number;
  upload_max_files: number;
  upload_allowed_types: string[];
  auto_confirm: boolean;
  auto_invoice: boolean;
  notify_email: boolean;
  notify_sms: boolean;
  notify_whatsapp: boolean;
  thank_you_message: string | null;
  staff_notes: string | null;
  order_tags: string[];
  communication_enabled: boolean;
};

export const DEFAULT_SERVICE_SETTINGS: Omit<ServiceCheckoutSettings, "store_id"> = {
  customer_fields: { company: true, website: true, business_name: false, country: true, language: false },
  payment_methods: [],
  default_payment_method: null,
  payment_mode: "full",
  min_advance_percent: 50,
  terms: { terms: true, refund: true, service: true, privacy: true },
  upload_max_mb: 10,
  upload_max_files: 5,
  upload_allowed_types: ["jpg", "jpeg", "png", "webp", "pdf", "zip", "doc", "docx", "xls", "xlsx", "mp4"],
  auto_confirm: false,
  auto_invoice: true,
  notify_email: true,
  notify_sms: false,
  notify_whatsapp: false,
  thank_you_message: null,
  staff_notes: null,
  order_tags: [],
  communication_enabled: true,
};

export const CONTACT_CHANNELS = ["WhatsApp", "Email", "Phone Call", "ORZEN Inbox"] as const;
export const CONTACT_TIMES = ["Morning", "Afternoon", "Evening", "Anytime"] as const;

/** Manual (non-gateway) methods a service store can offer. */
export const SERVICE_MANUAL_METHODS = [
  { id: "bkash", label: "bKash" },
  { id: "nagad", label: "Nagad" },
  { id: "rocket", label: "Rocket" },
  { id: "bank", label: "Bank Transfer" },
] as const;

export function slugifyKey(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || `field_${Math.random().toString(36).slice(2, 7)}`
  );
}

/** Advance amount (rounded) for a total, honouring the store's payment mode. */
export function advanceAmount(total: number, s: Pick<ServiceCheckoutSettings, "payment_mode" | "min_advance_percent">) {
  if (s.payment_mode === "full") return total;
  const pct = Math.min(100, Math.max(1, Number(s.min_advance_percent) || 50));
  return Math.round((total * pct) / 100);
}
