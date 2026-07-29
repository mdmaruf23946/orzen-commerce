// Public server functions: storefront reads + guest checkout.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
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

function publicOrigin(): string {
  try {
    const host = getRequestHeader("x-forwarded-host") || getRequestHeader("host");
    const proto = getRequestHeader("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  } catch {
    /* not in a request context */
  }
  const explicit = process.env.PUBLIC_APP_URL || process.env.VITE_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  return "https://orzen.top";
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
    return {
      ...store,
      logo_url: imgUrl(store.logo_url),
      icon_url: imgUrl(store.icon_url),
      favicon_url: imgUrl(store.favicon_url),
      custom_favicon_url: imgUrl(store.custom_favicon_url),
    };
  });

export const getStoreActiveGateway = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ storeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: row, error } = await sb.rpc("get_active_store_gateway_public", {
      _store_id: data.storeId,
    });
    if (error) return null;
    return (row as any) ?? null;
  });

/**
 * Every online gateway a shopper can actually pay with: built-in providers
 * connected by the store owner plus Custom Payment Gateway Builder entries.
 * Secrets never leave the server — only label/logo/kind are returned.
 */
export const listStoreOnlineGateways = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ storeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: {
      key: string;
      kind: "builtin" | "custom";
      ref: string;
      label: string;
      logo_url: string | null;
      sandbox: boolean;
    }[] = [];

    const [{ data: builtins }, { data: customs }] = await Promise.all([
      supabaseAdmin
        .from("store_payment_gateways")
        .select("provider_id,sandbox,enabled,status")
        .eq("store_id", data.storeId)
        .eq("enabled", true)
        .eq("status", "connected"),
      supabaseAdmin
        .from("custom_payment_gateways")
        .select("id,name,logo_url,environment,is_active,status")
        .eq("store_id", data.storeId)
        .eq("is_active", true)
        .eq("status", "connected"),
    ]);

    if (builtins?.length) {
      const ids = builtins.map((b: any) => b.provider_id);
      const { data: platform } = await supabaseAdmin
        .from("platform_payment_gateways")
        .select("id,label,logo_url,enabled")
        .in("id", ids);
      const byId = new Map((platform ?? []).map((p: any) => [p.id, p]));
      for (const b of builtins as any[]) {
        const p: any = byId.get(b.provider_id);
        if (!p || p.enabled === false) continue;
        out.push({
          key: `builtin:${b.provider_id}`,
          kind: "builtin",
          ref: b.provider_id,
          label: p.label,
          logo_url: imgUrl(p.logo_url ?? null),
          sandbox: !!b.sandbox,
        });
      }
    }

    for (const c of (customs ?? []) as any[]) {
      out.push({
        key: `custom:${c.id}`,
        kind: "custom",
        ref: c.id,
        label: c.name,
        logo_url: imgUrl(c.logo_url ?? null),
        sandbox: c.environment !== "production",
      });
    }

    return out;
  });

/**
 * Creates the provider checkout session for an already-placed order and
 * returns the redirect URL the shopper must be sent to.
 */
