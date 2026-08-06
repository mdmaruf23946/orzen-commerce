// Customer account server functions: rich order list, cancellation,
// notification feed, payment methods and account summary.
// Every payload is product-type aware so the storefront can render strictly
// isolated experiences for physical / digital / service / subscription orders.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slugSchema = z.string().min(1).max(120);
const tokenSchema = z.string().min(16).max(128);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function resolveStore(slug: string) {
  const sb = await admin();
  const { data } = await sb.from("stores").select("id,status").eq("slug", slug).maybeSingle();
  if (!data || data.status !== "active") throw new Error("Store unavailable");
  return data.id as string;
}

async function requireCustomer(storeSlug: string, token: string) {
  const storeId = await resolveStore(storeSlug);
  const sb = await admin();
  const { data } = await sb.rpc("customer_from_token", {
    _token: token,
    _store_id: storeId,
  } as any);
  if (!data) throw new Error("Not signed in");
  return { sb, storeId, customer: data as any };
}

const ORDER_TYPES = ["physical", "digital", "service", "subscription"] as const;

const listArgs = z.object({
  storeSlug: slugSchema,
  token: tokenSchema,
  type: z.enum(ORDER_TYPES).optional(),
  status: z
    .enum(["pending", "completed", "cancelled", "active", "expired"])
    .optional(),
  sort: z.enum(["newest", "oldest"]).optional(),
  search: z.string().trim().max(120).optional(),
});

