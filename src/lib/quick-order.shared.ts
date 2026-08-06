// Runtime helpers + schema for the Quick Order server functions.
//
// These MUST live outside `quick-order.functions.ts`: TanStack's server-fn
// splitting strips every module-scope runtime sibling from the client build,
// which turns a helper defined next to `createServerFn` into a ReferenceError
// as soon as the route chunk loads (the "page didn't load" screen).
import { z } from "zod";

export async function myStoreId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export function digits(v: string | null | undefined) {
  return (v ?? "").replace(/[^0-9]/g, "");
}

export const createInput = z.object({
  customer: z.object({
    id: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(5).max(40),
    email: z.string().trim().email().max(160).optional().or(z.literal("")),
    address: z.string().trim().min(3).max(500),
    area: z.string().trim().max(160).optional(),
    deliveryZoneId: z.string().uuid().nullable().optional(),
    note: z.string().trim().max(500).optional(),
    saveAddress: z.boolean().optional(),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        qty: z.number().int().min(1).max(999),
        variant: z.string().trim().max(120).optional(),
        variantId: z.string().trim().max(60).optional(),
      }),
    )
    .min(1)
    .max(50),
  discount: z.number().min(0).max(10_000_000).optional(),
  deliveryCharge: z.number().min(0).max(1_000_000).optional(),
  additionalCharge: z.number().min(0).max(1_000_000).optional(),
  couponCode: z.string().trim().max(40).optional(),
  paymentMethod: z.enum(["cod", "bkash", "nagad", "rocket", "bank", "online"]),
  paymentState: z.enum(["unpaid", "partial", "paid"]),
  paidAmount: z.number().min(0).max(10_000_000).optional(),
  txnId: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  allowOversell: z.boolean().optional(),
});

export type QuickOrderInput = z.infer<typeof createInput>;

export type QuickCustomer = {
  id: string | null;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  area: string | null;
  deliveryZoneId: string | null;
  note: string | null;
  orders: number;
  spend: number;
  lastOrderAt: string | null;
  existing: boolean;
};
