// Authenticated server functions for the store-owner (user) admin.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertPlan, assertLimit } from "@/lib/plan-guard";
import { myStoreRow } from "@/lib/store-access";
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

// Get the current user's store.
// Owners: auto-create on first login. Employees: resolve their employer's store
// (never create a new one for a staff account).
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
      // Employee account? Return the store they belong to.
      const { resolveStoreAccess } = await import("@/lib/store-access");
      const access = await resolveStoreAccess(supabase, userId);
      if (access.storeId && !access.isOwner) {
        const { data: staffStore, error: staffErr } = await supabase
          .from("stores")
          .select("*")
          .eq("id", access.storeId)
          .maybeSingle();
        if (staffErr) throw new Error(staffErr.message);
        if (!staffStore) throw new Error("Your store could not be found. Contact the store owner.");
        return staffStore;
      }
      // Linked as staff but not active — never create a stray store for them.
      const { data: anyStaff } = await supabase
        .from("store_staff")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (anyStaff) {
        throw new Error("Your employee account is not active. Contact the store owner.");
      }
    }

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
          theme_id: await defaultThemeId(supabase),
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

// Winner Admin picks one catalog theme as the default for every new store.
async function defaultThemeId(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from("store_themes")
    .select("id")
    .eq("is_default", true)
    .maybeSingle();
  if (data?.id) return data.id as string;
  const { data: first } = await supabase
    .from("store_themes")
    .select("id")
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (first?.id as string) ?? null;
}

// Reset the current owner's store to the latest global template.
// Wipes categories/products/banners and reseeds. Overwrites design/theme/etc.
export const resetStoreToTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const store = await myStoreRow(supabase, userId, "id");
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
    const existing = await myStoreRow(supabase, userId, "*");
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
        theme_id: await defaultThemeId(supabase),
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
        name_logo_url: z.string().max(500).optional().nullable(),
        phone: z.string().trim().max(40).optional().nullable(),
        whatsapp: z.string().trim().max(40).optional().nullable(),
        email: z.string().trim().max(200).email().optional().nullable().or(z.literal("")),
        facebook: z.string().trim().max(200).optional().nullable(),
        instagram: z.string().trim().max(200).optional().nullable(),
        youtube: z.string().trim().max(200).optional().nullable(),
        tiktok: z.string().trim().max(200).optional().nullable(),
        linkedin: z.string().trim().max(200).optional().nullable(),
        website: z.string().trim().max(200).optional().nullable(),
        messenger: z.string().trim().max(200).optional().nullable(),
        telegram: z.string().trim().max(200).optional().nullable(),
        address: z.string().trim().max(500).optional().nullable(),
        primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        header_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
        title_bar_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
        footer_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
        button_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
        bkash_number: z.string().trim().max(40).optional().nullable(),
        nagad_number: z.string().trim().max(40).optional().nullable(),
        business_name: z.string().trim().max(160).optional().nullable(),
        owner_name: z.string().trim().max(120).optional().nullable(),
        trade_license: z.string().trim().max(80).optional().nullable(),
        tax_number: z.string().trim().max(80).optional().nullable(),
        currency: z.string().trim().min(2).max(8).optional(),
        language: z.string().trim().min(2).max(8).optional(),
        timezone: z.string().trim().max(60).optional(),
        allow_guest_checkout: z.boolean().optional(),
        storefront_lang_switcher: z.boolean().optional(),
        storefront_default_lang: z.enum(["en", "bn"]).optional(),

        icon_url: z.string().max(500).optional().nullable(),
        favicon_url: z.string().max(500).optional().nullable(),
        custom_favicon_url: z.string().max(500).optional().nullable(),
        use_icon_as_favicon: z.boolean().optional(),
        branding: z
          .object({
            source: z.enum(["platform", "custom"]).optional(),
            mode: z.enum(["logo", "wordmark", "both"]).optional(),
            logo_url: z.string().max(1000).optional().nullable(),
            wordmark_url: z.string().max(1000).optional().nullable(),
            name: z.string().max(120).optional().nullable(),
          })
          .partial()
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Auto-derive favicon_url from icon/custom based on toggle.
    const patch: any = { ...data };
    if (patch.use_icon_as_favicon !== false) {
      patch.favicon_url = patch.icon_url ?? null;
    } else {
      patch.favicon_url = patch.custom_favicon_url ?? patch.icon_url ?? null;
    }
    const { data: updated, error } = await supabase
      .from("stores")
      .update(patch as any)
      .eq("owner_user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    // Refresh generated legal pages so store name / phone / address stay in sync,
    // without changing their public URLs.
    try {
      const { autoRegenerateLegalIfNeeded } = await import("@/lib/legal.functions");
      await autoRegenerateLegalIfNeeded(supabase, updated.id);
    } catch {}
    return updated;
  });

