// Authenticated server functions for the store-owner (user) admin.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertPlan } from "@/lib/plan-guard";
import {
  fetchTemplate,
  templateStoreFields,
  seedStoreFromTemplate,
  wipeStoreChildren,
} from "@/lib/store-template";

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
      const tpl = await fetchTemplate(supabase);
      const tplFields = templateStoreFields(tpl);
      const { data: created, error } = await supabase
        .from("stores")
        .insert({
          owner_user_id: userId,
          slug,
          name: `${base.charAt(0).toUpperCase() + base.slice(1)}'s Store`,
          status: "active",
          ...tplFields,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      if (tpl && created?.id) {
        try {
          await seedStoreFromTemplate(supabase, created.id, tpl);
        } catch {
          // Non-fatal: store still exists; owner can Reset to Default later.
        }
      }
      store = created;
    }
    return store;
  });

// Reset the current owner's store to the latest global template.
// Wipes categories/products/banners and reseeds. Overwrites design/theme/etc.
export const resetStoreToTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!store) throw new Error("No store");
    const tpl = await fetchTemplate(supabase);
    if (!tpl) throw new Error("No default template configured");
    await wipeStoreChildren(supabase, store.id);
    const { error: upErr } = await supabase
      .from("stores")
      .update(templateStoreFields(tpl))
      .eq("id", store.id);
    if (upErr) throw new Error(upErr.message);
    await seedStoreFromTemplate(supabase, store.id, tpl);
    return { ok: true };
  });

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers, and hyphens only");

// Public: check whether a store subdomain slug is already taken.
export const checkStoreSlugAvailable = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: slugSchema }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const url = process.env.SUPABASE_URL!;
    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: res, error } = await sb.rpc("is_slug_taken", { _slug: data.slug });
    if (error) throw new Error(error.message);
    return { available: !res };
  });

// Authenticated: create the current user's store using a chosen slug + name,
// applying the global default template. Idempotent: returns existing store if any.
export const createMyStoreWithSlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeName: z.string().trim().min(2).max(80),
        slug: slugSchema,
        ownerName: z.string().trim().min(2).max(80),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("stores")
      .select("*")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (existing) return existing;

    const { data: taken } = await supabase.rpc("is_slug_taken", { _slug: data.slug });
    if (taken) throw new Error("Subdomain already taken");

    const tpl = await fetchTemplate(supabase);
    const tplFields = templateStoreFields(tpl);
    const { data: created, error } = await supabase
      .from("stores")
      .insert({
        owner_user_id: userId,
        slug: data.slug,
        name: data.storeName,
        status: "active",
        ...tplFields,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (tpl && created?.id) {
      try {
        await seedStoreFromTemplate(supabase, created.id, tpl);
      } catch {
        // Non-fatal
      }
    }
    try {
      await supabase.auth.updateUser({ data: { owner_name: data.ownerName } });
    } catch {
      // Non-fatal
    }
    return created;
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
  cost_price: z.number().nonnegative().optional().nullable(),
  low_stock_threshold: z.number().int().min(0).optional().nullable(),
  sku: z.string().trim().max(60).optional().nullable(),
  stock: z.number().int().min(0),
  status: z.enum(["active", "draft", "out_of_stock"]),
  primary_image_url: z.string().max(500).optional().nullable(),
  gallery: z.array(z.string().max(500)).max(8).optional().default([]),
  category_id: z.string().uuid().optional().nullable(),
  warranty: z.string().trim().max(2000).optional().nullable(),
  return_policy: z.string().trim().max(2000).optional().nullable(),
  shipping_info: z.string().trim().max(2000).optional().nullable(),
  is_featured: z.boolean().optional().default(false),
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
      cost_price: data.cost_price ?? 0,
      low_stock_threshold: data.low_stock_threshold ?? 5,
      sku: data.sku ?? null,
      stock: data.stock,
      status: data.status,
      primary_image_url: data.primary_image_url ?? null,
      gallery: data.gallery ?? [],
      category_id: data.category_id ?? null,
      warranty: data.warranty ?? null,
      return_policy: data.return_policy ?? null,
      shipping_info: data.shipping_info ?? null,
      is_featured: data.is_featured ?? false,
    } as any;


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
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "pixel");
    return updateStoreColumn(context.supabase, context.userId, "marketing", data);
  });

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
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "courier");
    return updateStoreColumn(context.supabase, context.userId, "couriers", data);
  });

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

