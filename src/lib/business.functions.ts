// Business management server functions: inventory, coupons, finance,
// returns, customer notes, internal notes, order timeline, invoice,
// bulk product actions, import/export, analytics.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertPlan } from "@/lib/plan-guard";

async function myStoreId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

// ---------- INVENTORY ----------
export const listInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return [];
    const { data } = await context.supabase
      .from("products")
      .select("id,name,sku,stock,cost_price,price,low_stock_threshold,status,primary_image_url")
      .eq("store_id", sid)
      .order("stock", { ascending: true });
    return data ?? [];
  });

export const listStockMovements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productId: z.string().uuid().optional(), limit: z.number().int().min(1).max(200).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return [];
    let q = context.supabase
      .from("stock_movements")
      .select("id,product_id,delta,type,reason,ref_order_id,created_at,products(name)")
      .eq("store_id", sid)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.productId) q = q.eq("product_id", data.productId);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const adjustStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      productId: z.string().uuid(),
      delta: z.number().int(),
      reason: z.string().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "inventory");
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { data: prod } = await context.supabase
      .from("products")
      .select("id,stock")
      .eq("id", data.productId)
      .eq("store_id", sid)
      .maybeSingle();
    if (!prod) throw new Error("Product not found");
    const newStock = Math.max(0, (prod.stock ?? 0) + data.delta);
    const { error: e1 } = await context.supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", prod.id);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await context.supabase.from("stock_movements").insert({
      store_id: sid,
      product_id: prod.id,
      delta: data.delta,
      type: data.delta >= 0 ? "manual_in" : "manual_out",
      reason: data.reason ?? null,
      created_by: context.userId,
      qty_before: prod.stock ?? 0,
      qty_after: newStock,
    });

    if (e2) throw new Error(e2.message);
    return { stock: newStock };
  });

// ---------- COUPONS ----------
const couponSchema = z.object({
  code: z.string().trim().min(1).max(40).regex(/^[A-Z0-9_-]+$/i, "Letters, numbers, dash, underscore"),
  name: z.string().trim().max(120).optional().nullable(),
  product_type: z.enum(["physical", "digital", "service", "subscription"]).optional(),
  type: z.enum(["percent", "fixed", "free_shipping"]),
  value: z.number().nonnegative(),
  min_order: z.number().nonnegative().default(0),
  max_discount: z.number().nonnegative().optional().nullable(),
  usage_limit: z.number().int().min(0).optional().nullable(),
  per_customer_limit: z.number().int().min(0).optional().nullable(),
  starts_at: z.string().optional().nullable(),
  expires_at: z.string().optional().nullable(),
  category_ids: z.array(z.string().uuid()).optional(),
  product_ids: z.array(z.string().uuid()).optional(),
  active: z.boolean().default(true),
});

export const listCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ product_type: z.enum(["physical", "digital", "service", "subscription"]).optional() })
      .parse(d ?? {}),
  )
  .handler(async ({ data: input, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return [];
    let q = context.supabase.from("coupons").select("*").eq("store_id", sid);
    if (input?.product_type) q = q.eq("product_type", input.product_type);
    const { data } = await q.order("created_at", { ascending: false });
    return data ?? [];
  });

export const upsertCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid().optional() }).merge(couponSchema).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "coupons");
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const row = {
      store_id: sid,
      code: data.code.toUpperCase(),
      name: data.name?.trim() || null,
      type: data.type,
      value: data.value,
      min_order: data.min_order ?? 0,
      max_discount: data.max_discount ?? null,
      usage_limit: data.usage_limit ?? null,
      per_customer_limit: data.per_customer_limit ?? null,
      starts_at: data.starts_at || null,
      expires_at: data.expires_at || null,
      category_ids: data.category_ids ?? [],
      product_ids: data.product_ids ?? [],
      active: data.active,
      ...(data.product_type ? { product_type: data.product_type } : {}),
    };
    if (data.id) {
      const { error } = await context.supabase.from("coupons").update(row).eq("id", data.id).eq("store_id", sid);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: c, error } = await context.supabase.from("coupons").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return c;
  });

