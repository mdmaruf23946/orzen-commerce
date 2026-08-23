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

    // Never advertise gateways for a suspended/inactive store.
    const { data: storeRow } = await supabaseAdmin
      .from("stores")
      .select("id,status")
      .eq("id", data.storeId)
      .maybeSingle();
    if (!storeRow || (storeRow as any).status !== "active") return out;

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
      const { PROVIDERS } = await import("@/lib/subscription-pay/providers/registry");
      const { data: platform } = await supabaseAdmin
        .from("platform_payment_gateways")
        .select("id,label,logo_url,enabled")
        .in("id", ids);
      const byId = new Map((platform ?? []).map((p: any) => [p.id, p]));
      for (const b of builtins as any[]) {
        const p: any = byId.get(b.provider_id);
        if (!p || p.enabled === false) continue;
        // Never offer a provider whose live checkout API isn't wired yet —
        // otherwise the shopper is redirected nowhere after ordering.
        if (!PROVIDERS[b.provider_id]?.meta.storefrontCheckout) continue;
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
      .select(
        "id,store_id,customer_name,phone,address,subtotal,delivery_amount,discount_amount,invoice_no,status,payment_status,payment_gateway_id,payment_method,fulfillment_meta,created_at",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Order not found");
    // Guards: never re-open payment for a settled, cancelled or stale order.
    if ((order as any).payment_status === "paid") throw new Error("This order is already paid");
    if ((order as any).status === "cancelled") throw new Error("This order was cancelled");
    const ageMs = Date.now() - new Date((order as any).created_at ?? Date.now()).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) throw new Error("This order has expired. Please place a new order.");
    if ((order as any).payment_method !== "online") throw new Error("This order is not an online payment order");

    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("slug,name,status,currency")
      .eq("id", (order as any).store_id)
      .maybeSingle();
    if (!store || (store as any).status !== "active") throw new Error("Store unavailable");

    const origin = publicOrigin();
    const slug = (store as any)?.slug ?? "";
    const successUrl = `${origin}/store/${slug}/order/${order.id}`;
    const cancelUrl = `${origin}/store/${slug}/checkout`;
    // Charge the true payable total — subtotal alone omitted delivery and
    // ignored coupon discounts.
    const fullTotal = Math.max(
      0,
      Number((order as any).subtotal ?? 0) +
        Number((order as any).delivery_amount ?? 0) -
        Number((order as any).discount_amount ?? 0),
    );
    // Service orders may be booked with a partial advance — charge that only.
    const svcAdvance = Number(
      (((order as any).fulfillment_meta ?? {}) as any)?.service?.advance_amount ?? 0,
    );
    const amount = svcAdvance > 0 ? svcAdvance : fullTotal;
    const storeCurrency = String((store as any)?.currency ?? "BDT").toUpperCase() || "BDT";
    // Reference the webhook can always match on, even when the provider only
    // returns a redirect URL and no transaction id of its own.
    const fallbackRef = String((order as any).invoice_no ?? order.id);
    const [kind, ref] = data.gatewayKey.split(":");
    // The gateway must be the one recorded when the order was placed.
    const recorded = (order as any).payment_gateway_id as string | null;
    if (recorded && kind === "custom" && recorded !== ref) {
      throw new Error("Payment gateway mismatch for this order");
    }


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
          currency: (gw as any).currency ?? storeCurrency,
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
        .update({ payment_ref: result.provider_ref ?? fallbackRef } as any)
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
      if ((conn as any).status !== "connected") {
        throw new Error("Payment gateway is not connected");
      }
      const { getProvider } = await import("@/lib/subscription-pay/providers/registry");
      const adapter = getProvider(ref);
      if (!adapter.meta.storefrontCheckout) {
        throw new Error(
          `${adapter.meta.label} cannot process storefront payments yet. Please choose another payment method.`,
        );
      }
      // Credentials are stored encrypted — decrypt them here or the provider
      // receives an empty payload and rejects the session.
      let creds: Record<string, string | boolean> = {};
      if ((conn as any).credentials_ciphertext) {
        const { decryptJSON } = await import("@/lib/crypto/credentials.server");
        try {
          creds = decryptJSON<Record<string, string | boolean>>((conn as any).credentials_ciphertext);
        } catch {
          throw new Error("Payment gateway credentials could not be read");
        }
      }
      const res = await adapter.createCheckout(
        {
          credentials: creds,
          sandbox: !!(conn as any).sandbox,
        },
        {
          invoiceId: order.id,
          invoiceNo: (order as any).invoice_no ?? order.id,
          amount,
          currency: storeCurrency,

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
        .update({ payment_ref: res.provider_ref ?? fallbackRef } as any)
        .eq("id", order.id);
      return { redirect_url: res.redirect_url };
    }

    throw new Error("Unsupported gateway");
  });