// ---------- PRODUCTS ----------
export const listMyProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ product_type: z.enum(["physical", "digital", "service", "subscription"]).optional() })
      .parse(d ?? {}),
  )
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const store = await myStoreRow(supabase, userId, "id");
    if (!store) return [];
    let q = supabase.from("products").select("*").eq("store_id", store.id);
    if (input?.product_type) q = q.eq("product_type", input.product_type);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];

    // ---- live metrics: digital downloads + active subscribers ----
    const downloads = new Map<string, number>();
    const subscribers = new Map<string, number>();

    const hasDigital = rows.some((p: any) => p.product_type === "digital");
    const hasSubscription = rows.some((p: any) => p.product_type === "subscription");

    if (hasDigital) {
      const { data: ents } = await supabase
        .from("digital_entitlements")
        .select("product_id, download_count")
        .eq("store_id", store.id);
      for (const e of ents ?? []) {
        downloads.set(e.product_id, (downloads.get(e.product_id) ?? 0) + (e.download_count ?? 0));
      }
    }

    if (hasSubscription) {
      const { data: subOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("store_id", store.id)
        .eq("order_type", "subscription")
        .eq("confirmation_status", "confirmed")
        .not("status", "in", "(cancelled)");
      const ids = (subOrders ?? []).map((o: any) => o.id);
      if (ids.length) {
        const { data: items } = await supabase
          .from("order_items")
          .select("product_id")
          .in("order_id", ids);
        for (const it of items ?? []) {
          if (!it.product_id) continue;
          subscribers.set(it.product_id, (subscribers.get(it.product_id) ?? 0) + 1);
        }
      }
    }

    return rows.map((p: any) => ({
      ...p,
      download_count: downloads.get(p.id) ?? 0,
      active_subscribers: subscribers.get(p.id) ?? 0,
    }));
  });


const productSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).optional().nullable(),
  short_description: z.string().trim().max(500).optional().nullable(),
  brand: z.string().trim().max(80).optional().nullable(),
  product_code: z.string().trim().max(60).optional().nullable(),
  price: z.number().nonnegative(),
  old_price: z.number().nonnegative().optional().nullable(),
  cost_price: z.number().nonnegative().optional().nullable(),
  low_stock_threshold: z.number().int().min(0).optional().nullable(),
  sku: z.string().trim().max(60).optional().nullable(),
  stock: z.number().int().min(0),
  status: z.enum(["active", "draft", "out_of_stock"]),
  primary_image_url: z.string().max(500).optional().nullable(),
  gallery: z.array(z.string().max(500)).max(20).optional().default([]),
  video_url: z.string().trim().max(500).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  warranty: z.string().trim().max(2000).optional().nullable(),
  return_policy: z.string().trim().max(2000).optional().nullable(),
  shipping_info: z.string().trim().max(2000).optional().nullable(),
  is_featured: z.boolean().optional().default(false),
  features: z.array(z.string().max(200)).max(30).optional().default([]),
  specifications: z.array(z.object({ key: z.string().max(60), value: z.string().max(200) })).max(60).optional().default([]),
  variants: z.union([
    z.array(z.object({
      name: z.string().max(60),
      price: z.number().nonnegative().optional().nullable(),
      stock: z.number().int().min(0).optional().nullable(),
      sku: z.string().max(60).optional().nullable(),
    })).max(30),
    z.object({
      options: z.array(z.object({ name: z.string().max(60), values: z.array(z.string().max(60)).max(50) })).max(6),
      items: z.array(z.object({
        id: z.string().max(120),
        options: z.record(z.string(), z.string().max(60)),
        sku: z.string().max(60).optional().nullable(),
        price: z.number().nonnegative().optional().nullable(),
        discount: z.number().nonnegative().optional().nullable(),
        stock: z.number().int().min(0).optional().nullable(),
        barcode: z.string().max(60).optional().nullable(),
        image: z.string().max(500).optional().nullable(),
      })).max(500),
    }),
  ]).optional().default([]),
  delivery_charge: z.number().nonnegative().optional().nullable(),
  delivery_time_days: z.string().trim().max(60).optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
  total_sold: z.number().int().min(0).optional().nullable(),
  related_product_ids: z.array(z.string().uuid()).max(50).optional().default([]),
  meta: z.record(z.string(), z.any()).optional().nullable(),
  product_type: z.enum(["physical", "digital", "service", "subscription"]).optional(),
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
    const store = await myStoreRow(supabase, userId, "id");
    if (!store) throw new Error("No store");
    const baseFields = {
      name: data.name,
      description: data.description ?? null,
      short_description: data.short_description ?? null,
      brand: data.brand ?? null,
      product_code: data.product_code ?? null,
      price: data.price,
      old_price: data.old_price ?? null,
      cost_price: data.cost_price ?? 0,
      low_stock_threshold: data.low_stock_threshold ?? 5,
      sku: data.sku ?? null,
      stock: data.stock,
      status: data.status,
      primary_image_url: data.primary_image_url ?? null,
      gallery: data.gallery ?? [],
      video_url: data.video_url ?? null,
      category_id: data.category_id ?? null,
      warranty: data.warranty ?? null,
      return_policy: data.return_policy ?? null,
      shipping_info: data.shipping_info ?? null,
      is_featured: data.is_featured ?? false,
      features: data.features ?? [],
      specifications: data.specifications ?? [],
      variants: data.variants ?? [],
      delivery_charge: data.delivery_charge ?? null,
      delivery_time_days: data.delivery_time_days ?? null,
      rating: data.rating ?? null,
      total_sold: data.total_sold ?? 0,
      related_product_ids: data.related_product_ids ?? [],
      meta: data.meta ?? {},
      product_type: data.product_type ?? "physical",
    } as any;

    // Cross-type guard: a product may only reference a category of its own type.
    if (data.category_id) {
      const { data: cat } = await supabase
        .from("categories")
        .select("id, product_type")
        .eq("id", data.category_id)
        .eq("store_id", store.id)
        .maybeSingle();
      if (!cat) throw new Error("Category not found");
      if ((cat as any).product_type && (cat as any).product_type !== (data.product_type ?? "physical")) {
        throw new Error("Category belongs to a different product type");
      }
    }




    if (data.id) {
      const { error } = await supabase
        .from("products")
        .update(baseFields)
        .eq("id", data.id)
        .eq("store_id", store.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    // New product → enforce the plan's product limit.
    await assertLimit(supabase, userId, "product");
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
    const store = await myStoreRow(supabase, userId, "id");
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
    const store = await myStoreRow(supabase, userId, "id");
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
    const store = await myStoreRow(supabase, userId, "id");
    if (!store) throw new Error("No store");
    const { error } = await supabase
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("store_id", store.id);
    if (error) throw new Error(error.message);


    // Fire-and-observe: push Messenger status update to the customer if this order
    // originated from (or has) a Messenger conversation. Failures are swallowed —
    // they remain in the outbox for retry.
    let messenger: { sent: number; failed: number; considered: number; error?: string } | null = null;
    try {
      const { drainOutbox } = await import("@/lib/messenger-notify.server");
      messenger = await drainOutbox({ orderId: data.id, latestOnly: true });
    } catch (e) {
      messenger = { sent: 0, failed: 1, considered: 0, error: (e as Error).message };
      console.error("[updateOrderStatus] messenger drain failed:", (e as Error).message);
    }

    // Auto Create Courier Parcel: when an order is confirmed and a connected
    // courier has automation.autoParcel enabled, create + send the parcel.
    let parcel: { ok: boolean; courier?: string; error?: string } | null = null;
    if (data.status === "confirmed") {
      try {
        const { data: full } = await supabase
          .from("stores")
          .select("id, couriers")
          .eq("id", store.id)
          .maybeSingle();
        const couriers = ((full as any)?.couriers ?? {}) as Record<string, any>;
        const entries = Object.entries(couriers).filter(
          ([, c]) => c?.enabled && c?.automation?.autoParcel,
        );
        const chosen = entries.find(([, c]) => c?.is_default) ?? entries[0];
        if (chosen) {
          const { data: existing } = await supabase
            .from("courier_parcels")
            .select("id")
            .eq("order_id", data.id)
            .not("status", "in", "(cancelled,failed)")
            .maybeSingle();
          if (!existing) {
            const { dispatchParcel } = await import("@/lib/courier-parcels.functions");
            await dispatchParcel(supabase, full as any, {
              orderId: data.id,
              courierKey: chosen[0],
            });
            parcel = { ok: true, courier: chosen[0] };
          }
        }
      } catch (e) {
        parcel = { ok: false, error: (e as Error).message };
        console.error("[updateOrderStatus] auto parcel failed:", (e as Error).message);
      }
    }

    return { ok: true, messenger, parcel };
  });

export const setOrderAllowDuplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), allow: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await myStoreRow(supabase, userId, "id");
    if (!store) throw new Error("No store");
    const { error } = await supabase
      .from("orders")
      .update({ allow_duplicate: data.allow } as any)
      .eq("id", data.id)
      .eq("store_id", store.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });




// ---------- BANNERS ----------
export const listMyBanners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ product_type: z.enum(["physical", "digital", "service", "subscription"]).optional() })
      .parse(d ?? {}),
  )
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const store = await myStoreRow(supabase, userId, "id");
    if (!store) return [];
    let q = supabase.from("banners").select("*").eq("store_id", store.id);
    if (input?.product_type) q = q.eq("product_type", input.product_type);
    const { data, error } = await q
      .order("sort_order", { ascending: true })
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const bannerFields = {
  title: z.string().max(120).optional().nullable(),
  image_url: z.string().min(1),
  link: z.string().max(500).optional().nullable(),
  product_type: z.enum(["physical", "digital", "service", "subscription"]).optional(),
  display_position: z.enum(["hero", "secondary", "promotional", "category"]).optional(),
  category_id: z.string().uuid().optional().nullable(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  campaign_type: z.enum(["general", "physical", "digital"]).optional(),
};

export const addBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object(bannerFields).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await myStoreRow(supabase, userId, "id");
    if (!store) throw new Error("No store");
    const type = data.product_type ?? "physical";
    const { count } = await supabase
      .from("banners")
      .select("*", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("product_type", type);
    if ((count ?? 0) >= 3) throw new Error("Maximum 3 banners per product type");
    const { error } = await supabase.from("banners").insert({
      store_id: store.id,
      title: data.title ?? "",
      image_url: data.image_url,
      link: data.link ?? null,
      product_type: type,
      display_position: data.display_position ?? "hero",
      category_id: data.category_id ?? null,
      sort_order: data.sort_order ?? (count ?? 0) + 1,
      is_active: data.is_active ?? true,
      campaign_type: data.campaign_type ?? "general",
      position: (count ?? 0) + 1,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), ...bannerFields }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await myStoreRow(supabase, userId, "id");
    if (!store) throw new Error("No store");
    const { id, campaign_type: _ct, product_type: _pt, ...rest } = data;
    const { error } = await supabase
      .from("banners")
      .update({
        title: rest.title ?? "",
        image_url: rest.image_url,
        link: rest.link ?? null,
        display_position: rest.display_position ?? "hero",
        category_id: rest.category_id ?? null,
        sort_order: rest.sort_order ?? 0,
        is_active: rest.is_active ?? true,
      })
      .eq("id", id)
      .eq("store_id", store.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const deleteBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await myStoreRow(supabase, userId, "id");
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
    const store = await myStoreRow(supabase, userId, "id");
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
    const store = await myStoreRow(supabase, userId, "id");
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
    const store = await myStoreRow(supabase, userId, "expires_at,package_id, subscription_packages(name,price,duration_days,product_limit)");
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
  .inputValidator((d: unknown) =>
    z
      .object({ product_type: z.enum(["physical", "digital", "service", "subscription"]).optional() })
      .parse(d ?? {}),
  )
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const store = await myStoreRow(supabase, userId, "id");
    if (!store) return [];
    let q = supabase.from("categories").select("*").eq("store_id", store.id);
    if (input?.product_type === "physical") {
      // Legacy rows stored "both" or NULL — they belong to Physical.
      q = q.or("product_type.eq.physical,product_type.eq.both,product_type.is.null");
    } else if (input?.product_type) {
      q = q.eq("product_type", input.product_type);
    }
    const { data, error } = await q
      .order("sort_order", { ascending: true })
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
        image_url: z.string().max(500).nullable().optional(),
        icon_name: z.string().max(200).nullable().optional(),
        icon_style: z.enum(["outline", "colored"]).optional(),
        description: z.string().max(500).nullable().optional(),
        sort_order: z.number().int().min(0).max(9999).optional(),
        is_active: z.boolean().optional(),
        parent_id: z.string().uuid().nullable().optional(),
        product_type: z.enum(["both", "physical", "digital", "service", "subscription"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await myStoreRow(supabase, userId, "id");
    if (!store) throw new Error("No store");
    const patch = {
      name: data.name,
      ...(data.image_url !== undefined ? { image_url: data.image_url } : {}),
      ...(data.icon_name !== undefined ? { icon_name: data.icon_name } : {}),
      ...(data.icon_style !== undefined ? { icon_style: data.icon_style } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.sort_order !== undefined ? { sort_order: data.sort_order } : {}),
      ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
      ...(data.parent_id !== undefined ? { parent_id: data.parent_id } : {}),
      ...(data.product_type !== undefined ? { product_type: data.product_type } : {}),
    };
    if (data.id) {
      const { error } = await supabase
        .from("categories")
        .update(patch)
        .eq("id", data.id)
        .eq("store_id", store.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabase
      .from("categories")
      .insert({ store_id: store.id, ...patch })
      .select("id,name,store_id")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const reorderCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await myStoreRow(supabase, userId, "id");
    if (!store) throw new Error("No store");
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await supabase
        .from("categories")
        .update({ sort_order: i })
        .eq("id", data.ids[i])
        .eq("store_id", store.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await myStoreRow(supabase, userId, "id");
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

const marketingSchema = z
  .object({
    fb_pixel_id: z.string().trim().max(60).optional().nullable(),
    fb_pixel_enabled: z.boolean().optional(),
    fb_capi_token: z.string().trim().max(300).optional().nullable(),
    fb_capi_enabled: z.boolean().optional(),
    fb_test_event_code: z.string().trim().max(40).optional().nullable(),
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
  })
  .superRefine((v, ctx) => {
    if (v.fb_pixel_id && !/^\d{15,17}$/.test(v.fb_pixel_id)) {
      ctx.addIssue({ code: "custom", path: ["fb_pixel_id"], message: "Facebook Pixel ID must be 15–17 digits" });
    }
    if (v.fb_capi_enabled && (!v.fb_capi_token || v.fb_capi_token.length < 40)) {
      ctx.addIssue({ code: "custom", path: ["fb_capi_token"], message: "CAPI access token looks too short" });
    }
    if (v.fb_test_event_code && !/^[A-Za-z0-9_-]{4,40}$/.test(v.fb_test_event_code)) {
      ctx.addIssue({ code: "custom", path: ["fb_test_event_code"], message: "Invalid test event code" });
    }
  });

export const updateMarketing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => marketingSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "pixel");
    return updateStoreColumn(context.supabase, context.userId, "marketing", data);
  });

export const getFacebookStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: store } = await context.supabase
      .from("stores")
      .select("marketing")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    const m: any = (store as any)?.marketing ?? {};
    const hasPixel = !!m.fb_pixel_id;
    const capiOn = !!m.fb_capi_enabled && !!m.fb_capi_token;
    const mode: "off" | "live" | "test" =
      !hasPixel && !capiOn ? "off" : m.fb_test_event_code ? "test" : "live";
    return {
      mode,
      pixel_enabled: m.fb_pixel_enabled !== false && hasPixel,
      capi_enabled: capiOn,
      pixel_id: m.fb_pixel_id ?? null,
      test_event_code: m.fb_test_event_code ?? null,
    };
  });

export const sendFbTestEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: store } = await context.supabase
      .from("stores")
      .select("marketing, slug")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    const m: any = (store as any)?.marketing ?? {};
    if (!m.fb_pixel_id || !m.fb_capi_token) {
      return { ok: false as const, error: "Pixel ID and CAPI token are required for a test event.", mode: "live" as const };
    }
    const { sendFbEvents } = await import("@/lib/fb-capi.server");
    const testCode = (m.fb_test_event_code as string | undefined) || "TEST_LOVABLE";
    const res = await sendFbEvents({
      pixelId: m.fb_pixel_id,
      accessToken: m.fb_capi_token,
      testCode,
      events: [
        {
          event_name: "PageView",
          event_id: `test-${Date.now()}`,
          event_source_url: `https://orzen.top/store/${(store as any)?.slug ?? ""}`,
          user_data: { external_id: context.userId },
        },
      ],
    });
    return res;
  });