export const deleteCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "coupons");
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { error } = await context.supabase.from("coupons").delete().eq("id", data.id).eq("store_id", sid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- EXPENSES ----------
export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: z.string().optional(), to: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return [];
    let q = context.supabase.from("expenses").select("*").eq("store_id", sid).order("spent_on", { ascending: false }).limit(200);
    if (data.from) q = q.gte("spent_on", data.from);
    if (data.to) q = q.lte("spent_on", data.to);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const addExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      category: z.enum(["fb_ads", "courier", "packaging", "salary", "misc"]),
      amount: z.number().positive(),
      note: z.string().max(300).optional(),
      spent_on: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { error } = await context.supabase.from("expenses").insert({
      store_id: sid,
      category: data.category,
      amount: data.amount,
      note: data.note ?? null,
      spent_on: data.spent_on || new Date().toISOString().slice(0, 10),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { error } = await context.supabase.from("expenses").delete().eq("id", data.id).eq("store_id", sid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const financeSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const [{ data: orders }, { data: items }, { data: expenses }] = await Promise.all([
      context.supabase.from("orders").select("id,subtotal,discount_amount,status,created_at").eq("store_id", sid),
      context.supabase.from("order_items").select("qty,price_snapshot,products(cost_price),orders!inner(store_id,status,created_at)").eq("orders.store_id", sid),
      context.supabase.from("expenses").select("amount,spent_on").eq("store_id", sid),
    ]);
    let todaySales = 0, monthSales = 0, totalSales = 0;
    for (const o of orders ?? []) {
      if (o.status === "cancelled") continue;
      const v = Number(o.subtotal);
      totalSales += v;
      const dt = new Date(o.created_at);
      if (dt >= today) todaySales += v;
      if (dt >= monthStart) monthSales += v;
    }
    let todayCogs = 0, monthCogs = 0, totalCogs = 0;
    for (const it of (items ?? []) as any[]) {
      if (it.orders?.status === "cancelled") continue;
      const cost = Number(it.products?.cost_price ?? 0) * Number(it.qty);
      totalCogs += cost;
      const dt = new Date(it.orders?.created_at);
      if (dt >= today) todayCogs += cost;
      if (dt >= monthStart) monthCogs += cost;
    }
    let todayExpense = 0, monthExpense = 0, totalExpense = 0;
    const tStr = today.toISOString().slice(0, 10);
    const mStr = monthStart.toISOString().slice(0, 10);
    for (const e of expenses ?? []) {
      const amt = Number(e.amount);
      totalExpense += amt;
      if (e.spent_on >= mStr) monthExpense += amt;
      if (e.spent_on >= tStr) todayExpense += amt;
    }
    return {
      todaySales, monthSales, totalSales,
      todayExpense, monthExpense, totalExpense,
      todayProfit: todaySales - todayCogs - todayExpense,
      monthProfit: monthSales - monthCogs - monthExpense,
      netProfit: totalSales - totalCogs - totalExpense,
    };
  });

// ---------- RETURNS (customer-initiated; admin reviews only) ----------
export const listReturns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return [];
    const { data } = await context.supabase
      .from("returns")
      .select(
        "*, orders(customer_name,phone,subtotal,invoice_no,address,order_type,courier_name,courier_tracking_id), products:replacement_product_id(id,name,primary_image_url)",
      )
      .eq("store_id", sid)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as any[];
    if (!rows.length) return [];

    // Fall back to the order lines when the shopper did not pick specific items.
    const orderIds = Array.from(new Set(rows.map((r) => r.order_id)));
    const { data: items } = await context.supabase
      .from("order_items")
      .select("order_id,qty,price_snapshot,name_snapshot,product_id, products(primary_image_url,gallery)")
      .in("order_id", orderIds);
    const byOrder = new Map<string, any[]>();
    const imageByProduct = new Map<string, string>();
    const imageByName = new Map<string, string>();
    for (const it of (items ?? []) as any[]) {
      const image: string | null =
        it.products?.primary_image_url ?? (Array.isArray(it.products?.gallery) ? it.products.gallery[0] : null) ?? null;
      if (image && it.product_id) imageByProduct.set(it.product_id, image);
      if (image && it.name_snapshot) imageByName.set(String(it.name_snapshot).trim().toLowerCase(), image);
      const list = byOrder.get(it.order_id) ?? [];
      list.push({
        product_id: it.product_id,
        name: it.name_snapshot,
        qty: it.qty,
        price: Number(it.price_snapshot ?? 0),
        image,
      });
      byOrder.set(it.order_id, list);
    }
    // Shopper-submitted items only carry name/qty/price — backfill the thumbnail
    // from the matching order line so admin cards always show the product photo.
    const withImages = (list: any[]) =>
      list.map((it) => ({
        ...it,
        image:
          it.image ??
          (it.product_id ? imageByProduct.get(it.product_id) : null) ??
          imageByName.get(String(it.name ?? "").trim().toLowerCase()) ??
          null,
      }));
    return rows.map((r) => ({
      ...r,
      items:
        Array.isArray(r.items) && r.items.length
          ? withImages(r.items as any[])
          : (byOrder.get(r.order_id) ?? []),
      order_items: byOrder.get(r.order_id) ?? [],
    }));
  });