export const startOnlineCheckout = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ orderId: z.string().uuid(), gatewayKey: z.string().min(3).max(120) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id,store_id,customer_name,phone,address,subtotal,invoice_no")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Order not found");
    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("slug,name")
      .eq("id", (order as any).store_id)
      .maybeSingle();

    const origin = publicOrigin();
    const slug = (store as any)?.slug ?? "";
    const successUrl = `${origin}/store/${slug}/order/${order.id}`;
    const cancelUrl = `${origin}/store/${slug}/checkout`;
    const amount = Number((order as any).subtotal ?? 0);
    const [kind, ref] = data.gatewayKey.split(":");

    if (kind === "custom") {
      const { data: gw } = await supabaseAdmin
        .from("custom_payment_gateways")
        .select("*")
        .eq("id", ref)
        .eq("store_id", (order as any).store_id)
        .eq("is_active", true)
        .maybeSingle();
      if (!gw) throw new Error("Payment gateway unavailable");
      let creds: Record<string, string> = {};
      if ((gw as any).credentials_ciphertext) {
        const { decryptJSON } = await import("@/lib/crypto/credentials.server");
        try {
          creds = decryptJSON<Record<string, string>>((gw as any).credentials_ciphertext);
        } catch {
          creds = {};
        }
      }
      const { executeCheckout } = await import("@/lib/custom-gateway/engine.server");
      const webhookUrl = `${origin}/api/public/store-payments/custom-webhook/${(order as any).store_id}/${(gw as any).id}`;
      const result = await executeCheckout(
        {
          ...(gw as any),
          config: (gw as any).config ?? {},
        } as any,
        creds,
        {
          order_id: (order as any).invoice_no ?? order.id,
          amount,
          currency: (gw as any).currency ?? "BDT",
          customer_name: (order as any).customer_name,
          customer_email: `noreply@${slug || "store"}.orzen.top`,
          customer_phone: (order as any).phone,
          product_name: `Order ${(order as any).invoice_no ?? order.id}`,
          product_quantity: 1,
          shipping_address: (order as any).address ?? "N/A",
          success_url: successUrl,
          cancel_url: cancelUrl,
          fail_url: cancelUrl,
          callback_url: webhookUrl,
          webhook_url: webhookUrl,
          store_id: (order as any).store_id,
        },
      );
      if (!result.ok || !result.redirect_url) {
        throw new Error(result.message ?? result.error ?? "Could not start payment");
      }
      await supabaseAdmin
        .from("orders")
        .update({ payment_ref: result.provider_ref ?? null } as any)
        .eq("id", order.id);
      return { redirect_url: result.redirect_url };
    }

    if (kind === "builtin") {
      const { data: conn } = await supabaseAdmin
        .from("store_payment_gateways")
        .select("*")
        .eq("store_id", (order as any).store_id)
        .eq("provider_id", ref)
        .eq("enabled", true)
        .maybeSingle();
      if (!conn) throw new Error("Payment gateway unavailable");
      const { getProvider } = await import("@/lib/subscription-pay/providers/registry");
      const adapter = getProvider(ref);
      const res = await adapter.createCheckout(
        {
          credentials: ((conn as any).credentials ?? {}) as Record<string, string | boolean>,
          sandbox: !!(conn as any).sandbox,
        },
        {
          invoiceId: order.id,
          invoiceNo: (order as any).invoice_no ?? order.id,
          amount,
          currency: "BDT",
          customerName: (order as any).customer_name,
          customerEmail: `noreply@${slug || "store"}.orzen.top`,
          customerPhone: (order as any).phone,
          returnUrl: successUrl,
          cancelUrl,
          webhookUrl: `${origin}/api/public/store-payments/webhook/${(order as any).store_id}/${ref}`,
          packageLabel: `Order ${(order as any).invoice_no ?? order.id}`,
        },
      );
      await supabaseAdmin
        .from("orders")
        .update({ payment_ref: res.provider_ref ?? null } as any)
        .eq("id", order.id);
      return { redirect_url: res.redirect_url };
    }

    throw new Error("Unsupported gateway");
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
      .select("id,name,image_url,description,sort_order,is_active,parent_id")
      .eq("store_id", data.storeId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (cats ?? []).map((c) => ({
      ...c,
      image_url: c.image_url
        ? c.image_url.startsWith("http")
          ? c.image_url
          : `/api/img/${c.image_url}`
        : null,
    }));
  });

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({ storeId: z.string().uuid(), productId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: p, error } = await sb
      .from("products")
      .select(
        "id,name,slug,description,price,old_price,stock,status,primary_image_url,gallery,store_id,brand,sku,category_id,features,specifications,video_url,warranty,return_policy,meta",
      )
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

export const listRelatedProducts = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z
      .object({
        storeId: z.string().uuid(),
        categoryId: z.string().uuid().nullable().optional(),
        excludeId: z.string().uuid(),
        limit: z.number().int().min(1).max(24).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const limit = data.limit ?? 8;
    let rows: any[] = [];
    if (data.categoryId) {
      const { data: cat } = await sb
        .from("products")
        .select("id,name,slug,price,old_price,stock,status,primary_image_url,category_id")
        .eq("store_id", data.storeId)
        .eq("category_id", data.categoryId)
        .neq("id", data.excludeId)
        .neq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(limit);
      rows = cat ?? [];
    }
    if (rows.length < 6) {
      const need = limit - rows.length;
      const have = new Set(rows.map((r) => r.id));
      const { data: extra } = await sb
        .from("products")
        .select("id,name,slug,price,old_price,stock,status,primary_image_url,category_id")
        .eq("store_id", data.storeId)
        .neq("id", data.excludeId)
        .neq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(need + 12);
      for (const r of extra ?? []) {
        if (rows.length >= limit) break;
        if (!have.has(r.id)) rows.push(r);
      }
    }
    return rows.map((p) => ({ ...p, primary_image_url: imgUrl(p.primary_image_url) }));
  });

export const listProductsByIds = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({ storeId: z.string().uuid(), ids: z.array(z.string().uuid()).min(1).max(24) }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: rows, error } = await sb
      .from("products")
      .select("id,name,slug,price,old_price,stock,status,primary_image_url,category_id")
      .eq("store_id", data.storeId)
      .in("id", data.ids)
      .neq("status", "draft");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((p) => ({ ...p, primary_image_url: imgUrl(p.primary_image_url) }));
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

export const getStoreDeliveryZones = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ storeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: rows, error } = await sb.rpc("get_public_delivery_zones", {
      _store_id: data.storeId,
    } as any);
    if (error) throw new Error(error.message);
    return ((rows as any[]) ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      charge: Number(r.charge),
      eta: r.eta,
      is_default: r.is_default,
    }));
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
        // "cod" | "bkash" | "nagad" | "rocket" | "bank" | "builtin:<id>" | "custom:<uuid>"
        paymentMethod: z.string().trim().min(2).max(120),
        txnId: z.string().trim().max(120).optional(),
        notes: z.string().trim().max(500).optional(),
        items: z.array(itemSchema).min(1).max(50),
        couponCode: z.string().trim().max(40).optional(),
        deliveryZoneId: z.string().uuid().optional(),
        customerToken: z.string().min(16).max(128).optional(),
        fingerprint: z.string().trim().max(128).optional(),
        deviceId: z.string().trim().max(128).optional(),
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
      .select("id,status,delivery,require_customer_login,payments_config")
      .eq("id", data.storeId)
      .maybeSingle();
    if (!store || store.status !== "active") throw new Error("Store unavailable");

    // Resolve logged-in customer (if any) and enforce store's login rule.
    let customerId: string | null = null;
    if (data.customerToken) {
      const { data: c } = await sb.rpc("customer_from_token", {
        _token: data.customerToken,
        _store_id: data.storeId,
      } as any);
      if (c) customerId = (c as any).id;
    }
    if ((store as any).require_customer_login && !customerId) {
      throw new Error("Please sign in to place an order");
    }

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

    // Delivery — from zone if provided, else legacy fallback
    const d: any = store.delivery ?? {};
    let baseShip = 0;
    let zoneId: string | null = null;
    if (data.deliveryZoneId) {
      const { data: zone } = await sb
        .from("delivery_zones")
        .select("id,charge,is_active")
        .eq("id", data.deliveryZoneId)
        .eq("store_id", data.storeId)
        .maybeSingle();
      if (zone && zone.is_active) {
        baseShip = Number(zone.charge);
        zoneId = zone.id;
      }
    }
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

    // Duplicate order protection
    const { checkDuplicate, DUPLICATE_MESSAGE } = await import("@/lib/duplicate-guard.server");
    const dup = await checkDuplicate({
      storeId: data.storeId,
      phone: data.phone,
      customerId,
      fingerprint: data.fingerprint ?? null,
      deviceId: data.deviceId ?? null,
      productIds: ids,
    });
    if (dup.action === "block") {
      await sb.from("store_duplicate_blocks").insert({
        store_id: data.storeId,
        matched_rules: dup.matchedRules,
        matched_order_id: dup.matchedOrderId,
        phone: data.phone,
        customer_id: customerId,
        fingerprint: data.fingerprint ?? null,
        device_id: data.deviceId ?? null,
        product_ids: ids,
        payload: {
          customerName: data.customerName,
          phone: data.phone,
          address: data.address,
          area: data.area,
          paymentMethod: data.paymentMethod,
          txnId: data.txnId,
          notes: data.notes,
          deliveryZoneId: data.deliveryZoneId,
          itemRows,
          subtotal,
          delivery_amount,
          discount_amount,
          total: subtotal + delivery_amount - discount_amount,
        },
        status: "blocked",
      });
      const err: any = new Error(DUPLICATE_MESSAGE);
      err.code = "DUPLICATE_BLOCKED";
      throw err;
    }
    let warned = false;
    if (dup.action === "warn") {
      warned = true;
      await sb.from("store_duplicate_blocks").insert({
        store_id: data.storeId,
        matched_rules: dup.matchedRules,
        matched_order_id: dup.matchedOrderId,
        phone: data.phone,
        customer_id: customerId,
        fingerprint: data.fingerprint ?? null,
        device_id: data.deviceId ?? null,
        product_ids: ids,
        payload: { customerName: data.customerName, phone: data.phone, notes: "warn-only" },
        status: "warned",
      });
    }

    const { data: order, error: oErr } = await sb
      .from("orders")
      .insert({
        store_id: data.storeId,
        customer_id: customerId,
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
        delivery_zone_id: zoneId,
        status: "pending",
        fingerprint: data.fingerprint ?? null,
        device_id: data.deviceId ?? null,
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

    // Fire server-side Purchase event via Meta CAPI (best-effort, deduped with browser event).
    try {
      const { data: st } = await sb
        .from("stores")
        .select("marketing, slug")
        .eq("id", data.storeId)
        .maybeSingle();
      const m: any = (st as any)?.marketing ?? {};
      if (m.fb_pixel_id && m.fb_capi_token && m.fb_capi_enabled !== false) {
        const { sendFbEvents } = await import("@/lib/fb-capi.server");
        await sendFbEvents({
          pixelId: m.fb_pixel_id,
          accessToken: m.fb_capi_token,
          testCode: m.fb_test_event_code || null,
          events: [
            {
              event_name: "Purchase",
              event_id: `purchase-${order.id}`,
              event_source_url: `https://orzen.top/store/${(st as any)?.slug ?? ""}/order/${order.id}`,
              user_data: { phone: data.phone, external_id: customerId ?? undefined },
              custom_data: {
                value: subtotal + delivery_amount - discount_amount,
                currency: "BDT",
                content_ids: ids,
                contents: itemRows.map((r) => ({ id: r.product_id, quantity: r.qty, item_price: Number(r.price_snapshot) })),
                num_items: itemRows.reduce((a, r) => a + r.qty, 0),
              },
            },
          ],
        });
      }
    } catch { /* non-fatal */ }

    return { orderId: order.id, warning: warned ? DUPLICATE_MESSAGE : null };
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

