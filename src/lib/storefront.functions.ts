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
    const { data: store, error } = await sb
      .from("stores")
      .select("id,slug,name,description,logo_url,phone,whatsapp,facebook,address,primary_color,header_color,title_bar_color,footer_color,button_color,bkash_number,nagad_number,status")
      .eq("slug", data.slug)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!store) return null;
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
      .select("id,name,slug,price,old_price,stock,status,primary_image_url,category_id")
      .eq("store_id", data.storeId)
      .neq("status", "draft")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (products ?? []).map((p) => ({ ...p, primary_image_url: imgUrl(p.primary_image_url) }));
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

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        storeId: z.string().uuid(),
        customerName: z.string().trim().min(1).max(120),
        phone: z.string().trim().min(5).max(40),
        address: z.string().trim().min(3).max(500),
        area: z.string().trim().max(120).optional(),
        paymentMethod: z.enum(["cod", "bkash", "nagad"]),
        txnId: z.string().trim().max(120).optional(),
        notes: z.string().trim().max(500).optional(),
        items: z.array(itemSchema).min(1).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    // Validate store + load products
    const { data: store } = await sb
      .from("stores")
      .select("id,status")
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
        subtotal,
        status: "pending",
      })
      .select("id")
      .single();
    if (oErr || !order) throw new Error(oErr?.message ?? "Order failed");

    const { error: iErr } = await sb
      .from("order_items")
      .insert(itemRows.map((r) => ({ ...r, order_id: order.id })));
    if (iErr) throw new Error(iErr.message);

    return { orderId: order.id };
  });

export const getOrder = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: order, error } = await sb
      .from("orders")
      .select("id,customer_name,phone,address,area,payment_method,txn_id,subtotal,status,created_at,store_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) return null;
    const { data: items } = await sb
      .from("order_items")
      .select("name_snapshot,price_snapshot,qty")
      .eq("order_id", order.id);
    return { ...order, items: items ?? [] };
  });