/** Admin-only review actions. There is no create path — requests come from shoppers. */
export const updateReturnRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["requested", "approved", "rejected", "refunded", "completed"]).optional(),
      refund_amount: z.number().nonnegative().optional(),
      resolution_note: z.string().max(1000).optional(),
      replacement_product_id: z.string().uuid().nullable().optional(),
      courier_name: z.string().max(120).nullable().optional(),
      courier_tracking_id: z.string().max(120).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "returns");
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const patch: Record<string, any> = {};
    if (data.status !== undefined) patch["status"] = data.status;
    if (data.refund_amount !== undefined) patch["refund_amount"] = data.refund_amount;
    if (data.resolution_note !== undefined) patch["resolution_note"] = data.resolution_note || null;
    if (data.replacement_product_id !== undefined) patch["replacement_product_id"] = data.replacement_product_id;
    if (data.courier_name !== undefined) patch["courier_name"] = data.courier_name || null;
    if (data.courier_tracking_id !== undefined) patch["courier_tracking_id"] = data.courier_tracking_id || null;
    if (!Object.keys(patch).length) return { id: data.id };
    const { error } = await context.supabase
      .from("returns")
      .update(patch as any)
      .eq("id", data.id)
      .eq("store_id", sid);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });


// ---------- ORDER TIMELINE + INTERNAL NOTES + INVOICE ----------
export const getOrderDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const [{ data: order }, { data: items }, { data: timeline }, { data: notes }, { data: store }] = await Promise.all([
      context.supabase.from("orders").select("*").eq("id", data.orderId).eq("store_id", sid).maybeSingle(),
      context.supabase.from("order_items").select("*, products(primary_image_url, sku)").eq("order_id", data.orderId),
      context.supabase.from("order_timeline").select("*").eq("order_id", data.orderId).order("created_at"),
      context.supabase.from("order_internal_notes").select("*").eq("order_id", data.orderId).order("created_at"),
      context.supabase.from("stores").select("name,phone,address,logo_url,whatsapp").eq("id", sid).maybeSingle(),
    ]);
    return { order, items: items ?? [], timeline: timeline ?? [], notes: notes ?? [], store };
  });

export const addInternalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ order_id: z.string().uuid(), body: z.string().trim().min(1).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { error } = await context.supabase.from("order_internal_notes").insert({
      store_id: sid, order_id: data.order_id, body: data.body, created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteInternalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { error } = await context.supabase.from("order_internal_notes").delete().eq("id", data.id).eq("store_id", sid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- CUSTOMER NOTES ----------
export const getCustomerNote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ phone: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return null;
    const { data: n } = await context.supabase
      .from("customer_notes")
      .select("*")
      .eq("store_id", sid)
      .eq("customer_phone", data.phone)
      .maybeSingle();
    return n;
  });

export const upsertCustomerNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      phone: z.string().min(1).max(40),
      tags: z.array(z.string().max(40)).max(20).default([]),
      note: z.string().max(2000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "customer_notes");
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { error } = await context.supabase.from("customer_notes").upsert({
      store_id: sid, customer_phone: data.phone, tags: data.tags, note: data.note ?? null,
    }, { onConflict: "store_id,customer_phone" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- BULK PRODUCT ACTIONS ----------
export const bulkUpdateProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      ids: z.array(z.string().uuid()).min(1).max(500),
      patch: z.object({
        category_id: z.string().uuid().nullable().optional(),
        price: z.number().nonnegative().optional(),
        stock: z.number().int().min(0).optional(),
        status: z.enum(["active", "draft", "out_of_stock"]).optional(),
      }),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "bulk_actions");
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { error } = await context.supabase.from("products").update(data.patch).in("id", data.ids).eq("store_id", sid);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });

export const bulkDeleteProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "bulk_actions");
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { error } = await context.supabase.from("products").delete().in("id", data.ids).eq("store_id", sid);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });

// ---------- IMPORT / EXPORT ----------
const IMPORT_ROW = z.object({
  name: z.string().min(1).max(200),
  price: z.number().nonnegative(),
  old_price: z.number().nonnegative().nullable().optional(),
  cost_price: z.number().nonnegative().nullable().optional(),
  stock: z.number().int().min(0).nullable().optional(),
  sku: z.string().max(60).nullable().optional(),
  product_code: z.string().max(60).nullable().optional(),
  status: z.enum(["active", "draft", "out_of_stock"]).nullable().optional(),
  description: z.string().max(10000).nullable().optional(),
  short_description: z.string().max(500).nullable().optional(),
  brand: z.string().max(120).nullable().optional(),
  category_slug: z.string().max(120).nullable().optional(),
  primary_image_url: z.string().max(1000).nullable().optional(),
  gallery: z.array(z.string()).nullable().optional(),
  video_url: z.string().max(1000).nullable().optional(),
  is_featured: z.boolean().nullable().optional(),
  low_stock_threshold: z.number().int().min(0).nullable().optional(),
  delivery_charge: z.number().nonnegative().nullable().optional(),
  delivery_time_days: z.string().max(60).nullable().optional(),
  warranty: z.string().max(500).nullable().optional(),
  return_policy: z.string().max(1000).nullable().optional(),
  shipping_info: z.string().max(1000).nullable().optional(),
});

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export const bulkImportProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      rows: z.array(IMPORT_ROW).min(1).max(500),
      mode: z.enum(["add", "update", "upsert"]).default("add"),
      matchKey: z.enum(["sku", "product_code"]).default("sku"),
      fileName: z.string().max(200).optional(),
      isFinalChunk: z.boolean().optional(),
      totalRows: z.number().int().min(0).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "import_export");
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");

    // Preload categories map (slug -> id)
    const { data: cats } = await context.supabase
      .from("categories").select("id,slug").eq("store_id", sid);
    const catMap = new Map<string, string>((cats ?? []).map((c: any) => [c.slug, c.id]));

    // Preload existing key set for the match key
    const key = data.matchKey;
    const keyVals = data.rows.map((r: any) => r[key]).filter((v) => v != null && v !== "");
    const existing = new Map<string, string>();
    if (keyVals.length) {
      const { data: found } = await context.supabase
        .from("products").select(`id,${key}`).eq("store_id", sid).in(key, keyVals);
      for (const r of found ?? []) existing.set(String((r as any)[key]), r.id);
    }

    let imported = 0, updated = 0, skipped = 0, failed = 0;
    const errors: { index: number; reason: string }[] = [];

    for (let i = 0; i < data.rows.length; i++) {
      const r = data.rows[i];
      try {
        const matchVal = (r as any)[key];
        const existId = matchVal ? existing.get(String(matchVal)) : undefined;

        const base: any = {
          name: r.name,
          price: r.price,
          old_price: r.old_price ?? null,
          cost_price: r.cost_price ?? 0,
          stock: r.stock ?? 0,
          sku: r.sku ?? null,
          product_code: r.product_code ?? null,
          status: r.status ?? "active",
          description: r.description ?? null,
          short_description: r.short_description ?? null,
          brand: r.brand ?? null,
          primary_image_url: r.primary_image_url ?? null,
          gallery: r.gallery ?? [],
          video_url: r.video_url ?? null,
          is_featured: r.is_featured ?? false,
          low_stock_threshold: r.low_stock_threshold ?? 5,
          delivery_charge: r.delivery_charge ?? null,
          delivery_time_days: r.delivery_time_days ?? null,
          warranty: r.warranty ?? null,
          return_policy: r.return_policy ?? null,
          shipping_info: r.shipping_info ?? null,
        };
        if (r.category_slug && catMap.has(r.category_slug)) {
          base.category_id = catMap.get(r.category_slug);
        }

        if (existId) {
          if (data.mode === "add") { skipped++; continue; }
          const { error } = await context.supabase
            .from("products").update(base).eq("id", existId).eq("store_id", sid);
          if (error) throw new Error(error.message);
          updated++;
        } else {
          if (data.mode === "update") { skipped++; continue; }
          const slug = slugify(r.name) + "-" + Math.random().toString(36).slice(2, 6);
          const { error } = await context.supabase
            .from("products").insert({ ...base, store_id: sid, slug });
          if (error) throw new Error(error.message);
          imported++;
        }
      } catch (e: any) {
        failed++;
        errors.push({ index: i, reason: e?.message ?? "Unknown error" });
      }
    }

    if (data.isFinalChunk) {
      await context.supabase.from("product_import_export_history").insert({
        store_id: sid,
        user_id: context.userId,
        kind: "import",
        file_name: data.fileName ?? null,
        format: null,
        total: data.totalRows ?? data.rows.length,
        imported, updated, skipped, failed,
        filters: { mode: data.mode, matchKey: data.matchKey },
      });
    }

    return { ok: true, imported, updated, skipped, failed, errors };
  });

