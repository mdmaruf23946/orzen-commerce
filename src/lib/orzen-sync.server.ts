// Real-time push of store events to the merchant's connected Orzen Call app.
// Never throws: a sync failure must never break orders, couriers or products.
// Respects the merchant's auto_orders / auto_products toggles.

type Kind = "order" | "product" | "system";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function pushOrzenEvent(storeId: string, event: string, data: unknown, kind: Kind = "system") {
  try {
    const sb = await admin();
    const { data: row } = await sb
      .from("voice_provider_connections")
      .select("status,account_info,encrypted_token")
      .eq("store_id", storeId)
      .eq("provider", "orzen_call")
      .maybeSingle();
    const r = row as any;
    const info = r?.account_info ?? {};
    const url = info.webhook_url as string | undefined;
    if (r?.status !== "connected" || !url) return false;
    if (kind === "order" && info.auto_orders === false) return false;
    if (kind === "product" && info.auto_products === false) return false;
    const body = JSON.stringify({ event, store_id: storeId, sent_at: new Date().toISOString(), data });
    const { createHmac } = await import("node:crypto");
    const sig = createHmac("sha256", String(r.encrypted_token ?? "")).update(body).digest("hex");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Orzen-Event": event, "X-Orzen-Signature": sig },
      body,
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) console.error(`[orzen-sync] ${event} -> ${res.status}`);
    return res.ok;
  } catch (e) {
    console.error(`[orzen-sync] ${event} failed:`, (e as Error).message);
    return false;
  }
}

/** Full order snapshot (customer, items, status, courier) for the AI. */
export async function pushOrzenOrder(storeId: string, orderId: string, event: string, extra: Record<string, unknown> = {}) {
  try {
    const sb = await admin();
    const { data: o } = await sb
      .from("orders")
      .select("id,invoice_no,status,followup_status,customer_name,phone,address,area,payment_method,payment_status,delivery_amount,discount_amount,subtotal,notes,created_at,courier_name,courier_status,courier_tracking_id,order_items(product_id,name_snapshot,price_snapshot,qty)")
      .eq("store_id", storeId)
      .eq("id", orderId)
      .maybeSingle();
    if (!o) return false;
    const { order_items, subtotal, ...rest } = o as any;
    return pushOrzenEvent(storeId, event, { ...rest, order_id: rest.id, total: subtotal, items: order_items ?? [], ...extra }, "order");
  } catch (e) {
    console.error("[orzen-sync] order snapshot failed:", (e as Error).message);
    return false;
  }
}

/** Product snapshot (price, stock, variants); deleted products send only the id. */
export async function pushOrzenProducts(storeId: string, productIds: string[], event = "product.updated") {
  try {
    if (!productIds.length) return false;
    const sb = await admin();
    const { data: prods } = await sb
      .from("products")
      .select("id,name,sku,price,old_price,stock,status,short_description,description,variants,primary_image_url,slug,product_type")
      .eq("store_id", storeId)
      .in("id", productIds);
    const list = ((prods ?? []) as any[]).map((p) => ({
      ...p,
      description: String(p.description ?? "").slice(0, 4000),
      in_stock: Number(p.stock ?? 0) > 0,
    }));
    if (!list.length) return false;
    return pushOrzenEvent(storeId, event, { products: list }, "product");
  } catch (e) {
    console.error("[orzen-sync] product snapshot failed:", (e as Error).message);
    return false;
  }
}
