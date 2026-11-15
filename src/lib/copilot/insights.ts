// Pure, compact summaries for the AI Business Co-pilot. No DB access here —
// callers pass store-scoped rows; outputs stay tiny so AI prompts stay cheap.

export type OrderRow = { id: string; status: string | null; subtotal: number | null; created_at: string; customer_id?: string | null; phone?: string | null };
export type ItemRow = { order_id: string; product_id: string | null; name_snapshot: string | null; qty: number; price_snapshot: number };
export type ProductRow = {
  id: string; name: string; price: number | null; stock: number | null; status: string | null;
  low_stock_threshold?: number | null; description?: string | null; short_description?: string | null;
  primary_image_url?: string | null; meta?: any; slug?: string | null; created_at?: string | null;
};

const round = (n: number) => Math.round(n * 100) / 100;

export function summarizeSales(orders: OrderRow[]) {
  const cancelled = orders.filter((o) => o.status === "cancelled");
  const valid = orders.filter((o) => o.status !== "cancelled");
  const revenue = valid.reduce((s, o) => s + Number(o.subtotal ?? 0), 0);
  const byStatus: Record<string, number> = {};
  for (const o of orders) byStatus[o.status ?? "unknown"] = (byStatus[o.status ?? "unknown"] ?? 0) + 1;
  const buyers = new Map<string, number>();
  for (const o of valid) {
    const k = o.customer_id || o.phone;
    if (k) buyers.set(k, (buyers.get(k) ?? 0) + 1);
  }
  const repeat = [...buyers.values()].filter((n) => n > 1).length;
  return {
    orders: orders.length,
    revenue: round(revenue),
    avgOrderValue: valid.length ? round(revenue / valid.length) : 0,
    cancelRate: orders.length ? round((cancelled.length / orders.length) * 100) : 0,
    byStatus,
    customers: buyers.size,
    repeatCustomers: repeat,
  };
}

export function productPerformance(products: ProductRow[], items: ItemRow[], limit = 5) {
  const sold = new Map<string, { qty: number; revenue: number }>();
  for (const it of items) {
    if (!it.product_id) continue;
    const cur = sold.get(it.product_id) ?? { qty: 0, revenue: 0 };
    cur.qty += Number(it.qty);
    cur.revenue += Number(it.qty) * Number(it.price_snapshot);
    sold.set(it.product_id, cur);
  }
  const rows = products.map((p) => ({ id: p.id, name: p.name, stock: p.stock ?? 0, ...(sold.get(p.id) ?? { qty: 0, revenue: 0 }) }));
  const active = products.filter((p) => p.status !== "draft");
  return {
    top: rows.filter((r) => r.qty > 0).sort((a, b) => b.qty - a.qty).slice(0, limit).map((r) => ({ ...r, revenue: round(r.revenue) })),
    notSelling: rows.filter((r) => r.qty === 0 && active.some((p) => p.id === r.id)).slice(0, limit).map(({ id, name, stock }) => ({ id, name, stock })),
    lowStock: active
      .filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.low_stock_threshold ?? 5))
      .slice(0, limit).map((p) => ({ id: p.id, name: p.name, stock: p.stock ?? 0 })),
    outOfStock: active.filter((p) => (p.stock ?? 0) <= 0).length,
  };
}

export type SeoIssue = { productId?: string; name?: string; issues: string[] };

export function auditSeo(store: { name?: string | null; description?: string | null; seo?: any; logo_url?: string | null }, products: ProductRow[], limit = 10) {
  const storeIssues: string[] = [];
  const seo = store.seo ?? {};
  const title = seo.title || seo.meta_title;
  const desc = seo.description || seo.meta_description || store.description;
  if (!title) storeIssues.push("store meta title missing");
  else if (String(title).length > 60) storeIssues.push("store meta title longer than 60 characters");
  if (!desc) storeIssues.push("store meta description missing");
  else if (String(desc).length < 50) storeIssues.push("store meta description too short");
  if (!store.logo_url) storeIssues.push("logo missing");

  const productIssues: SeoIssue[] = [];
  for (const p of products) {
    const issues: string[] = [];
    const text = p.description || p.short_description || "";
    if (!text) issues.push("description missing");
    else if (text.replace(/<[^>]+>/g, "").length < 80) issues.push("description too short");
    if (!p.primary_image_url) issues.push("image missing");
    if (p.name.length < 10) issues.push("title too short");
    if (issues.length) productIssues.push({ productId: p.id, name: p.name, issues });
  }
  const checks = 5 + products.length * 3;
  const fails = storeIssues.length + productIssues.reduce((s, p) => s + p.issues.length, 0);
  return {
    score: checks ? Math.max(0, Math.round(100 - (fails / checks) * 100)) : 100,
    storeIssues,
    productsWithIssues: productIssues.length,
    sample: productIssues.slice(0, limit),
  };
}

/** Clean a product draft the AI proposes; nothing is saved until the merchant confirms. */
export function normalizeProductDraft(d: { name: string; price: number; stock?: number; description?: string; categoryId?: string | null }) {
  const name = d.name.trim().slice(0, 150);
  if (name.length < 2) throw new Error("Product name is too short");
  if (!(d.price > 0)) throw new Error("Price must be greater than 0");
  return {
    name,
    price: round(d.price),
    stock: Math.max(0, Math.floor(d.stock ?? 0)),
    description: (d.description ?? "").trim().slice(0, 5000),
    category_id: d.categoryId ?? null,
    status: "draft" as const,
  };
}