export const exportProductsCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlan(context.supabase, context.userId, "import_export");
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return "";
    const { data } = await context.supabase
      .from("products")
      .select("name,sku,price,old_price,cost_price,stock,status,description")
      .eq("store_id", sid);
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["name", "sku", "price", "old_price", "cost_price", "stock", "status", "description"];
    const lines = [header.join(",")];
    for (const r of data ?? []) lines.push(header.map((h) => esc((r as any)[h])).join(","));
    return lines.join("\n");
  });

export const exportProductsFiltered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      columns: z.array(z.string()).min(1),
      filters: z.object({
        categoryIds: z.array(z.string().uuid()).optional(),
        brands: z.array(z.string()).optional(),
        stockStatus: z.enum(["all", "in_stock", "out_of_stock", "low_stock"]).optional(),
        status: z.enum(["all", "active", "draft", "out_of_stock"]).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      }).default({}),
      format: z.enum(["csv", "xlsx"]).default("csv"),
      fileName: z.string().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "import_export");
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return { header: data.columns, rows: [] };

    const selectCols = Array.from(new Set([...data.columns, "id"])).join(",");
    let q = context.supabase.from("products").select(selectCols).eq("store_id", sid);
    const f = data.filters;
    if (f.categoryIds?.length) q = q.in("category_id", f.categoryIds);
    if (f.brands?.length) q = q.in("brand", f.brands);
    if (f.status && f.status !== "all") q = q.eq("status", f.status);
    if (f.stockStatus === "in_stock") q = q.gt("stock", 0);
    if (f.stockStatus === "out_of_stock") q = q.eq("stock", 0);
    if (f.stockStatus === "low_stock") q = q.lte("stock", 5).gt("stock", 0);
    if (f.from) q = q.gte("created_at", f.from);
    if (f.to) q = q.lte("created_at", f.to);
    q = q.order("created_at", { ascending: false }).limit(10000);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const out = (rows ?? []).map((r: any) => {
      const obj: any = {};
      for (const c of data.columns) {
        const v = r[c];
        obj[c] = v && typeof v === "object" ? JSON.stringify(v) : v ?? "";
      }
      return obj;
    });

    await context.supabase.from("product_import_export_history").insert({
      store_id: sid,
      user_id: context.userId,
      kind: "export",
      file_name: data.fileName ?? null,
      format: data.format,
      total: out.length,
      imported: 0, updated: 0, skipped: 0, failed: 0,
      filters: data.filters,
    });

    return { header: data.columns, rows: out };
  });

export const getImportExportHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return { history: [], totalProducts: 0 };
    const [{ data: history }, { count }] = await Promise.all([
      context.supabase
        .from("product_import_export_history")
        .select("id,kind,file_name,format,total,imported,updated,skipped,failed,created_at,user_id")
        .eq("store_id", sid)
        .order("created_at", { ascending: false })
        .limit(20),
      context.supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", sid),
    ]);
    return { history: history ?? [], totalProducts: count ?? 0 };
  });