/** Orders enriched with product image / name / type so the list can render cards. */
export const listMyOrders = createServerFn({ method: "POST" })
  .inputValidator((d) => listArgs.parse(d))
  .handler(async ({ data }) => {
    const { sb, storeId, customer } = await requireCustomer(data.storeSlug, data.token);

    let q = sb
      .from("orders")
      .select(
        "id,invoice_no,order_type,status,confirmation_status,payment_status,payment_method,subtotal,delivery_amount,discount_amount,created_at",
      )
      .eq("store_id", storeId)
      .eq("customer_id", customer.id);

    if (data.type) q = q.eq("order_type", data.type);
    q = q.order("created_at", { ascending: data.sort === "oldest" });

    const { data: orders, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (orders ?? []) as any[];
    if (!rows.length) return [];

    const ids = rows.map((o) => o.id);
    const { data: items } = await sb
      .from("order_items")
      .select("order_id,product_id,name_snapshot,qty,price_snapshot")
      .in("order_id", ids);

    const productIds = Array.from(
      new Set(((items ?? []) as any[]).map((i) => i.product_id).filter(Boolean)),
    );
    const imageById = new Map<string, string | null>();
    if (productIds.length) {
      const { data: prods } = await sb
        .from("products")
        .select("id,primary_image_url")
        .in("id", productIds as string[]);
      for (const p of (prods ?? []) as any[]) {
        const raw = p.primary_image_url as string | null;
        imageById.set(
          p.id,
          raw ? (raw.startsWith("http") || raw.startsWith("/") ? raw : `/api/img/${raw}`) : null,
        );
      }
    }

    const byOrder = new Map<string, any[]>();
    for (const it of ((items ?? []) as any[])) {
      const list = byOrder.get(it.order_id) ?? [];
      list.push(it);
      byOrder.set(it.order_id, list);
    }

    // Delivery timestamps (for the return window) and existing return requests.
    const { data: tl } = await sb
      .from("order_timeline")
      .select("order_id,stage,created_at")
      .in("order_id", ids)
      .eq("stage", "delivered");
    const deliveredAt = new Map<string, string>();
    for (const t of ((tl ?? []) as any[])) {
      if (!deliveredAt.has(t.order_id)) deliveredAt.set(t.order_id, t.created_at);
    }

    const { data: rets } = await sb
      .from("returns")
      .select(
        "id,order_id,type,status,reason,resolution_note,refund_amount,courier_name,courier_tracking_id,created_at,replacement_product_id",
      )
      .in("order_id", ids)
      .order("created_at", { ascending: false });
    const returnsByOrder = new Map<string, any[]>();
    for (const r of ((rets ?? []) as any[])) {
      const list = returnsByOrder.get(r.order_id) ?? [];
      list.push(r);
      returnsByOrder.set(r.order_id, list);
    }

    const RETURN_WINDOW_MS = 7 * 86_400_000;

    let out = rows.map((o) => {
      const list = byOrder.get(o.id) ?? [];
      const first = list[0];
      const total =
        Number(o.subtotal ?? 0) + Number(o.delivery_amount ?? 0) - Number(o.discount_amount ?? 0);
      const delivered = deliveredAt.get(o.id) ?? null;
      const orderReturns = returnsByOrder.get(o.id) ?? [];
      const hasOpen = orderReturns.some(
        (r) => r.status === "requested" || r.status === "approved",
      );
      return {
        id: o.id,
        invoice_no: o.invoice_no as string | null,
        order_type: (o.order_type ?? "physical") as string,
        status: o.status as string,
        confirmation_status: o.confirmation_status as string,
        payment_status: (o.payment_status ?? "pending") as string,
        payment_method: o.payment_method as string,
        created_at: o.created_at as string,
        total,
        item_count: list.reduce((a, i) => a + Number(i.qty ?? 1), 0),
        product_name: first?.name_snapshot ?? "Order",
        product_image: first?.product_id ? (imageById.get(first.product_id) ?? null) : null,
        extra_items: Math.max(0, list.length - 1),
        items: list.map((i) => ({
          product_id: i.product_id ?? null,
          name_snapshot: i.name_snapshot,
          qty: Number(i.qty ?? 1),
          price_snapshot: Number(i.price_snapshot ?? 0),
        })),
        delivered_at: delivered,
        returns: orderReturns,
        return_eligible:
          (o.order_type ?? "physical") === "physical" &&
          o.status !== "cancelled" &&
          !!delivered &&
          Date.now() - new Date(delivered).getTime() <= RETURN_WINDOW_MS &&
          !hasOpen,
      };
    });


    if (data.status) {
      const s = data.status;
      out = out.filter((o) => {
        if (s === "cancelled") return o.status === "cancelled";
        if (s === "pending") return o.status === "pending" || o.payment_status !== "paid";
        if (s === "completed") return o.status === "delivered";
        if (s === "active") return o.status === "confirmed" || o.status === "processing";
        if (s === "expired") return o.status === "cancelled" && o.payment_status !== "paid";
        return true;
      });
    }

    if (data.search) {
      const term = data.search.toLowerCase();
      out = out.filter(
        (o) =>
          o.product_name.toLowerCase().includes(term) ||
          (o.invoice_no ?? "").toLowerCase().includes(term) ||
          o.id.toLowerCase().includes(term),
      );
    }

    return out;
  });

/** Cancellation is only permitted while an order is still un-confirmed. */
export const cancelMyOrder = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        storeSlug: slugSchema,
        token: tokenSchema,
        orderId: z.string().uuid(),
        reason: z.string().trim().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { sb, storeId, customer } = await requireCustomer(data.storeSlug, data.token);
    const { data: order } = await sb
      .from("orders")
      .select(
        "id,status,order_type,payment_status,confirmation_status,fulfillment_meta,courier_tracking_id",
      )
      .eq("id", data.orderId)
      .eq("store_id", storeId)
      .eq("customer_id", customer.id)
      .maybeSingle();
    if (!order) throw new Error("Order not found");

    const o = order as any;
    if (o.status === "cancelled") throw new Error("This order is already cancelled");
    if (o.order_type === "subscription")
      throw new Error("Please cancel this from your subscriptions page");
    if (o.status === "delivered") throw new Error("This order can no longer be cancelled");

    // Cancellation stays open until the parcel is handed to the courier.
    const { data: stages } = await sb
      .from("order_timeline")
      .select("stage")
      .eq("order_id", data.orderId)
      .in("stage", ["courier_assigned", "shipped", "delivered", "returned"]);
    if ((stages ?? []).length > 0 || o.courier_tracking_id)
      throw new Error("This order has already been shipped and can no longer be cancelled");

    const meta = (o.fulfillment_meta ?? {}) as any;
    const { error } = await sb
      .from("orders")
      .update({
        status: "cancelled",
        fulfillment_meta: {
          ...meta,
          cancelled_by: "customer",
          cancelled_at: new Date().toISOString(),
          cancel_reason: data.reason ?? null,
        },
      } as any)
      .eq("id", data.orderId)
      .eq("store_id", storeId)
      .neq("status", "cancelled");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Payment methods derived from the customer's own order history. */
export const listMyPaymentMethods = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ storeSlug: slugSchema, token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const { sb, storeId, customer } = await requireCustomer(data.storeSlug, data.token);
    const { data: rows } = await sb
      .from("orders")
      .select("payment_method,payment_gateway_name,payment_status,created_at")
      .eq("store_id", storeId)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    const map = new Map<string, { method: string; label: string; uses: number; last_used: string; paid: number }>();
    for (const r of ((rows ?? []) as any[])) {
      const label = r.payment_gateway_name || String(r.payment_method ?? "cod");
      const key = label.toLowerCase();
      const cur = map.get(key);
      if (cur) {
        cur.uses += 1;
        if (r.payment_status === "paid") cur.paid += 1;
      } else {
        map.set(key, {
          method: String(r.payment_method ?? "cod"),
          label,
          uses: 1,
          last_used: r.created_at,
          paid: r.payment_status === "paid" ? 1 : 0,
        });
      }
    }
    return Array.from(map.values());
  });

