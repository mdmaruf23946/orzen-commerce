// Real actions the Merchant AI can run. Every handler receives the storeId
// from the server-side context — the model can never choose a store.
import type { Db } from "./core.server";

export type ActionCtx = {
  db: Db;
  storeId: string;
  /** Who triggered it: 'panel' | 'messenger' | 'whatsapp' | 'facebook' */
  via: string;
};

export type ActionHandler = (ctx: ActionCtx, input: any) => Promise<any>;

const money = (n: unknown) => Number(n ?? 0);

/* ----------------------------- sales ----------------------------- */

const productSearch: ActionHandler = async ({ db, storeId }, input) => {
  const q = String(input?.query ?? "").trim();
  let sel = db
    .from("products")
    .select("id, name, price, old_price, stock, status, sku, product_type")
    .eq("store_id", storeId)
    .limit(8);
  if (q) sel = sel.or(`name.ilike.%${q}%,sku.ilike.%${q}%,product_code.ilike.%${q}%`);
  const { data, error } = await sel;
  if (error) throw new Error(error.message);
  return { products: data ?? [] };
};

const productDetails: ActionHandler = async ({ db, storeId }, input) => {
  const { data, error } = await db
    .from("products")
    .select("id, name, price, old_price, stock, status, sku, product_type, short_description, variants")
    .eq("store_id", storeId)
    .eq("id", String(input?.productId))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { found: false };
  return { found: true, product: data };
};

const bestsellers: ActionHandler = async ({ db, storeId }) => {
  const { data } = await db.rpc("get_store_bestsellers", { _store_id: storeId, _limit: 8 });
  const ids = (data ?? []).map((r: any) => r.product_id);
  if (!ids.length) return { products: [] };
  const { data: products } = await db
    .from("products")
    .select("id, name, price, stock")
    .eq("store_id", storeId)
    .in("id", ids);
  return { products: products ?? [] };
};

/* ----------------------------- orders ----------------------------- */

const ORDER_COLS =
  "id, invoice_no, customer_name, phone, address, subtotal, delivery_amount, discount_amount, paid_amount, due_amount, status, payment_method, payment_status, created_at";

const orderSearch: ActionHandler = async ({ db, storeId }, input) => {
  const q = String(input?.query ?? "").trim();
  let sel = db
    .from("orders")
    .select(ORDER_COLS)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (q) {
    sel = sel.or(
      `customer_name.ilike.%${q}%,phone.ilike.%${q}%,invoice_no.ilike.%${q}%`,
    );
  }
  const { data, error } = await sel;
  if (error) throw new Error(error.message);
  return { orders: data ?? [] };
};

const orderDetails: ActionHandler = async ({ db, storeId }, input) => {
  const { data } = await db
    .from("orders")
    .select(`${ORDER_COLS}, order_items(name_snapshot, qty, price_snapshot)`)
    .eq("store_id", storeId)
    .eq("id", String(input?.orderId))
    .maybeSingle();
  if (!data) return { found: false };
  return { found: true, order: data };
};

const orderToday: ActionHandler = async ({ db, storeId }) => {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { data } = await db
    .from("orders")
    .select("subtotal, delivery_amount, discount_amount, status")
    .eq("store_id", storeId)
    .gte("created_at", since.toISOString());
  const rows = data ?? [];
  return {
    count: rows.length,
    total: rows.reduce(
      (s: number, r: any) => s + money(r.subtotal) + money(r.delivery_amount) - money(r.discount_amount),
      0,
    ),
    byStatus: rows.reduce((acc: Record<string, number>, r: any) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {}),
  };
};

const orderCreate: ActionHandler = async ({ db, storeId }, input) => {
  const items: { productId: string; qty: number }[] = Array.isArray(input?.items) ? input.items : [];
  if (!items.length) throw new Error("At least one product is required.");
  const { data: products, error: pErr } = await db
    .from("products")
    .select("id, name, price, stock, status")
    .eq("store_id", storeId)
    .in("id", items.map((i) => i.productId));
  if (pErr) throw new Error(pErr.message);
  if ((products ?? []).length !== items.length) throw new Error("Some products were not found in your store.");

  let subtotal = 0;
  const lines = items.map((i) => {
    const p = (products ?? []).find((x: any) => x.id === i.productId);
    if (p.status !== "active") throw new Error(`${p.name} is not available right now.`);
    const qty = Math.max(1, Number(i.qty ?? 1));
    const price = money(p.price);
    subtotal += price * qty;
    return { product_id: p.id, name_snapshot: p.name, price_snapshot: price, qty };
  });

  const delivery = money(input?.deliveryCharge);
  const { data: order, error } = await db
    .from("orders")
    .insert({
      store_id: storeId,
      customer_name: String(input?.customerName ?? "").slice(0, 120),
      phone: String(input?.customerPhone ?? "").slice(0, 40),
      address: String(input?.address ?? "").slice(0, 400),
      subtotal,
      delivery_amount: delivery,
      due_amount: subtotal + delivery,
      payment_method: "cod",
      status: "pending",
      source: "ai_agent",
    })
    .select("id, invoice_no, subtotal, delivery_amount")
    .maybeSingle();
  if (error) throw new Error(error.message);
  await db.from("order_items").insert(lines.map((l) => ({ ...l, order_id: order.id })));
  return { created: true, order };
};

