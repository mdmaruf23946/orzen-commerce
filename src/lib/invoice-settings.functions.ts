import { createServerFn } from "@tanstack/react-start";
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
  const { data, error } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
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