const courierShipping = z
  .object({
    insideCity: z.number().finite().nonnegative().max(100000).optional().nullable(),
    outsideCity: z.number().finite().nonnegative().max(100000).optional().nullable(),
    subCity: z.number().finite().nonnegative().max(100000).optional().nullable(),
    cod: z.boolean().optional(),
    home: z.boolean().optional(),
    pickupPoint: z.boolean().optional(),
    returnDelivery: z.boolean().optional(),
    exchange: z.boolean().optional(),
    priority: z.number().int().min(0).max(999).optional().nullable(),
  })
  .partial();
const courierPickup = z
  .object({
    contactName: z.string().trim().max(120).optional().nullable(),
    phone: z.string().trim().max(40).optional().nullable(),
    address: z.string().trim().max(400).optional().nullable(),
    district: z.string().trim().max(80).optional().nullable(),
    area: z.string().trim().max(80).optional().nullable(),
    instructions: z.string().trim().max(500).optional().nullable(),
  })
  .partial();
const courierAutomation = z
  .object({
    autoParcel: z.boolean().optional(),
    autoStatus: z.boolean().optional(),
    autoTracking: z.boolean().optional(),
    autoLabel: z.boolean().optional(),
    autoSms: z.boolean().optional(),
    autoNotify: z.boolean().optional(),
  })
  .partial();
const courierDiagnostics = z
  .object({
    lastConnectedAt: z.string().max(60).optional().nullable(),
    lastStatus: z.enum(["connected", "error", "unknown"]).optional().nullable(),
    lastError: z.string().max(1000).optional().nullable(),
    lastResponse: z.string().max(4000).optional().nullable(),
    latencyMs: z.number().int().min(0).max(600000).optional().nullable(),
    lastSyncAt: z.string().max(60).optional().nullable(),
    lastSyncSummary: z.string().max(300).optional().nullable(),
  })
  .partial();

const courierWebhook = z
  .object({
    verify_token: z.string().trim().max(300).optional().nullable(),
  })
  .partial();
const courierProvider = z
  .object({
    api_key: z.string().trim().max(300).optional().nullable(),
    secret: z.string().trim().max(300).optional().nullable(),
    base_url: z.string().trim().max(300).optional().nullable(),
    enabled: z.boolean().optional(),
    sandbox: z.boolean().optional(),
    is_default: z.boolean().optional(),
    credentials: z.record(z.string(), z.string().max(500)).optional(),
    shipping: courierShipping.optional(),
    pickup: courierPickup.optional(),
    automation: courierAutomation.optional(),
    diagnostics: courierDiagnostics.optional(),
    webhook: courierWebhook.optional(),
  })
  .partial();
const COURIER_KEYS = [
  "steadfast",
  "pathao",
  "redx",
  "paperfly",
  "ecourier",
  "sa_paribahan",
  "sundarban",
] as const;
const couriersSchema = z.object({
  steadfast: courierProvider.optional(),
  pathao: courierProvider.optional(),
  redx: courierProvider.optional(),
  paperfly: courierProvider.optional(),
  ecourier: courierProvider.optional(),
  sa_paribahan: courierProvider.optional(),
  sundarban: courierProvider.optional(),
});