const orderUpdateStatus: ActionHandler = async ({ db, storeId }, input) => {
  const status = String(input?.status ?? "");
  const allowed = ["pending", "confirmed", "processing", "delivered", "cancelled"];
  if (!allowed.includes(status)) throw new Error("Unknown order status.");
  const { data, error } = await db
    .from("orders")
    .update({ status })
    .eq("store_id", storeId)
    .eq("id", String(input?.orderId))
    .select("id, invoice_no, status")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Order not found in your store.");
  return { updated: true, order: data };
};

const orderVerify: ActionHandler = async (ctx, input) =>
  orderUpdateStatus(ctx, { orderId: input?.orderId, status: "confirmed" });

const orderCancel: ActionHandler = async (ctx, input) =>
  orderUpdateStatus(ctx, { orderId: input?.orderId, status: "cancelled" });

/* ---------------------------- customers ---------------------------- */

const customerSearch: ActionHandler = async ({ db, storeId }, input) => {
  const q = String(input?.query ?? "").trim();
  let sel = db
    .from("store_customers")
    .select("id, full_name, phone, email, created_at")
    .eq("store_id", storeId)
    .limit(8);
  if (q) sel = sel.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  const { data, error } = await sel;
  if (error) throw new Error(error.message);
  return { customers: data ?? [] };
};

const customerOrders: ActionHandler = async ({ db, storeId }, input) => {
  const phone = String(input?.phone ?? "").trim();
  if (!phone) throw new Error("Customer phone is required.");
  const { data } = await db
    .from("orders")
    .select(ORDER_COLS)
    .eq("store_id", storeId)
    .ilike("phone", `%${phone}%`)
    .order("created_at", { ascending: false })
    .limit(10);
  return { orders: data ?? [] };
};

const customerDetails: ActionHandler = async (ctx, input) => {
  const { db, storeId } = ctx;
  const { data: customer } = await db
    .from("store_customers")
    .select("id, full_name, phone, email, created_at, store_credit")
    .eq("store_id", storeId)
    .eq("id", String(input?.customerId))
    .maybeSingle();
  if (!customer) return { found: false };
  const history = customer.phone ? await customerOrders(ctx, { phone: customer.phone }) : { orders: [] };
  return { found: true, customer, orders: history.orders };
};

/* ----------------------------- courier ----------------------------- */

const courierReady: ActionHandler = async ({ db, storeId }) => {
  const { data } = await db
    .from("orders")
    .select("id, invoice_no, customer_name, phone, address, subtotal, delivery_amount, status")
    .eq("store_id", storeId)
    .in("status", ["confirmed", "processing"])
    .order("created_at", { ascending: false })
    .limit(10);
  return { orders: data ?? [] };
};

const courierSubmit: ActionHandler = async ({ db, storeId }, input) => {
  const { data: store } = await db.from("stores").select("*").eq("id", storeId).maybeSingle();
  if (!store) throw new Error("Store not found.");
  // Tenant guard: the order must belong to this merchant before it is dispatched.
  const { assertOwnedRow } = await import("./core.server");
  await assertOwnedRow(db, "orders", storeId, "id", String(input?.orderId ?? ""));
  const { dispatchParcel } = await import("@/lib/courier-parcels.functions");
  const res = await dispatchParcel(db, store, {
    orderId: String(input?.orderId),
    courierKey: input?.courierKey ? String(input.courierKey) : undefined,
    weight: input?.weight ? Number(input.weight) : undefined,
    note: input?.note ? String(input.note) : undefined,
  } as any);
  return res;
};

const courierTrack: ActionHandler = async ({ db, storeId }, input) => {
  const { data } = await db
    .from("courier_parcels")
    .select("order_id, courier_key, tracking_code, tracking_url, consignment_id, status, last_synced_at")
    .eq("store_id", storeId)
    .eq("order_id", String(input?.orderId))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { found: false };
  return { found: true, parcel: data };
};

/* ----------------------------- facebook ----------------------------- */