/**
 * Return-from-gateway safety net: if the provider's webhook never arrives (or
 * the gateway has no webhook at all), the shopper's order would stay pending
 * forever. The order page calls this on load for unpaid online orders; it asks
 * the provider directly and applies the store's configured status rules.
 */
export const verifyOrderPayment = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(
        "id,store_id,invoice_no,subtotal,delivery_amount,discount_amount,payment_method,payment_status,payment_ref,payment_gateway_id,status,created_at",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) return { payment_status: null as string | null, checked: false };
    const o = order as any;
    if (o.payment_method !== "online") return { payment_status: o.payment_status ?? null, checked: false };
    if (o.payment_status === "paid") return { payment_status: "paid", checked: false };

    const txn = String(o.payment_ref ?? o.invoice_no ?? o.id);
    let resolved: "paid" | "failed" | "pending" | null = null;

    if (o.payment_gateway_id) {
      const { data: gw } = await supabaseAdmin
        .from("custom_payment_gateways")
        .select("*")
        .eq("id", o.payment_gateway_id)
        .eq("store_id", o.store_id)
        .maybeSingle();
      if (gw) {
        let creds: Record<string, string> = {};
        if ((gw as any).credentials_ciphertext) {
          try {
            const { decryptJSON } = await import("@/lib/crypto/credentials.server");
            creds = decryptJSON<Record<string, string>>((gw as any).credentials_ciphertext);
          } catch {
            creds = {};
          }
        }
        const { executeVerification } = await import("@/lib/custom-gateway/engine.server");
        const res = await executeVerification(
          { ...(gw as any), config: (gw as any).config ?? {} } as any,
          creds,
          {
            order_id: String(o.invoice_no ?? o.id),
            amount: 0,
            currency: (gw as any).currency ?? "BDT",
            customer_name: "",
            customer_email: "",
            customer_phone: "",
            product_name: "",
            product_quantity: 1,
            shipping_address: "",
            success_url: "",
            cancel_url: "",
            fail_url: "",
            callback_url: "",
            webhook_url: "",
            store_id: o.store_id,
            transaction_id: txn,
          } as any,
        );
        if (res.status === "paid") resolved = "paid";
        else if (res.status === "failed" || res.status === "cancelled") resolved = "failed";
      }
    }

    if (!resolved) return { payment_status: o.payment_status ?? "pending", checked: true };

    if (resolved === "paid") {
      const { data: st } = await supabaseAdmin
        .from("stores")
        .select("payments_config")
        .eq("id", o.store_id)
        .maybeSingle();
      const rules: any = ((st as any)?.payments_config ?? {}).order_status ?? {};
      const allowed = ["pending", "confirmed", "processing", "delivered", "cancelled"];
      const paidStatus = allowed.includes(rules.online_paid) ? rules.online_paid : "confirmed";
      await supabaseAdmin
        .from("orders")
        .update({ payment_status: "paid", status: paidStatus } as any)
        .eq("id", o.id)
        .neq("payment_status", "paid");
      try {
        const { handlePaymentConfirmed } = await import("@/lib/orders-confirm.server");
        await handlePaymentConfirmed(supabaseAdmin as any, o.id);
      } catch { /* non-fatal */ }
      return { payment_status: "paid", checked: true };

    }

    await supabaseAdmin
      .from("orders")
      .update({ payment_status: "failed" } as any)
      .eq("id", o.id)
      .neq("payment_status", "paid");
    return { payment_status: "failed", checked: true };
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