export const updateCouriers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => couriersSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "courier");
    return updateStoreColumn(context.supabase, context.userId, "couriers", data);
  });

// Verifies credentials against each courier's official auth endpoint and
// persists diagnostics into stores.couriers[key].
export const testCourierConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: z.enum(COURIER_KEYS) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "courier");
    const { data: store } = await context.supabase
      .from("stores")
      .select("id, couriers")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (!store) throw new Error("No store");
    const couriers: any = (store as any).couriers ?? {};
    const cfg = couriers[data.key] ?? {};
    const creds: Record<string, string> = { ...(cfg.credentials ?? {}) };
    if (!creds.api_key && cfg.api_key) creds.api_key = cfg.api_key;
    if (!creds.secret && cfg.secret) creds.secret = cfg.secret;
    const url: string = creds.base_url || cfg.base_url || "";
    const startedAt = Date.now();
    let status: "connected" | "error" = "error";
    let message = "";
    let responseSnippet = "";
    try {
      if (!url) throw new Error("Base API URL is not set");
      const { probeCourier } = await import("./couriers.server");
      const r = await probeCourier(data.key, url, creds);
      status = r.ok ? "connected" : "error";
      message = r.message;
      responseSnippet = (r.snippet ?? "").slice(0, 500);
    } catch (e) {
      status = "error";
      message = (e as Error).message || "Network error";
    }

    const latencyMs = Date.now() - startedAt;
    const diagnostics = {
      ...(cfg.diagnostics ?? {}),
      lastConnectedAt: new Date().toISOString(),
      lastStatus: status,
      lastError: status === "error" ? message : null,
      lastResponse: responseSnippet || null,
      latencyMs,
    };
    const next = { ...couriers, [data.key]: { ...cfg, diagnostics } };
    await context.supabase.from("stores").update({ couriers: next }).eq("id", (store as any).id);
    return { ok: status === "connected", status, message, latencyMs };
  });

// Pulls courier-side location/store lists (Pathao, RedX) and records the sync time.
export const syncCourierInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: z.enum(COURIER_KEYS) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "courier");
    const { data: store } = await context.supabase
      .from("stores")
      .select("id, couriers")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (!store) throw new Error("No store");
    const couriers: any = (store as any).couriers ?? {};
    const cfg = couriers[data.key] ?? {};
    const creds: Record<string, string> = { ...(cfg.credentials ?? {}) };
    const url: string = creds.base_url || cfg.base_url || "";
    if (!url) throw new Error("Base API URL is not set");
    const { syncCourierData } = await import("./couriers.server");
    const r = await syncCourierData(data.key, url, creds);
    const diagnostics = {
      ...(cfg.diagnostics ?? {}),
      ...(r.ok
        ? { lastSyncAt: new Date().toISOString(), lastSyncSummary: r.summary ?? null, lastError: null }
        : { lastError: r.message, lastStatus: "error" as const }),
    };
    const next = { ...couriers, [data.key]: { ...cfg, diagnostics } };
    await context.supabase.from("stores").update({ couriers: next }).eq("id", (store as any).id);
    return { ok: r.ok, message: r.message, summary: r.summary ?? null };
  });


const seoSchema = z.object({
  title: z.string().trim().max(160).optional().nullable(),
  description: z.string().trim().max(320).optional().nullable(),
  favicon_url: z.string().max(500).optional().nullable(),
  canonical_url: z.string().trim().max(300).optional().nullable(),
  noindex: z.boolean().optional().nullable(),
  og_title: z.string().trim().max(160).optional().nullable(),
  og_description: z.string().trim().max(320).optional().nullable(),
  og_image_url: z.string().max(500).optional().nullable(),
  twitter_image_url: z.string().max(500).optional().nullable(),
  google_verification: z.string().trim().max(300).optional().nullable(),
  bing_verification: z.string().trim().max(300).optional().nullable(),
  sitemap_enabled: z.boolean().optional().nullable(),
  robots_extra: z.string().trim().max(2000).optional().nullable(),
});
export const updateSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => seoSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Merge so each SEO tab can save independently without clearing others.
    const { data: row } = await context.supabase
      .from("stores")
      .select("seo")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    const current = ((row as any)?.seo ?? {}) as Record<string, unknown>;
    const next = { ...current, ...data };
    delete (next as any).keywords;
    return updateStoreColumn(context.supabase, context.userId, "seo", next);
  });

const deliverySchema = z.object({
  free_min: z.number().nonnegative().optional(),
  cod_enabled: z.boolean().optional(),
});
export const updateDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => deliverySchema.parse(d))
  .handler(async ({ data, context }) =>
    updateStoreColumn(context.supabase, context.userId, "delivery", data),
  );

// ---------- Delivery Zones ----------

