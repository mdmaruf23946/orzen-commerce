// Authenticated server functions for the store-owner (user) admin.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

// Get the current user's store (auto-create if missing).
export const getMyStore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    let { data: store } = await supabase
      .from("stores")
      .select("*")
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (!store) {
      const email = (claims.email as string | undefined) ?? "store";
      const base = slugify(email.split("@")[0]) || "store";
      let slug = base;
      // ensure unique
      for (let i = 0; i < 10; i++) {
        const { data: existing } = await supabase
          .from("stores")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (!existing) break;
        slug = `${base}-${Math.floor(Math.random() * 9999)}`;
      }
      const { data: created, error } = await supabase
        .from("stores")
        .insert({
          owner_user_id: userId,
          slug,
          name: `${base.charAt(0).toUpperCase() + base.slice(1)}'s Store`,
          status: "active",
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      store = created;
    }
    return store;
  });

export const updateMyStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens"),
        description: z.string().trim().max(1000).optional().nullable(),
        logo_url: z.string().max(500).optional().nullable(),
        phone: z.string().trim().max(40).optional().nullable(),
        whatsapp: z.string().trim().max(40).optional().nullable(),
        facebook: z.string().trim().max(200).optional().nullable(),
        address: z.string().trim().max(500).optional().nullable(),
        primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        header_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
        title_bar_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
        footer_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
        button_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
        bkash_number: z.string().trim().max(40).optional().nullable(),
        nagad_number: z.string().trim().max(40).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: updated, error } = await supabase
      .from("stores")
      .update(data)
      .eq("owner_user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

// ---------- PRODUCTS ----------
export const listMyProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
    if (!store) return [];
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const productSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).optional().nullable(),
  price: z.number().nonnegative(),
  old_price: z.number().nonnegative().optional().nullable(),
  stock: z.number().int().min(0),
  status: z.enum(["active", "draft", "out_of_stock"]),
  primary_image_url: z.string().max(500).optional().nullable(),
  gallery: z.array(z.string().max(500)).max(8).optional().default([]),
  category_id: z.string().uuid().optional().nullable(),
});

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ id: z.string().uuid().optional() })
      .merge(productSchema)
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
    if (!store) throw new Error("No store");
    const baseFields = {
      name: data.name,
      description: data.description ?? null,
      price: data.price,
      old_price: data.old_price ?? null,
      stock: data.stock,
      status: data.status,
      primary_image_url: data.primary_image_url ?? null,
      gallery: data.gallery ?? [],
      category_id: data.category_id ?? null,
    };
    if (data.id) {
      const { error } = await supabase
        .from("products")
        .update(baseFields)
        .eq("id", data.id)
        .eq("store_id", store.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const slug = slugify(data.name) + "-" + Math.random().toString(36).slice(2, 6);
    const { data: created, error } = await supabase
      .from("products")
      .insert({ ...baseFields, store_id: store.id, slug })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
    if (!store) throw new Error("No store");
    const { error } = await supabase.from("products").delete().eq("id", data.id).eq("store_id", store.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- ORDERS ----------
export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
    if (!store) return [];
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(name_snapshot,price_snapshot,qty)")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "confirmed", "processing", "delivered", "cancelled"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
    if (!store) throw new Error("No store");
    const { error } = await supabase
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("store_id", store.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- BANNERS ----------
export const listMyBanners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
    if (!store) return [];
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .eq("store_id", store.id)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ image_url: z.string().min(1), link: z.string().max(500).optional().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
    if (!store) throw new Error("No store");
    const { count } = await supabase
      .from("banners")
      .select("*", { count: "exact", head: true })
      .eq("store_id", store.id);
    if ((count ?? 0) >= 3) throw new Error("Maximum 3 banners");
    const { error } = await supabase.from("banners").insert({
      store_id: store.id,
      image_url: data.image_url,
      link: data.link ?? null,
      position: (count ?? 0) + 1,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
    if (!store) throw new Error("No store");
    const { error } = await supabase.from("banners").delete().eq("id", data.id).eq("store_id", store.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- CUSTOMERS (derived) ----------
export const listMyCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
    if (!store) return [];
    const { data, error } = await supabase
      .from("orders")
      .select("customer_name,phone,address,subtotal,created_at")
      .eq("store_id", store.id);
    if (error) throw new Error(error.message);
    const map = new Map<string, { name: string; phone: string; orders: number; total: number; last: string }>();
    for (const o of data ?? []) {
      const k = o.phone;
      const cur = map.get(k) ?? { name: o.customer_name, phone: o.phone, orders: 0, total: 0, last: o.created_at };
      cur.orders += 1;
      cur.total += Number(o.subtotal);
      if (o.created_at > cur.last) cur.last = o.created_at;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => (a.last < b.last ? 1 : -1));
  });

// ---------- DASHBOARD ----------
export const myDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
    if (!store) return { todaySales: 0, totalSales: 0, totalOrders: 0, totalProducts: 0 };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [{ data: orders }, { count: productCount }] = await Promise.all([
      supabase.from("orders").select("subtotal,created_at,status").eq("store_id", store.id),
      supabase.from("products").select("*", { count: "exact", head: true }).eq("store_id", store.id),
    ]);
    let todaySales = 0;
    let totalSales = 0;
    let totalOrders = 0;
    for (const o of orders ?? []) {
      if (o.status === "cancelled") continue;
      totalOrders++;
      totalSales += Number(o.subtotal);
      if (new Date(o.created_at) >= today) todaySales += Number(o.subtotal);
    }
    return { todaySales, totalSales, totalOrders, totalProducts: productCount ?? 0 };
  });

// ---------- SUBSCRIPTION ----------
export const mySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase
      .from("stores")
      .select("expires_at,package_id, subscription_packages(name,price,duration_days,product_limit)")
      .eq("owner_user_id", userId)
      .maybeSingle();
    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    return { store, payments: payments ?? [] };
  });

// ---------- CATEGORIES ----------
export const listMyCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
    if (!store) return [];
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("store_id", store.id)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(80),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
    if (!store) throw new Error("No store");
    if (data.id) {
      const { error } = await supabase
        .from("categories")
        .update({ name: data.name })
        .eq("id", data.id)
        .eq("store_id", store.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabase
      .from("categories")
      .insert({ store_id: store.id, name: data.name })
      .select("id,name,store_id")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
    if (!store) throw new Error("No store");
    const { error } = await supabase.from("categories").delete().eq("id", data.id).eq("store_id", store.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- SETTINGS SECTIONS (jsonb blobs on stores) ----------
async function updateStoreColumn(
  supabase: any,
  userId: string,
  column: string,
  value: unknown,
) {
  const { error } = await supabase
    .from("stores")
    .update({ [column]: value })
    .eq("owner_user_id", userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

const marketingSchema = z.object({
  fb_pixel_id: z.string().trim().max(60).optional().nullable(),
  fb_capi_token: z.string().trim().max(300).optional().nullable(),
  fb_capi_enabled: z.boolean().optional(),
  ga4_id: z.string().trim().max(40).optional().nullable(),
  gtm_id: z.string().trim().max(40).optional().nullable(),
  tiktok_pixel_id: z.string().trim().max(60).optional().nullable(),
  enabled: z
    .object({
      fb_pixel: z.boolean().optional(),
      ga4: z.boolean().optional(),
      gtm: z.boolean().optional(),
      tiktok: z.boolean().optional(),
    })
    .optional(),
});

export const updateMarketing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => marketingSchema.parse(d))
  .handler(async ({ data, context }) =>
    updateStoreColumn(context.supabase, context.userId, "marketing", data),
  );

const courierProvider = z.object({
  api_key: z.string().trim().max(300).optional().nullable(),
  secret: z.string().trim().max(300).optional().nullable(),
  base_url: z.string().trim().max(300).optional().nullable(),
  enabled: z.boolean().optional(),
});
const couriersSchema = z.object({
  steadfast: courierProvider.optional(),
  pathao: courierProvider.optional(),
  redx: courierProvider.optional(),
  paperfly: courierProvider.optional(),
});

export const updateCouriers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => couriersSchema.parse(d))
  .handler(async ({ data, context }) =>
    updateStoreColumn(context.supabase, context.userId, "couriers", data),
  );

const seoSchema = z.object({
  title: z.string().trim().max(160).optional().nullable(),
  description: z.string().trim().max(320).optional().nullable(),
  keywords: z.string().trim().max(300).optional().nullable(),
  og_image_url: z.string().max(500).optional().nullable(),
  favicon_url: z.string().max(500).optional().nullable(),
});
export const updateSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => seoSchema.parse(d))
  .handler(async ({ data, context }) =>
    updateStoreColumn(context.supabase, context.userId, "seo", data),
  );

const deliverySchema = z.object({
  inside_city: z.number().nonnegative().optional(),
  outside_city: z.number().nonnegative().optional(),
  free_min: z.number().nonnegative().optional(),
  cod_enabled: z.boolean().optional(),
});
export const updateDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => deliverySchema.parse(d))
  .handler(async ({ data, context }) =>
    updateStoreColumn(context.supabase, context.userId, "delivery", data),
  );

const paymentMethod = z.object({
  enabled: z.boolean().optional(),
  number: z.string().trim().max(60).optional().nullable(),
});
const paymentsSchema = z.object({
  cod: z.object({ enabled: z.boolean().optional() }).optional(),
  bkash: paymentMethod.optional(),
  nagad: paymentMethod.optional(),
  rocket: paymentMethod.optional(),
  bank: z
    .object({
      enabled: z.boolean().optional(),
      name: z.string().trim().max(120).optional().nullable(),
      account: z.string().trim().max(60).optional().nullable(),
      branch: z.string().trim().max(120).optional().nullable(),
    })
    .optional(),
  instructions: z.string().trim().max(1000).optional().nullable(),
});
export const updatePayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => paymentsSchema.parse(d))
  .handler(async ({ data, context }) =>
    updateStoreColumn(context.supabase, context.userId, "payments_config", data),
  );

const notificationsSchema = z.object({
  whatsapp: z.string().trim().max(40).optional().nullable(),
  email_enabled: z.boolean().optional(),
  sms_api_placeholder: z.string().trim().max(300).optional().nullable(),
});
export const updateNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => notificationsSchema.parse(d))
  .handler(async ({ data, context }) =>
    updateStoreColumn(context.supabase, context.userId, "notifications", data),
  );

const productDefaultsSchema = z.object({
  warranty: z.string().trim().max(2000).optional().nullable(),
  return_policy: z.string().trim().max(2000).optional().nullable(),
  shipping_info: z.string().trim().max(2000).optional().nullable(),
});
export const updateProductDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => productDefaultsSchema.parse(d))
  .handler(async ({ data, context }) =>
    updateStoreColumn(context.supabase, context.userId, "product_defaults", data),
  );

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const themeSchema = z.object({
  header_color: hex.optional().nullable(),
  footer_color: hex.optional().nullable(),
  title_bar_color: hex.optional().nullable(),
  button_color: hex.optional().nullable(),
  radius: z.number().int().min(0).max(24).optional(),
});
export const updateTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => themeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Mirror colors into existing columns for backward compatibility, store full theme blob (incl radius).
    const colorUpdates: Record<string, unknown> = {};
    for (const k of ["header_color", "footer_color", "title_bar_color", "button_color"] as const) {
      if (k in data && data[k] !== undefined) colorUpdates[k] = data[k] ?? null;
    }
    const { error } = await supabase
      .from("stores")
      .update({ ...colorUpdates, theme: data })
      .eq("owner_user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
