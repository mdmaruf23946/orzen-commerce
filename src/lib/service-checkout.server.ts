// Server-only helpers for the Service Checkout module.
import { DEFAULT_SERVICE_SETTINGS, type ServiceCheckoutSettings } from "@/lib/service-checkout";

export async function myStoreId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

/** Row → typed settings, falling back to sane defaults when unset. */
export function normalizeSettings(storeId: string, row: any): ServiceCheckoutSettings {
  const r = row ?? {};
  return {
    store_id: storeId,
    customer_fields: { ...DEFAULT_SERVICE_SETTINGS.customer_fields, ...(r.customer_fields ?? {}) },
    payment_methods: Array.isArray(r.payment_methods) ? r.payment_methods : [],
    default_payment_method: r.default_payment_method ?? null,
    payment_mode: r.payment_mode ?? DEFAULT_SERVICE_SETTINGS.payment_mode,
    min_advance_percent: r.min_advance_percent ?? DEFAULT_SERVICE_SETTINGS.min_advance_percent,
    terms: { ...DEFAULT_SERVICE_SETTINGS.terms, ...(r.terms ?? {}) },
    upload_max_mb: r.upload_max_mb ?? DEFAULT_SERVICE_SETTINGS.upload_max_mb,
    upload_max_files: r.upload_max_files ?? DEFAULT_SERVICE_SETTINGS.upload_max_files,
    upload_allowed_types: r.upload_allowed_types ?? DEFAULT_SERVICE_SETTINGS.upload_allowed_types,
    auto_confirm: r.auto_confirm ?? false,
    auto_invoice: r.auto_invoice ?? true,
    notify_email: r.notify_email ?? true,
    notify_sms: r.notify_sms ?? false,
    notify_whatsapp: r.notify_whatsapp ?? false,
    thank_you_message: r.thank_you_message ?? null,
    staff_notes: r.staff_notes ?? null,
    order_tags: r.order_tags ?? [],
    communication_enabled: r.communication_enabled ?? true,
  };
}

export function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

export function safeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120);
}

/** Decode a base64 payload into bytes without relying on Node Buffer typings. */
export function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