async function getOwnedStoreId(sb: any, userId: string): Promise<string> {
  const data = await myStoreRow(sb, userId, "id");
  if (!data) throw new Error("Store not found");
  return data.id as string;
}

export const listDeliveryZones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("delivery_zones")
      .select("id,name,charge,eta,is_active,is_default,sort_order,courier_code")
      .eq("store_id", storeId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const zoneUpsertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  charge: z.number().nonnegative(),
  eta: z.string().trim().max(60).optional().nullable(),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
});

export const createDeliveryZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => zoneUpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    if (data.is_default) {
      await context.supabase
        .from("delivery_zones")
        .update({ is_default: false })
        .eq("store_id", storeId);
    }
    const { data: row, error } = await context.supabase
      .from("delivery_zones")
      .insert({
        store_id: storeId,
        name: data.name,
        charge: data.charge,
        eta: data.eta ?? null,
        is_active: data.is_active ?? true,
        is_default: data.is_default ?? false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateDeliveryZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    zoneUpsertSchema.partial().extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    if (data.is_default) {
      await context.supabase
        .from("delivery_zones")
        .update({ is_default: false })
        .eq("store_id", storeId)
        .neq("id", data.id);
    }
    const patch: {
      name?: string;
      charge?: number;
      eta?: string | null;
      is_active?: boolean;
      is_default?: boolean;
    } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.charge !== undefined) patch.charge = data.charge;
    if (data.eta !== undefined) patch.eta = data.eta;
    if (data.is_active !== undefined) patch.is_active = data.is_active;
    if (data.is_default !== undefined) patch.is_default = data.is_default;
    const { error } = await context.supabase
      .from("delivery_zones")
      .update(patch)
      .eq("id", data.id)
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDeliveryZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("delivery_zones")
      .delete()
      .eq("id", data.id)
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setDefaultDeliveryZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    await context.supabase
      .from("delivery_zones")
      .update({ is_default: false })
      .eq("store_id", storeId);
    const { error } = await context.supabase
      .from("delivery_zones")
      .update({ is_default: true })
      .eq("id", data.id)
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


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

const orderStatusEnum = z.enum(["pending", "confirmed", "processing", "delivered", "cancelled"]);
const statusRulesSchema = z.object({
  online_pending: orderStatusEnum.default("pending"),
  online_paid: orderStatusEnum.default("confirmed"),
  manual: orderStatusEnum.default("pending"),
  cod: orderStatusEnum.default("pending"),
});

/** Reads the store's payment order-status rules. */
export const getPaymentStatusRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("stores")
      .select("payments_config")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const rules = ((data as any)?.payments_config ?? {}).order_status ?? {};
    return statusRulesSchema.parse({
      online_pending: rules.online_pending ?? "pending",
      online_paid: rules.online_paid ?? "confirmed",
      manual: rules.manual ?? "pending",
      cod: rules.cod ?? "pending",
    });
  });

/** Merges the order-status rules into payments_config without losing other keys. */
export const updatePaymentStatusRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => statusRulesSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: store, error } = await context.supabase
      .from("stores")
      .select("id,payments_config")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!store) throw new Error("Store not found");
    const next = { ...(((store as any).payments_config ?? {}) as any), order_status: data };
    const { error: uErr } = await context.supabase
      .from("stores")
      .update({ payments_config: next } as any)
      .eq("id", (store as any).id);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });


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

