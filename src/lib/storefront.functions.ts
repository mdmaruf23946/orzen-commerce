// Public server functions: storefront reads + guest checkout.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

function imgUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `/api/img/${path}`;
}

export const getStoreBySlug = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: row, error } = await sb.rpc("get_public_store_by_slug", { _slug: data.slug });
    if (error) throw new Error(error.message);
    if (!row) return null;
    const store = row as any;
    return { ...store, logo_url: imgUrl(store.logo_url) };
  });

export const listStoreBanners = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ storeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: banners, error } = await sb
      .from("banners")
      .select("id,image_url,link,position")
      .eq("store_id", data.storeId)
      .order("position", { ascending: true })
      .limit(3);
    if (error) throw new Error(error.message);
    return (banners ?? []).map((b) => ({ ...b, image_url: imgUrl(b.image_url)! }));
  });

export const listStoreProducts = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ storeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: products, error } = await sb
      .from("products")
      .select("id,name,slug,price,old_price,stock,status,primary_image_url,category_id,is_featured")
      .eq("store_id", data.storeId)
      .neq("status", "draft")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (products ?? []).map((p) => ({ ...p, primary_image_url: imgUrl(p.primary_image_url) }));
  });

export const listBestSellingProducts = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ storeId: z.string().uuid(), limit: z.number().int().min(1).max(24).optional() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const limit = data.limit ?? 12;
    const { data: rows, error } = await sb.rpc("get_store_bestsellers", {
      _store_id: data.storeId,
      _limit: limit,
    });
    if (error) throw new Error(error.message);
    const topIds = (rows ?? []).map((r: any) => r.product_id).filter(Boolean);
    if (topIds.length === 0) return [];
    const { data: products, error: pErr } = await sb
      .from("products")
      .select("id,name,slug,price,old_price,stock,status,primary_image_url,category_id,is_featured")
      .in("id", topIds)
      .eq("store_id", data.storeId)
      .neq("status", "draft");
    if (pErr) throw new Error(pErr.message);
    const order = new Map(topIds.map((id: string, i: number) => [id, i]));
    return (products ?? [])
      .map((p) => ({ ...p, primary_image_url: imgUrl(p.primary_image_url) }))
      .sort((a, b) => (order.get(a.id)! - order.get(b.id)!));
  });



export const listStoreCategories = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ storeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: cats, error } = await sb
      .from("categories")
      .select("id,name")
      .eq("store_id", data.storeId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return cats ?? [];
  });

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({ storeId: z.string().uuid(), productId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: p, error } = await sb
      .from("products")
      .select("id,name,slug,description,price,old_price,stock,status,primary_image_url,gallery,store_id")
      .eq("id", data.productId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) return null;
    const gallery = Array.isArray(p.gallery) ? (p.gallery as string[]) : [];
    return {
      ...p,
      primary_image_url: imgUrl(p.primary_image_url),
      gallery: gallery.map((g) => imgUrl(g)!).filter(Boolean),
    };
  });

const itemSchema = z.object({
  productId: z.string().uuid(),
  qty: z.number().int().min(1).max(99),
});

