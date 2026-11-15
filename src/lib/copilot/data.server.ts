// Store-scoped Co-pilot data loaders, shared by the direct server functions
// and the AI tool executor. Always pass the caller's own db client + storeId.
import { auditSeo, normalizeProductDraft, productPerformance, summarizeSales } from "./insights";

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
    db.from("delivery_zones").select("name,charge,eta,is_default").eq("store_id", storeId).eq("is_active", true).order("sort_order"),
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