// ---------- DASHBOARD OVERVIEW (redesign) ----------
export const myDashboardOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const { data: store } = await supabase
      .from("stores")
      .select("id,name,slug,status,subscription_status,expires_at,updated_at,package_id,subscription_packages(name)")
      .eq("owner_user_id", userId)
      .maybeSingle();

    const ownerName =
      (claims.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name ??
      (claims.user_metadata as { name?: string } | undefined)?.name ??
      (claims.email as string | undefined)?.split("@")[0] ??
      "there";

    if (!store) {
      return {
        store: null,
        owner: { name: ownerName },
        today: { sales: 0, orders: 0, visitors: 0, pendingOrders: 0, salesPct: 0, ordersPct: 0 },
        visitorsAvailable: false,
        series: { "7d": [], "30d": [], today: [], month: [] },
        orderStatus: { pending: 0, confirmed: 0, processing: 0, delivered: 0, cancelled: 0, returned: 0 },
        products: { total: 0, active: 0, lowStock: 0, outOfStock: 0 },
        performance: { conversionRate: 0, healthScore: 0, customerRating: null as number | null },
        recentOrders: [] as any[],
        notifications: [] as any[],
      };
    }

    const now = new Date();
    const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
    const today0 = startOfDay(now);
    const yest0 = new Date(today0); yest0.setDate(yest0.getDate() - 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const d30 = new Date(now); d30.setDate(d30.getDate() - 29); d30.setHours(0,0,0,0);
    const windowStart = d30 < monthStart ? d30 : monthStart;

    const [ordersRes, productsRes, bannersRes, feedbackRes] = await Promise.all([
      supabase.from("orders")
        .select("id,invoice_no,customer_name,subtotal,status,created_at")
        .eq("store_id", store.id)
        .gte("created_at", new Date(yest0.getTime() - 24*3600*1000).toISOString())
        .order("created_at", { ascending: false }),
      supabase.from("products")
        .select("id,name,stock,low_stock_threshold,status")
        .eq("store_id", store.id),
      supabase.from("banners").select("id", { count: "exact", head: true }).eq("store_id", store.id),
      supabase.from("feedback").select("rating").eq("store_id", store.id).limit(500),
    ]);

    // Also pull all-time counts by status (cheap head:count queries)
    const statuses = ["pending","confirmed","processing","delivered","cancelled","returned"] as const;
    const statusCounts: Record<string, number> = { pending:0, confirmed:0, processing:0, delivered:0, cancelled:0, returned:0 };
    await Promise.all(statuses.map(async (s) => {
      const { count } = await supabase.from("orders")
        .select("*", { count: "exact", head: true })
        .eq("store_id", store.id)
        .eq("status", s as any);
      statusCounts[s] = count ?? 0;
    }));

    const orders = ordersRes.data ?? [];
    // Today / yesterday
    let todaySales = 0, todayOrders = 0, todayPending = 0;
    let yestSales = 0, yestOrders = 0;
    for (const o of orders) {
      const t = new Date(o.created_at);
      const amt = Number(o.subtotal) || 0;
      if (t >= today0) {
        if (o.status !== "cancelled") { todaySales += amt; todayOrders++; }
        if (o.status === "pending") todayPending++;
      } else if (t >= yest0 && t < today0) {
        if (o.status !== "cancelled") { yestSales += amt; yestOrders++; }
      }
    }
    const pct = (a: number, b: number) => b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100);

    // Build series over the last 30 days from windowStart-window orders
    const { data: seriesRows } = await supabase.from("orders")
      .select("subtotal,status,created_at")
      .eq("store_id", store.id)
      .gte("created_at", windowStart.toISOString());
    type Point = { date: string; sales: number; orders: number; revenue: number };
    const buckets: Record<string, Point> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(today0); d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { date: key, sales: 0, orders: 0, revenue: 0 };
    }
    for (const r of seriesRows ?? []) {
      const key = new Date(r.created_at).toISOString().slice(0, 10);
      if (!buckets[key]) continue;
      if (r.status === "cancelled") continue;
      const amt = Number(r.subtotal) || 0;
      buckets[key].sales += amt;
      buckets[key].orders += 1;
      if (r.status === "delivered") buckets[key].revenue += amt;
    }
    const all30 = Object.values(buckets);
    const today1 = all30.slice(-1);
    const last7 = all30.slice(-7);
    const monthArr = all30.filter((p) => new Date(p.date) >= monthStart);

    // Products
    const products = productsRes.data ?? [];
    const productSummary = {
      total: products.length,
      active: products.filter((p) => p.status === "active").length,
      lowStock: products.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.low_stock_threshold ?? 5)).length,
      outOfStock: products.filter((p) => (p.stock ?? 0) === 0).length,
    };

    // Performance
    const ratings = (feedbackRes.data ?? []).map((f: any) => Number(f.rating)).filter((n) => !isNaN(n));
    const customerRating = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;
    const has = {
      products: productSummary.total > 0 ? 25 : 0,
      banner: (bannersRes.count ?? 0) > 0 ? 15 : 0,
      subActive: store.subscription_status === "active" || store.subscription_status === "trialing" ? 25 : 0,
      recentOrders: (last7.reduce((a, b) => a + b.orders, 0) > 0 ? 20 : 0),
      lowStockPenalty: productSummary.total > 0 ? Math.round(15 * (1 - Math.min(1, productSummary.outOfStock / Math.max(1, productSummary.total)))) : 0,
    };
    const healthScore = Math.min(100, has.products + has.banner + has.subActive + has.recentOrders + has.lowStockPenalty);
    const conversionRate = 0; // no visitors data available

    // Recent orders
    const recentOrders = orders.slice(0, 5).map((o) => ({
      id: o.id,
      order_number: o.invoice_no ?? o.id.slice(0, 8),
      customer_name: o.customer_name,
      subtotal: Number(o.subtotal) || 0,
      status: o.status,
      created_at: o.created_at,
    }));

    // Notifications
    const notifications: { type: string; title: string; detail: string; at: string }[] = [];
    const newOrders = orders.filter((o) => new Date(o.created_at) >= new Date(now.getTime() - 24*3600*1000));
    if (newOrders[0]) {
      notifications.push({
        type: "order",
        title: `New order from ${newOrders[0].customer_name}`,
        detail: `৳${(Number(newOrders[0].subtotal) || 0).toFixed(0)} · ${newOrders[0].status}`,
        at: newOrders[0].created_at,
      });
    }
    const lowSample = products.find((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.low_stock_threshold ?? 5));
    if (productSummary.lowStock > 0 && lowSample) {
      notifications.push({
        type: "low-stock",
        title: `${productSummary.lowStock} product${productSummary.lowStock > 1 ? "s" : ""} low on stock`,
        detail: `e.g. ${lowSample.name} · ${lowSample.stock} left`,
        at: new Date().toISOString(),
      });
    }
    if (store.expires_at) {
      const days = Math.ceil((new Date(store.expires_at).getTime() - now.getTime()) / (24*3600*1000));
      if (days <= 7) {
        notifications.push({
          type: "subscription",
          title: days <= 0 ? "Subscription expired" : `Subscription expires in ${days} day${days > 1 ? "s" : ""}`,
          detail: "Renew to keep your store active",
          at: store.expires_at,
        });
      }
    }

    return {
      store: {
        name: store.name,
        slug: store.slug,
        status: store.status,
        subscription_status: store.subscription_status,
        expires_at: store.expires_at,
        updated_at: store.updated_at,
        package_name: (store as any).subscription_packages?.name ?? null,
      },
      owner: { name: ownerName },
      today: {
        sales: todaySales,
        orders: todayOrders,
        visitors: 0,
        pendingOrders: todayPending,
        salesPct: pct(todaySales, yestSales),
        ordersPct: pct(todayOrders, yestOrders),
      },
      visitorsAvailable: false,
      series: {
        today: today1,
        "7d": last7,
        "30d": all30,
        month: monthArr,
      },
      orderStatus: statusCounts as { pending:number; confirmed:number; processing:number; delivered:number; cancelled:number; returned:number },
      products: productSummary,
      performance: { conversionRate, healthScore, customerRating },
      recentOrders,
      notifications: notifications.slice(0, 3),
    };
  });
