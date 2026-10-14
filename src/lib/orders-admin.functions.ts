// Read-only helpers for the redesigned Store Admin → Orders screen.
// No schema, workflow, courier or payment logic changes — these only shape
// existing rows into a single payload the premium order cards can render.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getOwnedStoreId } from "@/lib/admin-order.server";

export type AdminOrderItem = {
  name: string;
  qty: number;
  price: number;
  sku: string | null;
  image: string | null;
  cost: number | null;
};

export type OrderKind = "physical" | "digital" | "service" | "subscription";

export type AdminOrderRow = {
  id: string;
  invoice_no: string | null;
  customer_name: string;
  phone: string;
  email: string | null;
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
  order_type: OrderKind;
  confirmation_status: "pending" | "confirmed";
  confirmed_at: string | null;
  fulfillment: Record<string, any>;
  access: {
    total: number;
    active: number;
    downloads: number;
    status: "none" | "locked" | "active" | "revoked";
    licenseKey: string | null;
    entitlementId: string | null;
  } | null;
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
  voice_verification: "verified" | "cancelled" | "needs_agent" | "unanswered" | null;
  followup_status: "incomplete" | "no_response" | "on_hold" | null;
  locked: boolean;
};


/** Everything an order card needs, in one payload. */
export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ product_type: z.enum(["physical", "digital", "service", "subscription"]).optional() })
      .parse(d ?? {}),
  )
  .handler(async ({ data: input, context }): Promise<AdminOrderRow[]> => {
    const { supabase, userId } = context;
    const sid = await getOwnedStoreId(supabase, userId);
    if (!sid) return [];

    let ordersQ = supabase
      .from("orders")
      .select(
        "id,invoice_no,customer_name,phone,email,address,area,status,payment_method,payment_status,payment_gateway_name,source,notes,created_at,allow_duplicate,subtotal,delivery_amount,discount_amount,courier_name,courier_code,courier_status,courier_tracking_id,order_type,confirmation_status,confirmed_at,fulfillment_meta,voice_verification,followup_status",
      )
      .eq("store_id", sid);
    if (input?.product_type) {
      ordersQ =
        input.product_type === "physical"
          ? ordersQ.or("order_type.is.null,order_type.eq.physical")
          : ordersQ.eq("order_type", input.product_type);
    }
    const { data: orders, error } = await ordersQ
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
        image: (() => {
          const raw = i.products?.primary_image_url as string | null | undefined;
          if (!raw) return null;
          return raw.startsWith("http") || raw.startsWith("/") ? raw : `/api/img/${raw}`;
        })(),
        cost: i.products?.cost_price != null ? Number(i.products.cost_price) : null,
      });
    }

    // Digital entitlement summary (only for orders that actually have one).
    const { data: ents } = await supabase
      .from("digital_entitlements")
      .select("id,order_id,status,download_count,digital_licenses(license_key)")
      .eq("store_id", sid)
      .in("order_id", ids);
    const accessByOrder: Record<string, AdminOrderRow["access"]> = {};
    for (const raw of ents ?? []) {
      const e = raw as any;
      const cur =
        accessByOrder[e.order_id] ??
        (accessByOrder[e.order_id] = {
          total: 0, active: 0, downloads: 0, status: "locked",
          licenseKey: null, entitlementId: null,
        });
      cur!.total += 1;
      cur!.downloads += Number(e.download_count ?? 0);
      if (e.status === "active") cur!.active += 1;
      if (!cur!.entitlementId) cur!.entitlementId = e.id;
      const key = e.digital_licenses?.license_key ?? null;
      if (key && !cur!.licenseKey) cur!.licenseKey = key;
      cur!.status =
        cur!.active > 0 ? "active" : e.status === "revoked" ? "revoked" : "locked";
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
        voice_verification: raw.voice_verification ?? null,
        invoice_no: raw.invoice_no,
        customer_name: raw.customer_name,
        phone: raw.phone,
        email: raw.email ?? null,
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
        order_type: (raw.order_type ?? "physical") as OrderKind,
        confirmation_status: (raw.confirmation_status ?? "pending") as "pending" | "confirmed",
        confirmed_at: raw.confirmed_at ?? null,
        fulfillment: (() => {
          const meta = { ...(raw.fulfillment_meta ?? {}) } as Record<string, any>;
          const serviceState = meta.service_state;
          if (serviceState && typeof serviceState === "object" && !Array.isArray(serviceState)) {
            meta.service_state_detail = serviceState;
            meta.service_state =
              typeof serviceState.stage === "string"
                ? serviceState.stage
                : serviceState.cancel_requested
                  ? "cancel_requested"
                  : "requested";
          }
          return meta;
        })(),
        access: accessByOrder[raw.id] ?? null,
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
    const sid = await getOwnedStoreId(context.supabase, context.userId);
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
