// Read-only helpers for the redesigned Store Admin → Orders screen.
// No schema, workflow, courier or payment logic changes — these only shape
// existing rows into a single payload the premium order cards can render.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function myStoreId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export type AdminOrderItem = {
  name: string;
  qty: number;
  price: number;
  sku: string | null;
  image: string | null;
  cost: number | null;
};

export type AdminOrderRow = {
  id: string;
  invoice_no: string | null;
  customer_name: string;
  phone: string;
  address: string;
  area: string | null;
  status: string;
  payment_method: string;
  payment_status: string;
  payment_gateway_name: string | null;
  source: string;
  notes: string | null;
  created_at: string;
  allow_duplicate: boolean;
  subtotal: number;
  delivery: number;
  discount: number;
  total: number;
  cod_amount: number;
  profit: number | null;
  items: AdminOrderItem[];
  image: string | null;
  qty: number;
  parcel: {
    id: string;
    courier: string | null;
    status: string;
    tracking: string | null;
    consignment: string | null;
  } | null;
  courier_key: string | null;
  courier_status: string | null;
  tracking: string | null;
  tags: string[];
};

/** Everything an order card needs, in one payload. */
export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOrderRow[]> => {
    const { supabase, userId } = context;
    const sid = await myStoreId(supabase, userId);
    if (!sid) return [];

    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        "id,invoice_no,customer_name,phone,address,area,status,payment_method,payment_status,payment_gateway_name,source,notes,created_at,allow_duplicate,subtotal,delivery_amount,discount_amount,courier_name,courier_code,courier_status,courier_tracking_id",
      )
      .eq("store_id", sid)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const list = orders ?? [];
    if (!list.length) return [];

    const ids = list.map((o: any) => o.id);
    const [{ data: items }, { data: parcels }] = await Promise.all([
      supabase
        .from("order_items")
        .select("order_id,name_snapshot,price_snapshot,qty,products(primary_image_url,sku,cost_price)")
        .in("order_id", ids),
      supabase
        .from("courier_parcels")
        .select("id,order_id,courier_key,status,tracking_code,consignment_id,created_at")
        .eq("store_id", sid)
        .in("order_id", ids)
        .order("created_at", { ascending: false }),
    ]);

    const byOrder: Record<string, AdminOrderItem[]> = {};
    for (const raw of items ?? []) {
      const i = raw as any;
      (byOrder[i.order_id] ??= []).push({
        name: i.name_snapshot,
        qty: Number(i.qty ?? 1),
        price: Number(i.price_snapshot ?? 0),
        sku: i.products?.sku ?? null,
        image: i.products?.primary_image_url ?? null,
        cost: i.products?.cost_price != null ? Number(i.products.cost_price) : null,
      });
    }

    const parcelByOrder: Record<string, any> = {};
    for (const p of parcels ?? []) {
      const row = p as any;
      if (row.order_id && !parcelByOrder[row.order_id]) parcelByOrder[row.order_id] = row;
    }

    // Repeat-customer detection across this store's history.
    const phoneCount: Record<string, number> = {};
    for (const o of list) phoneCount[(o as any).phone] = (phoneCount[(o as any).phone] ?? 0) + 1;

    return list.map((raw: any) => {
      const its = byOrder[raw.id] ?? [];
      const subtotal = Number(raw.subtotal ?? 0);
      const delivery = Number(raw.delivery_amount ?? 0);
      const discount = Number(raw.discount_amount ?? 0);
      const total = Math.max(0, subtotal + delivery - discount);
      const prepaid = raw.payment_method !== "cod" && raw.payment_status === "paid";
      const hasCost = its.some((i) => i.cost != null);
      const profit = hasCost
        ? its.reduce((s, i) => s + (i.price - (i.cost ?? 0)) * i.qty, 0) - discount
        : null;
      const parcel = parcelByOrder[raw.id];
      const tags: string[] = [];
      if (Date.now() - new Date(raw.created_at).getTime() < 24 * 3600_000) tags.push("new_order");
      tags.push((phoneCount[raw.phone] ?? 1) > 1 ? "repeat" : "new_customer");
      if (total >= 5000) tags.push("high_value");
      if (raw.area && !/dhaka/i.test(`${raw.area} ${raw.address}`)) tags.push("outside_dhaka");

      return {
        id: raw.id,
        invoice_no: raw.invoice_no,
        customer_name: raw.customer_name,
        phone: raw.phone,
        address: raw.address,
        area: raw.area,
        status: raw.status,
        payment_method: raw.payment_method,
        payment_status: raw.payment_status,
        payment_gateway_name: raw.payment_gateway_name,
        source: raw.source,
        notes: raw.notes,
        created_at: raw.created_at,
        allow_duplicate: !!raw.allow_duplicate,
        subtotal,
        delivery,
        discount,
        total,
        cod_amount: prepaid ? 0 : total,
        profit,
        items: its,
        image: its.find((i) => i.image)?.image ?? null,
        qty: its.reduce((s, i) => s + i.qty, 0),
        parcel: parcel
          ? {
              id: parcel.id,
              courier: parcel.courier_key ?? null,
              status: parcel.status,
              tracking: parcel.tracking_code ?? null,
              consignment: parcel.consignment_id ?? null,
            }
          : null,
        courier_key: parcel?.courier_key ?? raw.courier_code ?? raw.courier_name ?? null,
        courier_status: parcel?.status ?? raw.courier_status ?? null,
        tracking: parcel?.tracking_code ?? raw.courier_tracking_id ?? null,
        tags,
      };
    });
  });

/** Lifetime stats for the customer behind an order (by phone, this store only). */
export const getOrderCustomerStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ phone: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return null;
    const { data: rows } = await context.supabase
      .from("orders")
      .select("status,payment_method,subtotal,delivery_amount,discount_amount,created_at")
      .eq("store_id", sid)
      .eq("phone", data.phone);
    const list = (rows ?? []) as any[];
    if (!list.length) return null;
    const value = (o: any) =>
      Math.max(0, Number(o.subtotal ?? 0) + Number(o.delivery_amount ?? 0) - Number(o.discount_amount ?? 0));
    const delivered = list.filter((o) => o.status === "delivered");
    const cancelled = list.filter((o) => o.status === "cancelled");
    const cod = list.filter((o) => o.payment_method === "cod");
    const codDone = cod.filter((o) => o.status === "delivered");
    const since = list.reduce(
      (min, o) => (new Date(o.created_at) < new Date(min) ? o.created_at : min),
      list[0].created_at as string,
    );
    return {
      total: list.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
      codSuccess: cod.length ? Math.round((codDone.length / cod.length) * 100) : null,
      lifetime: delivered.reduce((s, o) => s + value(o), 0),
      since,
    };
  });