export const validateCoupon = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      storeId: z.string().uuid(),
      code: z.string().trim().min(1).max(40),
      subtotal: z.number().nonnegative(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: res, error } = await sb.rpc("validate_coupon", {
      _store_id: data.storeId,
      _code: data.code,
      _subtotal: data.subtotal,
    });
    if (error) return { ok: false as const, error: "Invalid coupon" };
    const r = res as any;
    if (!r || !r.ok) return { ok: false as const, error: r?.error ?? "Invalid coupon" };
    return {
      ok: true as const,
      couponId: r.couponId,
      code: r.code,
      type: r.type,
      discount: Number(r.discount ?? 0),
      freeShipping: !!r.freeShipping,
    };
  });

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        storeId: z.string().uuid(),
        customerName: z.string().trim().min(1).max(120),
        phone: z.string().trim().min(5).max(40),
        address: z.string().trim().min(3).max(500),
        area: z.string().trim().max(120).optional(),
        paymentMethod: z.enum(["cod", "bkash", "nagad", "rocket", "bank"]),
        txnId: z.string().trim().max(120).optional(),
        notes: z.string().trim().max(500).optional(),
        items: z.array(itemSchema).min(1).max(50),
        couponCode: z.string().trim().max(40).optional(),
        insideCity: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    // Use service-role admin client so writes bypass RLS; all pricing is
    // recomputed server-side below from trusted product/coupon rows.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin;
    const { data: store } = await sb
      .from("stores")
      .select("id,status,delivery")
      .eq("id", data.storeId)
      .maybeSingle();
    if (!store || store.status !== "active") throw new Error("Store unavailable");

    const ids = data.items.map((i) => i.productId);
    const { data: products, error: pErr } = await sb
      .from("products")
      .select("id,name,price,stock,status")
      .in("id", ids)
      .eq("store_id", data.storeId);
    if (pErr) throw new Error(pErr.message);
    const byId = new Map(products?.map((p) => [p.id, p]) ?? []);

    let subtotal = 0;
    const itemRows = data.items.map((i) => {
      const p = byId.get(i.productId);
      if (!p || p.status === "draft") throw new Error("Product unavailable");
      if (p.stock < i.qty) throw new Error(`Not enough stock for ${p.name}`);
      subtotal += Number(p.price) * i.qty;
      return {
        product_id: p.id,
        name_snapshot: p.name,
        price_snapshot: p.price,
        qty: i.qty,
      };
    });

    // Delivery
    const d: any = store.delivery ?? {};
    const insideCity = data.insideCity ?? true;
    const baseShip = Number((insideCity ? d.inside_city : d.outside_city) ?? 0);
    const freeMin = Number(d.free_min ?? 0);
    let delivery_amount = freeMin > 0 && subtotal >= freeMin ? 0 : baseShip;

    // Coupon
    let coupon_id: string | null = null;
    let discount_amount = 0;
    if (data.couponCode) {
      const { data: c } = await sb
        .from("coupons")
        .select("id,code,type,value,min_order,usage_limit,used_count,expires_at,active")
        .eq("store_id", data.storeId)
        .eq("code", data.couponCode.toUpperCase())
        .maybeSingle();
      if (c && c.active && (!c.expires_at || new Date(c.expires_at) >= new Date()) &&
          (c.usage_limit == null || c.used_count < c.usage_limit) &&
          subtotal >= Number(c.min_order ?? 0)) {
        coupon_id = c.id;
        if (c.type === "percent") discount_amount = Math.round(subtotal * Number(c.value) / 100);
        else if (c.type === "fixed") discount_amount = Math.min(Number(c.value), subtotal);
        else if (c.type === "free_shipping") delivery_amount = 0;
      }
    }

    const { data: order, error: oErr } = await sb
      .from("orders")
      .insert({
        store_id: data.storeId,
        customer_name: data.customerName,
        phone: data.phone,
        address: data.address,
        area: data.area ?? null,
        payment_method: data.paymentMethod,
        txn_id: data.txnId ?? null,
        notes: data.notes ?? null,
        subtotal: subtotal + delivery_amount - discount_amount,
        delivery_amount,
        discount_amount,
        coupon_id,
        status: "pending",
      })
      .select("id")
      .single();
    if (oErr || !order) throw new Error(oErr?.message ?? "Order failed");

    const { error: iErr } = await sb
      .from("order_items")
      .insert(itemRows.map((r) => ({ ...r, order_id: order.id })));
    if (iErr) throw new Error(iErr.message);

    if (coupon_id) {
      await sb.from("coupon_redemptions").insert({
        coupon_id, store_id: data.storeId, order_id: order.id,
        customer_phone: data.phone, discount_amount,
      });
      // best-effort increment
      const { data: c2 } = await sb.from("coupons").select("used_count").eq("id", coupon_id).maybeSingle();
      if (c2) await sb.from("coupons").update({ used_count: (c2.used_count ?? 0) + 1 }).eq("id", coupon_id);
    }

    return { orderId: order.id };
  });


export const getOrder = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: row, error } = await sb.rpc("get_public_order", { _order_id: data.orderId });
    if (error) throw new Error(error.message);
    if (!row) return null;
    return row as any;
  });

