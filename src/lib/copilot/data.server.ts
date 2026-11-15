// Store-scoped Co-pilot data loaders, shared by the direct server functions
// and the AI tool executor. Always pass the caller's own db client + storeId.
import { auditSeo, copilotProductSlug, normalizeProductDraft, productPerformance, summarizeSales } from "./insights";

const since = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

export async function loadSalesSummary(db: any, storeId: string, days: number) {
  const { data: orders, error } = await db.from("orders")
    .select("id,status,subtotal,created_at,customer_id,phone")
    .eq("store_id", storeId).eq("is_test", false).gte("created_at", since(days)).limit(5000);
  if (error) throw new Error("Could not load sales");
  const { count: visits } = await db.from("marketing_visits").select("id", { count: "exact", head: true })
    .eq("store_id", storeId).gte("created_at", since(days));
  const s = summarizeSales(orders ?? []);
  return { days, ...s, visits: visits ?? 0, conversionRate: visits ? Math.round((s.orders / visits) * 10000) / 100 : null };
}

export async function loadProductPerformance(db: any, storeId: string, days: number) {
  const [{ data: products }, { data: orders }] = await Promise.all([
    db.from("products").select("id,name,price,stock,status,low_stock_threshold").eq("store_id", storeId).limit(2000),
    db.from("orders").select("id").eq("store_id", storeId).neq("status", "cancelled").gte("created_at", since(days)).limit(5000),
  ]);
  const ids = (orders ?? []).map((o: any) => o.id);
  const items: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data: chunk } = await db.from("order_items").select("order_id,product_id,name_snapshot,qty,price_snapshot").in("order_id", ids.slice(i, i + 200));
    items.push(...(chunk ?? []));
  }
  return { days, ...productPerformance(products ?? [], items) };
}

export async function loadSeoAudit(db: any, storeId: string) {
  const [{ data: store }, { data: products }] = await Promise.all([
    db.from("stores").select("name,description,seo,logo_url").eq("id", storeId).maybeSingle(),
    db.from("products").select("id,name,price,stock,status,description,short_description,primary_image_url").eq("store_id", storeId).neq("status", "draft").limit(1000),
  ]);
  return auditSeo(store ?? {}, products ?? []);
}

export async function loadStoreConfig(db: any, storeId: string) {
  const [{ data: store }, { data: zones }, { data: ret }] = await Promise.all([
    db.from("stores").select("name,slug,currency,couriers,primary_domain_id,messenger,whatsapp").eq("id", storeId).maybeSingle(),
    db.from("delivery_zones").select("id,name,charge,eta,is_default").eq("store_id", storeId).eq("is_active", true).order("sort_order"),
    db.from("store_return_settings").select("*").eq("store_id", storeId).maybeSingle(),
  ]);
  const couriers = store?.couriers && typeof store.couriers === "object" ? Object.keys(store.couriers) : [];
  return {
    name: store?.name, slug: store?.slug, currency: store?.currency ?? "BDT",
    customDomain: !!store?.primary_domain_id,
    couriersConfigured: couriers,
    deliveryZones: zones ?? [],
    returnsEnabled: ret ? !!(ret as any).enabled : false,
  };
}

export function draftProduct(input: { name: string; price: number; stock?: number; description?: string; categoryId?: string | null }) {
  return { draft: normalizeProductDraft(input), requiresConfirmation: true };
}

/** Save a merchant-confirmed draft into this store only (hidden as draft until the merchant publishes it). */
export async function saveConfirmedDraft(db: any, storeId: string, input: { name: string; price: number; stock?: number; description?: string }) {
  const draft = normalizeProductDraft(input);
  const { data: dupe } = await db.from("products").select("id,name").eq("store_id", storeId).ilike("name", draft.name).limit(1);
  if (dupe?.[0]) return { ok: true as const, id: dupe[0].id as string, duplicate: true };
  const slug = copilotProductSlug(draft.name, Math.random().toString(36).slice(2, 7));
  const { data, error } = await db.from("products")
    .insert({ store_id: storeId, name: draft.name, slug, price: draft.price, stock: draft.stock, description: draft.description || null, status: "draft" })
    .select("id").single();
  if (error) { console.error("copilot save failed", error.message); throw new Error("প্রোডাক্ট সেভ করা যায়নি, আবার চেষ্টা করুন।"); }
  return { ok: true as const, id: data.id as string, duplicate: false };
}

import type { CopilotAction } from "./actions";

/** Apply one merchant-confirmed Co-pilot change, scoped to this store. */
export async function applyCopilotAction(db: any, storeId: string, a: CopilotAction) {
  if (a.type === "store_seo") {
    const { data: store } = await db.from("stores").select("seo").eq("id", storeId).maybeSingle();
    const seo = { ...(store?.seo && typeof store.seo === "object" ? store.seo : {}), title: a.title, description: a.description, meta_title: a.title, meta_description: a.description };
    const { error } = await db.from("stores").update({ seo }).eq("id", storeId);
    if (error) throw new Error("এসইও সেভ করা যায়নি");
  } else if (a.type === "product_update") {
    const patch: Record<string, unknown> = {};
    if (a.price !== undefined) patch.price = a.price;
    if (a.stock !== undefined) patch.stock = a.stock;
    if (a.description !== undefined) patch.description = a.description;
    const { data, error } = await db.from("products").update(patch).eq("id", a.productId).eq("store_id", storeId).select("id");
    if (error || !data?.length) throw new Error("প্রোডাক্ট আপডেট করা যায়নি");
  } else {
    const { data, error } = await db.from("delivery_zones").update({ charge: a.charge }).eq("id", a.zoneId).eq("store_id", storeId).select("id");
    if (error || !data?.length) throw new Error("ডেলিভারি চার্জ আপডেট করা যায়নি");
  }
  return { ok: true as const };
}