const PRODUCT_CARD_COLS =
  "id,name,slug,price,old_price,stock,status,primary_image_url,category_id,is_featured,product_type,total_sold,rating,created_at,updated_at";

export const listStoreProducts = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ storeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: products, error } = await sb
      .from("products")
      .select(PRODUCT_CARD_COLS)
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
      .select(PRODUCT_CARD_COLS)

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
        "id,name,slug,description,short_description,price,old_price,stock,status,primary_image_url,gallery,store_id,brand,sku,category_id,features,specifications,video_url,warranty,return_policy,meta,product_type,total_sold,rating,created_at,updated_at",
      )
      .eq("id", data.productId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) return null;
    const gallery = Array.isArray(p.gallery) ? (p.gallery as string[]) : [];

    // Digital config is stored in meta.digital. File paths and any other
    // fulfilment-only data must never reach the browser — only presentation
    // fields are projected here.
    const meta = (p.meta ?? {}) as Record<string, any>;
    const dg = (meta.digital ?? {}) as Record<string, any>;
    const files: any[] = Array.isArray(dg.files) ? dg.files : [];
    const digital =
      p.product_type === "digital"
        ? {
            version: dg.version ?? null,
            changelog: dg.changelog ?? null,
            platforms: Array.isArray(dg.platforms) ? dg.platforms : [],
            tags: Array.isArray(dg.tags) ? dg.tags : [],
            license_type: dg.license_type ?? "personal",
            license_note: dg.license_note ?? null,
            included: Array.isArray(dg.included) ? dg.included : [],
            requirements: dg.requirements ?? {},
            faq: Array.isArray(dg.faq) ? dg.faq : [],
            free: !!dg.free,
            file_count: files.length,
            total_size: files.reduce((a, f) => a + (Number(f?.size) || 0), 0),
            file_types: Array.from(
              new Set(
                files
                  .map((f) => String(f?.name ?? "").split(".").pop()?.toLowerCase())
                  .filter(Boolean),
              ),
            ),
            has_external: !!dg.external_url,
            preview: {
              type: dg.preview?.type ?? null,
              images: Array.isArray(dg.preview?.images)
                ? dg.preview.images.map((i: string) => imgUrl(i)).filter(Boolean)
                : [],
              video_url: dg.preview?.video_url ?? null,
              demo_url: dg.preview?.demo_url ?? null,
              pdf_url: dg.preview?.pdf_url ?? null,
              audio_url: dg.preview?.audio_url ?? null,
            },
            download: {
              mode: dg.download?.mode ?? "instant",
              max_downloads: dg.download?.max_downloads ?? null,
              expiry_days: dg.download?.expiry_days ?? null,
            },
          }
        : null;

    // Strip the raw digital block (contains storage paths) from the payload.
    const { digital: _omit, ...safeMeta } = meta;

    return {
      ...p,
      meta: safeMeta,
      digital,
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
        .select("id,name,slug,price,old_price,stock,status,primary_image_url,category_id,product_type")
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
        .select("id,name,slug,price,old_price,stock,status,primary_image_url,category_id,product_type")
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
      .select("id,name,slug,price,old_price,stock,status,primary_image_url,category_id,product_type,meta")
      .eq("store_id", data.storeId)
      .in("id", data.ids)
      .neq("status", "draft");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((p) => {
      const dg = ((p.meta ?? {}) as any)?.digital ?? {};
      const sv = ((p.meta ?? {}) as any)?.service ?? {};
      const sub = ((p.meta ?? {}) as any)?.subscription ?? {};
      const files: any[] = Array.isArray(dg.files) ? dg.files : [];
      const { meta: _meta, ...rest } = p as any;

      return {
        ...rest,
        primary_image_url: imgUrl(p.primary_image_url),
        digital:
          p.product_type === "digital"
            ? {
                version: dg.version ?? null,
                license_type: dg.license_type ?? "personal",
                file_count: files.length,
                total_size: files.reduce((a, f) => a + (Number(f?.size) || 0), 0),
              }
            : null,
        // Service checkout needs packages, add-ons and delivery info up front.
        service:
          p.product_type === "service"
            ? {
                packages: Array.isArray(sv.packages) ? sv.packages : [],
                addons: Array.isArray(sv.addons) ? sv.addons : [],
                delivery: sv.delivery ?? null,
                pricing_type: sv.pricing_type ?? "fixed",
                availability: sv.availability ?? "available",
                allow_quantity: sv.allow_quantity === true,
              }
            : null,
        // Subscription checkout needs cycle, trial, fees and plan perks.
        subscription:
          p.product_type === "subscription"
            ? {
                billing_cycle: sub.billing_cycle ?? "monthly",
                custom_cycle: sub.custom_cycle ?? null,
                plan_type: sub.plan_type ?? null,
                badge: sub.badge ?? null,
                setup_fee: sub.setup_fee ?? null,
                renewal_price_mode: sub.renewal_price_mode ?? "same",
                renewal_price: sub.renewal_price ?? null,
                trial: sub.trial ?? null,
                access_items: Array.isArray(sub.access_items) ? sub.access_items : [],
                benefits: Array.isArray(sub.benefits) ? sub.benefits : [],
                usage_limits: Array.isArray(sub.usage_limits) ? sub.usage_limits : [],
                policies: sub.policies ?? null,
              }
            : null,
      };
    });
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
        // Digital-only carts have nothing to ship, so the address is optional.
        address: z.string().trim().max(500).optional(),
        area: z.string().trim().max(120).optional(),
        email: z.string().trim().email().max(160).optional(),
        company: z.string().trim().max(160).optional(),
        country: z.string().trim().max(80).optional(),

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
        // Service-only intake payload. Never used by physical / digital /
        // subscription checkout — those paths ignore it entirely.
        service: z
          .object({
            packageKey: z.string().trim().max(60).optional(),
            addons: z.array(z.string().trim().max(80)).max(20).optional(),
            answers: z.record(z.string(), z.any()).optional(),
            website: z.string().trim().max(200).optional(),
            businessName: z.string().trim().max(160).optional(),
            language: z.string().trim().max(60).optional(),
            contactChannel: z.string().trim().max(40).optional(),
            contactTime: z.string().trim().max(40).optional(),
            uploadToken: z.string().trim().max(64).optional(),
            paymentPlan: z.enum(["full", "advance"]).optional(),
          })
          .optional(),
        // Subscription-only payload. Ignored by every other checkout path.
        subscription: z
          .object({
            planId: z.string().trim().max(60).optional(),
            billingCycle: z.string().trim().max(30).optional(),
            autoRenew: z.boolean().optional(),
            remindersOptIn: z.boolean().optional(),
            vat: z.string().trim().max(60).optional(),
            acceptedTerms: z.boolean().optional(),
          })
          .optional(),
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
      .select("id,name,price,stock,status,product_type,meta")
      .in("id", ids)
      .eq("store_id", data.storeId);
    if (pErr) throw new Error(pErr.message);
    const byId = new Map(products?.map((p) => [p.id, p]) ?? []);

    const isDigitalProduct = (p: any) => p?.product_type === "digital";
    const hasDigital = data.items.some((i) => isDigitalProduct(byId.get(i.productId)));
    const allDigital = data.items.every((i) => isDigitalProduct(byId.get(i.productId)));
    // One order = one product type. Mixed carts stay physical so the existing
    // physical workflow keeps handling them exactly as before.
    const kinds = Array.from(
      new Set(data.items.map((i) => (byId.get(i.productId) as any)?.product_type ?? "physical")),
    );
    const orderType =
      kinds.length === 1 && ["digital", "service", "subscription"].includes(kinds[0] as string)
        ? (kinds[0] as string)
        : "physical";
    // Services are booked, never shipped: no address, no zone, no courier, no COD.
    const allService = orderType === "service";
    // Subscriptions are billed recurrently: no shipment, no courier, no zone.
    const allSubscription = orderType === "subscription";
    // COD for subscriptions follows the store's own payment configuration.
    const subCodEnabled = ((store as any)?.payments_config ?? {})?.cod?.enabled !== false;

    // Digital goods are never shipped and never paid on delivery.
    if (hasDigital && data.paymentMethod === "cod") {
      throw new Error("Cash on Delivery is not available for digital products");
    }
    if (allService && data.paymentMethod === "cod") {
      throw new Error("Cash on Delivery is not available for services");
    }
    if (allSubscription && data.paymentMethod === "cod" && !subCodEnabled) {
      throw new Error("Cash on Delivery is not available for subscriptions");
    }
    if (!allDigital && !allService && !allSubscription && (data.address ?? "").trim().length < 3) {
      throw new Error("Delivery address is required");
    }
    if ((hasDigital || allService || allSubscription) && !data.email) {
      throw new Error("Email address is required");
    }



    let subtotal = 0;
    const itemRows = data.items.map((i) => {
      const p = byId.get(i.productId);
      if (!p || p.status === "draft") throw new Error("Product unavailable");
      // Digital, service and subscription products are not inventory-based.
      const stockless = ["digital", "service", "subscription"].includes(
        (p as any).product_type ?? "physical",
      );
      if (!stockless && p.stock < i.qty) {
        throw new Error(`Not enough stock for ${p.name}`);
      }

      subtotal += Number(p.price) * i.qty;
      return {
        product_id: p.id,
        name_snapshot: p.name,
        price_snapshot: p.price,
        qty: i.qty,
      };
    });

    // Service pricing is recomputed from trusted product metadata: the chosen
    // package replaces the base price and add-ons are priced server-side.
    let servicePackage: { key: string; name: string; price: number } | null = null;
    const serviceAddons: { name: string; price: number }[] = [];
    if (allService) {
      const first = byId.get(data.items[0].productId) as any;
      const meta = ((first?.meta ?? {}) as any).service ?? {};
      const packages: any[] = Array.isArray(meta.packages) ? meta.packages : [];
      const wantedKey = data.service?.packageKey;
      const pkg =
        (wantedKey && packages.find((p) => (p.key ?? p.name) === wantedKey)) ||
        (packages.length ? packages[0] : null);
      if (pkg && pkg.price != null) {
        servicePackage = { key: pkg.key ?? pkg.name, name: pkg.name, price: Number(pkg.price) };
        subtotal = subtotal - Number(first.price) * data.items[0].qty + servicePackage.price * data.items[0].qty;
        itemRows[0].price_snapshot = servicePackage.price as any;
        itemRows[0].name_snapshot = `${first.name} — ${servicePackage.name}`;
      }
      const available: any[] = Array.isArray(meta.addons) ? meta.addons : [];
      for (const wanted of data.service?.addons ?? []) {
        const a = available.find((x) => x.name === wanted);
        if (a && a.price != null) {
          serviceAddons.push({ name: a.name, price: Number(a.price) });
          subtotal += Number(a.price);
        }
      }
    }



    // Delivery — from zone if provided, else legacy fallback
    const d: any = store.delivery ?? {};
    let baseShip = 0;
    let zoneId: string | null = null;
    if (!allDigital && !allService && !allSubscription && data.deliveryZoneId) {
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
    let delivery_amount =
      allDigital || allService || allSubscription
        ? 0
        : freeMin > 0 && subtotal >= freeMin
          ? 0
          : baseShip;

    // Subscription pricing: the selected billing plan price and setup fee come
    // from trusted product metadata — never from the client.
    let subscriptionFulfillment: any = null;
    if (allSubscription) {
      const firstProduct = byId.get(data.items[0].productId) as any;
      const smeta = ((firstProduct?.meta ?? {}) as any).subscription ?? {};
      const { resolveBillingPlans, findPlan } = await import(
        "@/components/admin/product-form/subscription/subscription-meta"
      );
      const plans = resolveBillingPlans(smeta, Number(firstProduct?.price ?? 0));
      const plan = findPlan(plans as any, (data.subscription as any)?.planId ?? null);
      if (plan) {
        const qty = data.items[0].qty;
        subtotal = subtotal - Number(firstProduct.price) * qty + Number(plan.price) * qty;
        itemRows[0].price_snapshot = plan.price as any;
        if (plans.length > 1) itemRows[0].name_snapshot = `${firstProduct.name} — ${plan.label}`;
      }
      const setupFee = Number(smeta.setup_fee ?? 0);
      subtotal = subtotal + setupFee;
      subscriptionFulfillment = {
        plan_id: plan?.id ?? null,
        plan_label: plan?.label ?? null,
        billing_cycle: plan?.cycle ?? data.subscription?.billingCycle ?? smeta.billing_cycle ?? "monthly",
        auto_renew: data.subscription?.autoRenew ?? smeta.renewal?.mode !== "manual",
        reminders_opt_in: data.subscription?.remindersOptIn ?? true,
        vat: data.subscription?.vat ?? null,
        setup_fee: setupFee,
        tax_amount: 0,
        accepted_terms: !!data.subscription?.acceptedTerms,
      };
    }






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

    // Resolve payment method + the order status the owner configured for it.
    const isOnline = data.paymentMethod.startsWith("custom:") || data.paymentMethod.startsWith("builtin:");
    const dbMethod = (isOnline ? "online" : data.paymentMethod) as
      | "cod" | "bkash" | "nagad" | "rocket" | "bank" | "online";
    const statusRules: any = ((store as any).payments_config ?? {}).order_status ?? {};
    const allowedStatuses = ["pending", "confirmed", "processing", "delivered", "cancelled"];
    const pick = (v: any, fb: string) => (allowedStatuses.includes(v) ? v : fb);
    const orderStatus = isOnline
      ? pick(statusRules.online_pending, "pending")
      : data.paymentMethod === "cod"
        ? pick(statusRules.cod, "pending")
        : pick(statusRules.manual, "pending");

    let gatewayId: string | null = null;
    let gatewayName: string | null = null;
    if (isOnline) {
      const [kind, ref] = data.paymentMethod.split(":");
      if (kind === "custom") {
        const { data: gw } = await sb
          .from("custom_payment_gateways")
          .select("id,name")
          .eq("id", ref)
          .eq("store_id", data.storeId)
          .eq("is_active", true)
          .maybeSingle();
        if (!gw) throw new Error("Payment gateway unavailable");
        gatewayId = (gw as any).id;
        gatewayName = (gw as any).name;
      } else {
        const { data: p } = await sb
          .from("platform_payment_gateways")
          .select("id,label")
          .eq("id", ref)
          .maybeSingle();
        gatewayName = (p as any)?.label ?? ref;
      }
    }

    // ---- Service order extras (isolated from every other checkout type) ----
    let serviceFulfillment: any = null;
    let serviceAutoConfirm = false;
    if (allService) {
      const { normalizeSettings } = await import("@/lib/service-checkout.server");
      const { advanceAmount } = await import("@/lib/service-checkout");
      const { data: srow } = await sb
        .from("service_checkout_settings")
        .select("*")
        .eq("store_id", data.storeId)
        .maybeSingle();
      const settings = normalizeSettings(data.storeId, srow);
      const grandTotal = Math.max(0, subtotal + delivery_amount - discount_amount);
      const wantsAdvance =
        settings.payment_mode === "advance_required" ||
        (settings.payment_mode === "advance" && data.service?.paymentPlan === "advance");
      const payNow = wantsAdvance ? advanceAmount(grandTotal, settings) : grandTotal;
      serviceAutoConfirm = settings.auto_confirm;
      const firstProduct = byId.get(data.items[0].productId) as any;
      const smeta = ((firstProduct?.meta ?? {}) as any).service ?? {};
      serviceFulfillment = {
        package: servicePackage,
        addons: serviceAddons,
        answers: data.service?.answers ?? {},
        website: data.service?.website ?? null,
        business_name: data.service?.businessName ?? null,
        language: data.service?.language ?? null,
        contact_channel: data.service?.contactChannel ?? null,
        contact_time: data.service?.contactTime ?? null,
        delivery_time: servicePackage
          ? (smeta.packages ?? []).find((p: any) => (p.key ?? p.name) === servicePackage!.key)?.delivery_time ??
            smeta.delivery?.time ??
            null
          : (smeta.delivery?.time ?? null),
        revisions: smeta.revisions ?? null,
        total: grandTotal,
        payment_plan: wantsAdvance ? "advance" : "full",
        advance_amount: wantsAdvance ? payNow : null,
        balance_due: wantsAdvance ? Math.max(0, grandTotal - payNow) : 0,
        tags: settings.order_tags,
        staff_notes: settings.staff_notes ?? null,
        auto_invoice: settings.auto_invoice,
        assigned_status: "unassigned",
      };
    }

    const { data: order, error: oErr } = await sb
      .from("orders")
      .insert({
        store_id: data.storeId,
        customer_id: customerId,
        customer_name: data.customerName,
        phone: data.phone,
        address:
          (data.address ?? "").trim() ||
          (allService
            ? "Service booking — no shipment"
            : allSubscription
              ? "Subscription — no shipment"
              : "Digital delivery — no shipment"),

        area: data.area ?? null,
        email: data.email ?? null,
        company: data.company ?? null,
        country: data.country ?? null,

        payment_method: dbMethod,
        payment_gateway_id: gatewayId,
        payment_gateway_name: gatewayName,
        payment_status: "unpaid",
        txn_id: data.txnId ?? null,
        notes: data.notes ?? null,
        subtotal: subtotal + delivery_amount - discount_amount,
        delivery_amount,
        discount_amount,
        coupon_id,
        delivery_zone_id: zoneId,
        status: orderStatus,
        fingerprint: data.fingerprint ?? null,
        device_id: data.deviceId ?? null,
        order_type: orderType,
        ...(serviceFulfillment ? { fulfillment_meta: { service: serviceFulfillment } } : {}),
        ...(subscriptionFulfillment
          ? { fulfillment_meta: { subscription: subscriptionFulfillment } }
          : {}),

      } as any)
      .select("id")
      .single();
    if (oErr || !order) throw new Error(oErr?.message ?? "Order failed");

    // Attach the files the shopper uploaded before the order existed and
    // auto-confirm when the store owner configured it.
    if (allService) {
      try {
        if (data.service?.uploadToken) {
          await sb
            .from("service_order_files")
            .update({ order_id: order.id } as any)
            .eq("upload_token", data.service.uploadToken)
            .eq("store_id", data.storeId);
        }
        if (serviceAutoConfirm) {
          await sb.from("orders").update({ status: "confirmed" } as any).eq("id", order.id);
        }
      } catch {
        /* non-fatal */
      }
    }


    const { error: iErr } = await sb
      .from("order_items")
      .insert(itemRows.map((r) => ({ ...r, order_id: order.id })));
    if (iErr) throw new Error(iErr.message);

    // Digital fulfilment: create the entitlements now (locked), and unlock
    // straight away when there is nothing to pay.
    if (hasDigital) {
      try {
        const { grantDigitalAccess } = await import("@/lib/digital.server");
        const { handlePaymentConfirmed } = await import("@/lib/orders-confirm.server");
        const orderTotal = subtotal + delivery_amount - discount_amount;
        await grantDigitalAccess(sb as any, order.id);
        if (orderTotal <= 0) await handlePaymentConfirmed(sb as any, order.id);
      } catch { /* non-fatal */ }
    }

    // Subscription billing: create the subscription record (pending) plus its
    // first invoice. Free plans / trials activate immediately.
    if (allSubscription) {
      try {
        const { createSubscriptionForOrder, activateSubscriptionForOrder } = await import(
          "@/lib/subscriptions.server"
        );
        const { handlePaymentConfirmed } = await import("@/lib/orders-confirm.server");
        await createSubscriptionForOrder(sb as any, order.id);
        const orderTotal = subtotal + delivery_amount - discount_amount;
        if (orderTotal <= 0) {
          await sb
            .from("orders")
            .update({ payment_status: "paid", status: "confirmed" } as any)
            .eq("id", order.id);
          await activateSubscriptionForOrder(sb as any, order.id);
          await handlePaymentConfirmed(sb as any, order.id);
        }
      } catch {
        /* non-fatal */
      }
    }





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

    // Queue an AI order-confirmation call when the store has AI calling running.
    try {
      const { enqueueOrderConfirmationCall } = await import("@/lib/ai-call-provision.server");
      await enqueueOrderConfirmationCall(sb, data.storeId, order.id);
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


/**
 * Shopper-facing payment timeline: a sanitized view of what the gateway told
 * us about this order. Never exposes raw payloads, headers or credentials.
 */
export const getOrderPaymentTimeline = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(
        "id,store_id,invoice_no,payment_method,payment_status,payment_ref,payment_gateway_id,created_at,updated_at",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) return null;
    const o = order as any;

    const refs = [o.payment_ref, o.invoice_no, o.id].filter(Boolean).map(String);
    const inList = `(${refs.map((r) => `"${r.replace(/["\\]/g, "")}"`).join(",")})`;

    let gatewayLabel: string | null = null;
    if (o.payment_gateway_id) {
      const { data: gw } = await supabaseAdmin
        .from("custom_payment_gateways")
        .select("name,environment")
        .eq("id", o.payment_gateway_id)
        .maybeSingle();
      if (gw) gatewayLabel = (gw as any).name ?? null;
    }

    type Ev = {
      at: string;
      source: string;
      status: string | null;
      ok: boolean | null;
      message: string | null;
      amount: number | null;
      currency: string | null;
    };
    const events: Ev[] = [];

    if (refs.length) {
      const [{ data: customEvents }, { data: builtinEvents }] = await Promise.all([
        supabaseAdmin
          .from("custom_payment_gateway_events")
          .select("created_at,normalized_status,processing_status,error_message,signature_valid,provider_ref")
          .eq("store_id", o.store_id)
          .filter("provider_ref", "in", inList)
          .order("created_at", { ascending: true })
          .limit(20),
        supabaseAdmin
          .from("payment_webhook_events")
          .select("received_at,verified_status,error_message,signature_valid,amount,currency,provider_ref,source")
          .eq("store_id", o.store_id)
          .filter("provider_ref", "in", inList)
          .order("received_at", { ascending: true })
          .limit(20),
      ]);

      for (const e of (customEvents ?? []) as any[]) {
        events.push({
          at: e.created_at,
          source: gatewayLabel ?? "Payment gateway",
          status: e.normalized_status ?? e.processing_status ?? null,
          ok: e.processing_status === "processed" ? true : e.processing_status === "received" ? null : false,
          message: e.error_message ?? null,
          amount: null,
          currency: null,
        });
      }
      for (const e of (builtinEvents ?? []) as any[]) {
        events.push({
          at: e.received_at,
          source: gatewayLabel ?? "Payment gateway",
          status: e.verified_status ?? null,
          ok: e.verified_status === "paid" ? true : e.verified_status === "failed" ? false : null,
          message: e.error_message ?? null,
          amount: e.amount != null ? Number(e.amount) : null,
          currency: e.currency ?? null,
        });
      }
      events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    }

    return {
      payment_status: (o.payment_status ?? "pending") as string,
      payment_method: o.payment_method as string,
      gateway_label: gatewayLabel,
      reference: o.payment_ref ?? o.invoice_no ?? null,
      initiated_at: o.created_at as string,
      settled_at: o.payment_status === "paid" ? ((o.updated_at as string) ?? null) : null,
      events,
    };
  });
