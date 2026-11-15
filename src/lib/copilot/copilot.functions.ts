// AI Business Co-pilot data tools (beta). Store is always resolved from the
// signed-in user; only beta testers can call these until released.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { storeAccess } from "@/lib/accounts/store-access";
import { isBetaTester } from "@/lib/beta-features";
import { auditSeo, normalizeProductDraft, productPerformance, summarizeSales } from "./insights";

function gate(context: any) {
  if (!isBetaTester(context.claims?.email)) throw new Error("This feature is not available yet.");
  return { db: context.supabase, storeId: context.access.storeId as string };
}
const rangeInput = z.object({ days: z.number().int().min(1).max(365).default(30) });
const since = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

export const copilotSalesSummary = createServerFn({ method: "POST" })
  .middleware([storeAccess("orders")])
  .inputValidator((d: unknown) => rangeInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { db, storeId } = gate(context);
    const { data: orders, error } = await db.from("orders")
      .select("id,status,subtotal,created_at,customer_id,phone")
      .eq("store_id", storeId).eq("is_test", false).gte("created_at", since(data.days)).limit(5000);
    if (error) throw new Error("Could not load sales");
    const { count: visits } = await db.from("marketing_visits").select("id", { count: "exact", head: true })
      .eq("store_id", storeId).gte("created_at", since(data.days));
    const s = summarizeSales(orders ?? []);
    return { days: data.days, ...s, visits: visits ?? 0, conversionRate: visits ? Math.round((s.orders / visits) * 10000) / 100 : null };
  });

export const copilotProductPerformance = createServerFn({ method: "POST" })
  .middleware([storeAccess("products")])
  .inputValidator((d: unknown) => rangeInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { db, storeId } = gate(context);
    const [{ data: products }, { data: orders }] = await Promise.all([
      db.from("products").select("id,name,price,stock,status,low_stock_threshold").eq("store_id", storeId).limit(2000),
      db.from("orders").select("id").eq("store_id", storeId).neq("status", "cancelled").gte("created_at", since(data.days)).limit(5000),
    ]);
    const ids = (orders ?? []).map((o: any) => o.id);
    const items: any[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data: chunk } = await db.from("order_items").select("order_id,product_id,name_snapshot,qty,price_snapshot").in("order_id", ids.slice(i, i + 200));
      items.push(...(chunk ?? []));
    }
    return { days: data.days, ...productPerformance(products ?? [], items) };
  });

export const copilotSeoAudit = createServerFn({ method: "POST" })
  .middleware([storeAccess("products")])
  .handler(async ({ context }) => {
    const { db, storeId } = gate(context);
    const [{ data: store }, { data: products }] = await Promise.all([
      db.from("stores").select("name,description,seo,logo_url").eq("id", storeId).maybeSingle(),
      db.from("products").select("id,name,price,stock,status,description,short_description,primary_image_url").eq("store_id", storeId).neq("status", "draft").limit(1000),
    ]);
    return auditSeo(store ?? {}, products ?? []);
  });

export const copilotStoreConfig = createServerFn({ method: "POST" })
  .middleware([storeAccess("settings")])
  .handler(async ({ context }) => {
    const { db, storeId } = gate(context);
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
  });

export const copilotDraftProduct = createServerFn({ method: "POST" })
  .middleware([storeAccess("products")])
  .inputValidator((d: unknown) => z.object({
    name: z.string(), price: z.number(), stock: z.number().optional(),
    description: z.string().optional(), categoryId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    gate(context);
    return { draft: normalizeProductDraft(data), requiresConfirmation: true };
  });
