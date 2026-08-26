import { createServerFn } from "@tanstack/react-start";
import { myStoreRow } from "@/lib/store-access";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SEPARATORS = ["-", "/", "_", ""] as const;

export const ORDER_TYPES = ["physical", "digital", "service", "subscription"] as const;
export type InvoiceOrderType = (typeof ORDER_TYPES)[number];

export const DEFAULT_PREFIX: Record<InvoiceOrderType, string> = {
  physical: "PH",
  digital: "DG",
  service: "SV",
  subscription: "SUB",
};

const settingsSchema = z.object({
  order_type: z.enum(ORDER_TYPES),
  prefix: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .transform((s) => s.toUpperCase())
    .refine((s) => /^[A-Z0-9]+$/.test(s), "Prefix must contain only letters and digits"),
  separator: z.enum(SEPARATORS),
  padding: z.number().int().min(4).max(8),
  start_number: z.number().int().min(1),
  include_year: z.boolean(),
  include_month: z.boolean(),
});

export type InvoiceSettingsInput = z.infer<typeof settingsSchema>;
type PreviewInput = Omit<InvoiceSettingsInput, "order_type">;

function preview(s: PreviewInput, seq: number) {
  const parts: string[] = [s.prefix];
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  if (s.include_year && s.include_month) parts.push(`${yyyy}${mm}`);
  else if (s.include_year) parts.push(yyyy);
  else if (s.include_month) parts.push(mm);
  parts.push(String(seq).padStart(s.padding, "0"));
  return parts.join(s.separator);
}

async function getOwnedStoreId(supabase: any, userId: string) {
  const data = await myStoreRow(supabase, userId, "id");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Store not found");
  return data.id as string;
}

/** Returns one settings block per order type (defaults filled in when missing). */
export const getInvoiceSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("store_invoice_settings")
      .select("order_type,prefix,separator,padding,start_number,include_year,include_month,next_number")
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];

    return ORDER_TYPES.map((type) => {
      const row = rows.find((r) => (r.order_type ?? "physical") === type);
      const settings = {
        order_type: type,
        prefix: row?.prefix ?? DEFAULT_PREFIX[type],
        separator: (row?.separator ?? "-") as (typeof SEPARATORS)[number],
        padding: row?.padding ?? 6,
        start_number: Number(row?.start_number ?? 1),
        include_year: !!row?.include_year,
        include_month: !!row?.include_month,
      };
      const next = Math.max(Number(row?.next_number ?? 1), settings.start_number);
      return { ...settings, next_number: next, preview: preview(settings, next) };
    });
  });

export const updateInvoiceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => settingsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { error } = await context.supabase.from("store_invoice_settings").upsert(
      {
        store_id: storeId,
        order_type: data.order_type,
        prefix: data.prefix,
        separator: data.separator,
        padding: data.padding,
        start_number: data.start_number,
        include_year: data.include_year,
        include_month: data.include_month,
      },
      { onConflict: "store_id,order_type" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, preview: preview(data, data.start_number) };
  });

export function computeInvoicePreview(s: PreviewInput, seq: number) {
  return preview(s, seq);
}

/* ------------------------------------------------------------------ *
 * Global Invoice Information (business details shared by every template)
 * ------------------------------------------------------------------ */

const profileSchema = z.object({
  business_name: z.string().trim().max(120).nullable().optional(),
  owner_name: z.string().trim().max(120).nullable().optional(),
  business_address: z.string().trim().max(500).nullable().optional(),
  phone: z.string().trim().max(60).nullable().optional(),
  email: z.string().trim().max(160).nullable().optional(),
  website: z.string().trim().max(200).nullable().optional(),
  trade_license: z.string().trim().max(80).nullable().optional(),
  bin_vat: z.string().trim().max(80).nullable().optional(),
  logo_url: z.string().trim().max(500).nullable().optional(),
  signature_url: z.string().trim().max(500).nullable().optional(),
  seal_url: z.string().trim().max(500).nullable().optional(),
  thank_you_message: z.string().trim().max(500).nullable().optional(),
  terms: z.string().trim().max(4000).nullable().optional(),
  refund_policy: z.string().trim().max(4000).nullable().optional(),
  show_logo: z.boolean().optional(),
  show_signature: z.boolean().optional(),
  show_seal: z.boolean().optional(),
  show_terms: z.boolean().optional(),
});

export type InvoiceProfileInput = z.infer<typeof profileSchema>;

export const getInvoiceProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const [{ data: row, error }, { data: store }] = await Promise.all([
      context.supabase.from("store_invoice_profile").select("*").eq("store_id", storeId).maybeSingle(),
      context.supabase
        .from("stores")
        .select("name,phone,address,email,logo_url,website")
        .eq("id", storeId)
        .maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    return {
      storeId,
      exists: !!row,
      profile: {
        business_name: row?.business_name ?? store?.name ?? "",
        owner_name: row?.owner_name ?? "",
        business_address: row?.business_address ?? store?.address ?? "",
        phone: row?.phone ?? store?.phone ?? "",
        email: row?.email ?? store?.email ?? "",
        website: row?.website ?? store?.website ?? "",
        trade_license: row?.trade_license ?? "",
        bin_vat: row?.bin_vat ?? "",
        logo_url: row?.logo_url ?? store?.logo_url ?? "",
        signature_url: row?.signature_url ?? "",
        seal_url: row?.seal_url ?? "",
        thank_you_message: row?.thank_you_message ?? "",
        terms: row?.terms ?? "",
        refund_policy: row?.refund_policy ?? "",
        show_logo: row?.show_logo ?? true,
        show_signature: row?.show_signature ?? false,
        show_seal: row?.show_seal ?? false,
        show_terms: row?.show_terms ?? true,
      },
    };
  });

export const saveInvoiceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => profileSchema.parse(data))
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("store_invoice_profile")
      .upsert({ store_id: storeId, ...data }, { onConflict: "store_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