const fbRecentComments: ActionHandler = async ({ db, storeId }) => {
  const { data } = await db
    .from("facebook_comments")
    .select("comment_id, author_name, message, post_excerpt, replied, hidden, comment_created_at")
    .eq("store_id", storeId)
    .order("comment_created_at", { ascending: false })
    .limit(10);
  return { comments: data ?? [] };
};

const fbReplyComment: ActionHandler = async ({ db, storeId }, input) => {
  const { loadPageContext, graphPost } = await import("@/lib/facebook-page.server");
  const { row, token } = await loadPageContext(db, storeId);
  if (!row || !token) throw new Error("Facebook Page is not connected.");
  const commentId = String(input?.commentId ?? "");
  const message = String(input?.message ?? "").slice(0, 1000);
  if (!commentId || !message) throw new Error("Comment id and reply text are required.");
  const { assertOwnedRow } = await import("./core.server");
  await assertOwnedRow(db, "facebook_comments", storeId, "comment_id", commentId);
  await graphPost(`/${commentId}/comments`, token, { message });
  await db
    .from("facebook_comments")
    .update({ replied: true })
    .eq("store_id", storeId)
    .eq("comment_id", commentId);
  return { replied: true };
};

const fbHideComment: ActionHandler = async ({ db, storeId }, input) => {
  const { loadPageContext, graphPost } = await import("@/lib/facebook-page.server");
  const { row, token } = await loadPageContext(db, storeId);
  if (!row || !token) throw new Error("Facebook Page is not connected.");
  const commentId = String(input?.commentId ?? "");
  await graphPost(`/${commentId}`, token, { is_hidden: "true" });
  await db
    .from("facebook_comments")
    .update({ hidden: true })
    .eq("store_id", storeId)
    .eq("comment_id", commentId);
  return { hidden: true };
};

/* -------------------------- notify / handoff -------------------------- */

const notifyMerchant: ActionHandler = async (ctx, input) => {
  const { notifyMerchantEvent } = await import("./notify.server");
  await notifyMerchantEvent(ctx.db, ctx.storeId, {
    event: String(input?.event ?? "ai_failed"),
    title: String(input?.title ?? "AI notification"),
    body: String(input?.body ?? ""),
  });
  return { sent: true };
};

const handoffOpen: ActionHandler = async (ctx, input) => {
  const { db, storeId } = ctx;
  const { notifyMerchantEvent } = await import("./notify.server");
  const name = String(input?.customerName ?? "Customer");
  const phone = String(input?.customerPhone ?? "");
  const issue = String(input?.issue ?? "").slice(0, 500);
  await db.from("store_ai_activity_logs").insert({
    store_id: storeId,
    agent_key: "handoff",
    action_key: "handoff_open",
    level: "warn",
    message: `Human handoff requested by ${name}`,
    meta: { phone, issue },
  });
  await notifyMerchantEvent(db, storeId, {
    event: "human_requested",
    title: "Customer wants to talk to you",
    body: `${name}${phone ? ` (${phone})` : ""}\n${issue}`,
  });
  return { opened: true };
};

const handoffClose: ActionHandler = async ({ db, storeId }, input) => {
  await db.from("store_ai_activity_logs").insert({
    store_id: storeId,
    agent_key: "handoff",
    action_key: "handoff_close",
    level: "info",
    message: `Handoff closed${input?.note ? `: ${String(input.note).slice(0, 200)}` : ""}`,
    meta: {},
  });
  return { closed: true };
};

/* ----------------------------- registry ----------------------------- */

export const ACTION_HANDLERS: Record<string, ActionHandler> = {
  sales_product_search: productSearch,
  sales_product_details: productDetails,
  sales_bestsellers: bestsellers,
  order_search: orderSearch,
  order_details: orderDetails,
  order_today: orderToday,
  order_create: orderCreate,
  order_update_status: orderUpdateStatus,
  order_verify: orderVerify,
  order_cancel: orderCancel,
  customer_search: customerSearch,
  customer_details: customerDetails,
  customer_orders: customerOrders,
  courier_ready_orders: courierReady,
  courier_submit: courierSubmit,
  courier_track: courierTrack,
  fb_recent_comments: fbRecentComments,
  fb_reply_comment: fbReplyComment,
  fb_hide_comment: fbHideComment,
  notify_merchant: notifyMerchant,
  handoff_open: handoffOpen,
  handoff_close: handoffClose,
};

export async function runAction(ctx: ActionCtx, actionKey: string, input: unknown) {
  const handler = ACTION_HANDLERS[actionKey];
  if (!handler) throw new Error(`Unknown action: ${actionKey}`);
  return handler(ctx, input ?? {});
}