export const fetchGoogleSheetCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    const u = new URL(data.url);
    if (!/(^|\.)google\.com$/.test(u.hostname) && !/googleusercontent\.com$/.test(u.hostname)) {
      throw new Error("Only docs.google.com URLs are supported");
    }
    // Convert /edit URL to CSV export URL
    let csvUrl = data.url;
    const m = data.url.match(/\/spreadsheets\/d\/([^/]+)/);
    if (m) {
      const id = m[1];
      const gidMatch = data.url.match(/[#&?]gid=(\d+)/);
      const gid = gidMatch ? gidMatch[1] : "0";
      csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
    }
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`Failed to fetch sheet (HTTP ${res.status}). Make sure it's shared as "Anyone with the link".`);
    const text = await res.text();
    return { csv: text };
  });

export const listExportFacets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return { categories: [], brands: [] };
    const [{ data: cats }, { data: prods }] = await Promise.all([
      context.supabase.from("categories").select("id,name,slug").eq("store_id", sid).order("name"),
      context.supabase.from("products").select("brand").eq("store_id", sid).not("brand", "is", null),
    ]);
    const brands = Array.from(new Set((prods ?? []).map((p: any) => p.brand).filter(Boolean))).sort();
    return { categories: cats ?? [], brands };
  });

// ---------- ANALYTICS ----------
export const businessAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ product_type: z.enum(["physical", "digital", "service", "subscription"]).optional() })
      .parse(d ?? {}),
  )
  .handler(async ({ data: input, context }) => {
    await assertPlan(context.supabase, context.userId, "analytics");
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return null;
    const type = input?.product_type;
    let ordersQ = context.supabase
      .from("orders")
      .select("id,phone,subtotal,discount_amount,status,created_at")
      .eq("store_id", sid);
    if (type) ordersQ = ordersQ.eq("order_type", type);
    let itemsQ = context.supabase
      .from("order_items")
      .select("product_id,qty,name_snapshot,orders!inner(store_id,status,order_type)")
      .eq("orders.store_id", sid);
    if (type) itemsQ = itemsQ.eq("orders.order_type", type);
    const [{ data: orders }, { data: items }] = await Promise.all([ordersQ, itemsQ]);
    const live = (orders ?? []).filter((o) => o.status !== "cancelled");
    const totalSales = live.reduce((a, o) => a + Number(o.subtotal), 0);
    const totalOrders = live.length;
    const aov = totalOrders ? totalSales / totalOrders : 0;

    // product ranking
    const counter = new Map<string, { name: string; qty: number }>();
    for (const it of (items ?? []) as any[]) {
      if (it.orders?.status === "cancelled") continue;
      const k = it.product_id;
      const cur = counter.get(k) ?? { name: it.name_snapshot, qty: 0 };
      cur.qty += Number(it.qty);
      counter.set(k, cur);
    }
    const ranked = Array.from(counter.values()).sort((a, b) => b.qty - a.qty);

    // customers
    const phoneCount = new Map<string, number>();
    for (const o of live) phoneCount.set(o.phone, (phoneCount.get(o.phone) ?? 0) + 1);
    const newCustomers = Array.from(phoneCount.values()).filter((v) => v === 1).length;
    const returning = Array.from(phoneCount.values()).filter((v) => v > 1).length;

    // daily series (last 14 days)
    const days: { d: string; sales: number; orders: number }[] = [];
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 13);
    for (let i = 0; i < 14; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      days.push({ d: d.toISOString().slice(0, 10), sales: 0, orders: 0 });
    }
    const dayMap = new Map(days.map((x) => [x.d, x]));
    for (const o of live) {
      const k = new Date(o.created_at).toISOString().slice(0, 10);
      const row = dayMap.get(k);
      if (row) { row.sales += Number(o.subtotal); row.orders += 1; }
    }

    return {
      totalSales, totalOrders, aov,
      bestSellers: ranked.slice(0, 5),
      worstSellers: ranked.slice(-5).reverse(),
      newCustomers, returningCustomers: returning,
      series: days,
    };
  });