const typeDefaultsSchema = z.object({
  footer: z.string().trim().max(2000).default(""),
  tags: z.string().trim().max(500).default(""),
  visibility: z.enum(["public", "draft", "hidden"]).default("public"),
  status: z.enum(["active", "inactive"]).default("active"),
  warranty: z.string().trim().max(2000).optional(),
  return_policy: z.string().trim().max(2000).optional(),
});
const productDefaultsSchema = z.object({
  per_type: z.object({
    physical: typeDefaultsSchema,
    digital: typeDefaultsSchema,
    service: typeDefaultsSchema,
    subscription: typeDefaultsSchema,
  }),
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
    const store = await myStoreRow(supabase, userId, "id,name,slug,status,subscription_status,expires_at,updated_at,package_id,subscription_packages(name)");

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

// ============================================================
// Registered customer accounts (per-store)
// ============================================================

async function currentStoreId(context: any) {
  const { data } = await context.supabase
    .from("stores")
    .select("id")
    .eq("owner_user_id", context.userId)
    .maybeSingle();
  if (!data) throw new Error("Store not found");
  return data.id as string;
}

export const adminListCustomerAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        search: z.string().max(120).optional(),
        status: z.enum(["all", "active", "disabled"]).default("all"),
        sort: z.enum(["newest", "orders", "spend"]).default("newest"),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const storeId = await currentStoreId(context);
    let q = context.supabase
      .from("store_customers")
      .select("id,full_name,email,phone,is_active,last_login_at,created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status === "active") q = q.eq("is_active", true);
    if (data.status === "disabled") q = q.eq("is_active", false);
    if (data.search && data.search.trim()) {
      const s = data.search.trim();
      q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // attach order counts + spend + last order
    const ids = (rows ?? []).map((r) => r.id);
    const stats: Record<string, { count: number; spend: number; last: string | null }> = {};
    if (ids.length > 0) {
      const { data: os } = await context.supabase
        .from("orders")
        .select("customer_id,subtotal,delivery_amount,discount_amount,created_at,status")
        .eq("store_id", storeId)
        .in("customer_id", ids);
      for (const o of (os ?? []) as any[]) {
        const cid = o.customer_id as string;
        const s = (stats[cid] ??= { count: 0, spend: 0, last: null });
        s.count += 1;
        if (o.status !== "cancelled")
          s.spend +=
            Number(o.subtotal ?? 0) + Number(o.delivery_amount ?? 0) - Number(o.discount_amount ?? 0);
        if (!s.last || o.created_at > s.last) s.last = o.created_at;
      }
    }
    const mapped = (rows ?? []).map((r) => ({
      ...r,
      order_count: stats[r.id]?.count ?? 0,
      total_spent: stats[r.id]?.spend ?? 0,
      last_order_at: stats[r.id]?.last ?? null,
    }));
    if (data.sort === "orders") mapped.sort((a, b) => b.order_count - a.order_count);
    if (data.sort === "spend") mapped.sort((a, b) => b.total_spent - a.total_spent);
    return mapped;
  });


export const adminGetCustomerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ customerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await currentStoreId(context);
    const { data: row } = await context.supabase
      .from("store_customers")
      .select("id,full_name,email,phone,is_active,last_login_at,created_at")
      .eq("store_id", storeId)
      .eq("id", data.customerId)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    const { data: orders } = await context.supabase
      .from("orders")
      .select("id,invoice_no,status,payment_status,payment_method,subtotal,delivery_amount,discount_amount,created_at")
      .eq("store_id", storeId)
      .eq("customer_id", data.customerId)
      .order("created_at", { ascending: false })
      .limit(50);
    const { data: addresses } = await context.supabase
      .from("store_customer_addresses")
      .select("id,label,name,phone,address,area,is_default")
      .eq("store_id", storeId)
      .eq("customer_id", data.customerId);
    const list = (orders ?? []) as any[];
    const paid = list.filter((o) => o.status !== "cancelled");
    const spend = paid.reduce(
      (s, o) =>
        s + Number(o.subtotal ?? 0) + Number(o.delivery_amount ?? 0) - Number(o.discount_amount ?? 0),
      0,
    );
    const stats = {
      order_count: list.length,
      total_spent: spend,
      avg_order_value: paid.length ? spend / paid.length : 0,
      first_order_at: list.length ? list[list.length - 1].created_at : null,
      last_order_at: list.length ? list[0].created_at : null,
    };
    return { ...row, orders: list, addresses: addresses ?? [], stats };

  });

export const adminSetCustomerActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ customerId: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await currentStoreId(context);
    const { error } = await context.supabase
      .from("store_customers")
      .update({ is_active: data.active })
      .eq("store_id", storeId)
      .eq("id", data.customerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteCustomerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ customerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await currentStoreId(context);
    const { error } = await context.supabase
      .from("store_customers")
      .delete()
      .eq("store_id", storeId)
      .eq("id", data.customerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetRequireCustomerLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await currentStoreId(context);
    const { error } = await context.supabase
      .from("stores")
      .update({ require_customer_login: data.enabled })
      .eq("id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGetRequireCustomerLogin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("stores")
      .select("require_customer_login")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    return { enabled: !!(data as any)?.require_customer_login };
  });

// Public list of couriers (name/code/logo only) for any signed-in store owner.
export const listPublicCourierProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).rpc("get_public_courier_providers");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ code: string; name: string; logo_url: string | null; wordmark_url: string | null; is_active: boolean }>;
  });


// ---------- PRODUCT TYPE SCOPE COUNTS ----------
export const typeScopeCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ entity: z.enum(["products", "categories", "coupons", "banners", "orders"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await myStoreRow(supabase, userId, "id");
    const empty = { all: 0, physical: 0, digital: 0, service: 0, subscription: 0 } as Record<string, number>;
    if (!store) return empty;
    const col = data.entity === "orders" ? "order_type" : "product_type";
    const { data: rows, error } = await supabase.from(data.entity as any).select(col).eq("store_id", store.id);
    if (error) throw new Error(error.message);
    const counts = { ...empty };
    for (const r of (rows ?? []) as any[]) {
      const t = (r[col] ?? "physical") as string;
      counts.all += 1;
      if (t in counts) counts[t] += 1;
    }
    return counts;
  });

// Image shown on the storefront "All" category tile.
export const setAllCategoryImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ image_url: z.string().max(500).nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await myStoreRow(supabase, userId, "id");
    if (!store) throw new Error("No store");
    const { error } = await (supabase as any)
      .from("stores")
      .update({ all_category_image_url: data.image_url })
      .eq("id", store.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