/** Which account sections should be visible + support contact details. */
export const getMyAccountSummary = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ storeSlug: slugSchema, token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const { sb, storeId, customer } = await requireCustomer(data.storeSlug, data.token);

    const [orders, subs, ents, store] = await Promise.all([
      sb
        .from("orders")
        .select("order_type,status")
        .eq("store_id", storeId)
        .eq("customer_id", customer.id),
      sb
        .from("store_subscriptions")
        .select("id,status")
        .eq("store_id", storeId)
        .eq("customer_id", customer.id),
      sb
        .from("digital_entitlements")
        .select("id")
        .eq("store_id", storeId)
        .eq("customer_id", customer.id),
      sb.from("stores").select("name,phone,email,facebook,address").eq("id", storeId).maybeSingle(),
    ]);

    const orderRows = ((orders.data ?? []) as any[]);
    const activeServices = orderRows.filter(
      (o) => o.order_type === "service" && o.status !== "cancelled",
    ).length;

    return {
      storeId,
      counts: {
        orders: orderRows.length,
        services: activeServices,
        subscriptions: ((subs.data ?? []) as any[]).length,
        downloads: ((ents.data ?? []) as any[]).length,
      },
      support: {
        name: (store.data as any)?.name ?? null,
        phone: (store.data as any)?.phone ?? null,
        email: (store.data as any)?.email ?? null,
        facebook: (store.data as any)?.facebook ?? null,
        address: (store.data as any)?.address ?? null,
      },
    };
  });

type Notif = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  created_at: string;
  order_id?: string | null;
  subscription_id?: string | null;
};

/** Derived notification feed built from the customer's own records. */
export const listMyNotifications = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ storeSlug: slugSchema, token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const { sb, storeId, customer } = await requireCustomer(data.storeSlug, data.token);
    const out: Notif[] = [];

    const { data: orders } = await sb
      .from("orders")
      .select("id,invoice_no,order_type,status,payment_status,created_at,updated_at,confirmed_at")
      .eq("store_id", storeId)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(50);

    for (const o of ((orders ?? []) as any[])) {
      const ref = o.invoice_no ?? o.id.slice(0, 8).toUpperCase();
      out.push({
        id: `${o.id}:placed`,
        kind: "order_placed",
        title: "Order placed",
        body: `Order ${ref} was received.`,
        created_at: o.created_at,
        order_id: o.id,
      });
      if (o.confirmed_at)
        out.push({
          id: `${o.id}:confirmed`,
          kind: "order_confirmed",
          title: "Order confirmed",
          body: `Order ${ref} has been confirmed.`,
          created_at: o.confirmed_at,
          order_id: o.id,
        });
      if (o.payment_status === "paid")
        out.push({
          id: `${o.id}:paid`,
          kind: "payment_confirmed",
          title: "Payment confirmed",
          body: `We received your payment for ${ref}.`,
          created_at: o.updated_at ?? o.created_at,
          order_id: o.id,
        });
      if (o.order_type === "digital" && o.payment_status === "paid")
        out.push({
          id: `${o.id}:digital`,
          kind: "digital_ready",
          title: "Downloads ready",
          body: `Your files for ${ref} are ready.`,
          created_at: o.updated_at ?? o.created_at,
          order_id: o.id,
        });
      if (o.order_type === "service" && o.status === "processing")
        out.push({
          id: `${o.id}:service`,
          kind: "service_started",
          title: "Service started",
          body: `Work has started on ${ref}.`,
          created_at: o.updated_at ?? o.created_at,
          order_id: o.id,
        });
    }

    const { data: subs } = await sb
      .from("store_subscriptions")
      .select("id,plan_name,status,current_period_end,created_at,updated_at")
      .eq("store_id", storeId)
      .eq("customer_id", customer.id);

    for (const s of ((subs ?? []) as any[])) {
      const plan = s.plan_name ?? "Subscription";
      if (s.status === "active")
        out.push({
          id: `${s.id}:active`,
          kind: "subscription_activated",
          title: "Subscription activated",
          body: `${plan} is active.`,
          created_at: s.updated_at ?? s.created_at,
          subscription_id: s.id,
        });
      if (s.status === "expired")
        out.push({
          id: `${s.id}:expired`,
          kind: "subscription_expired",
          title: "Subscription expired",
          body: `${plan} has expired.`,
          created_at: s.updated_at ?? s.created_at,
          subscription_id: s.id,
        });
      if (s.status === "active" && s.current_period_end) {
        const days = Math.ceil(
          (new Date(s.current_period_end).getTime() - Date.now()) / 86_400_000,
        );
        if (days >= 0 && days <= 7)
          out.push({
            id: `${s.id}:reminder`,
            kind: "renewal_reminder",
            title: "Renewal reminder",
            body: `${plan} renews in ${days} day${days === 1 ? "" : "s"}.`,
            created_at: new Date().toISOString(),
            subscription_id: s.id,
          });
      }
    }

    out.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return out.slice(0, 60);
  });
