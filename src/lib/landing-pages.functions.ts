// Server functions for Landing Page Integrations — Store Admin CRUD,
// credential rotation, product/field mapping, logs, and test order.
import { createServerFn } from "@tanstack/react-start";
import { myStoreRow } from "@/lib/store-access";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.string().uuid();

async function assertOwnedConnection(
  supabase: any,
  connectionId: string,
): Promise<{ id: string; store_id: string }> {
  const { data, error } = await supabase
    .from("landing_page_connections")
    .select("id,store_id")
    .eq("id", connectionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Connection not found");
  return data;
}

async function myStoreId(supabase: any, userId: string): Promise<string> {
  const data = await myStoreRow(supabase, userId, "id", "landing_pages");
  if (!data) throw new Error("No store found for current user");
  return data.id;
}

export const listLandingPageConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("landing_page_connections")
      .select(
        "id,name,landing_page_name,url,platform,method,status,default_product_id,orders_received,failed_count,last_order_at,last_error,last_error_at,created_at",
      )
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const landingPageStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const storeId = await myStoreId(sb, context.userId);
    const [connsRes, ordersRes, todayRes, failRes] = await Promise.all([
      sb.from("landing_page_connections").select("id,status,last_order_at").eq("store_id", storeId),
      sb.from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("source", "landing_page"),
      sb.from("orders").select("id", { count: "exact", head: true })
        .eq("store_id", storeId).eq("source", "landing_page")
        .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      sb.from("landing_page_logs").select("id", { count: "exact", head: true })
        .eq("store_id", storeId).in("status", ["failed", "unauthorized", "invalid"])
        .gte("received_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ]);
    const conns = (connsRes.data ?? []) as any[];
    const lastOrder = conns.reduce<string | null>((a, c) => {
      if (!c.last_order_at) return a;
      if (!a || c.last_order_at > a) return c.last_order_at;
      return a;
    }, null);
    return {
      connected: conns.length,
      active: conns.filter((c) => c.status === "active").length,
      orders_received: ordersRes.count ?? 0,
      orders_today: todayRes.count ?? 0,
      failed_24h: failRes.count ?? 0,
      last_order_at: lastOrder,
    };
  });

export const getLandingPageConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: idSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwnedConnection(context.supabase, data.id);
    // Credential rows are never readable by client roles; read them with the
    // service-role client only after ownership has been proven above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [connRes, credRes, mapsRes, fmapRes] = await Promise.all([
      context.supabase.from("landing_page_connections").select("*").eq("id", data.id).maybeSingle(),
      supabaseAdmin
        .from("landing_page_credentials")
        .select("api_key_last4,rotated_at,webhook_secret_enc,api_key_hash")
        .eq("connection_id", data.id)
        .maybeSingle(),
      context.supabase.from("landing_page_product_map").select("*").eq("connection_id", data.id),
      context.supabase.from("landing_page_field_map").select("mapping").eq("connection_id", data.id).maybeSingle(),
    ]);
    return {
      connection: connRes.data,
      credentials: credRes.data
        ? {
            api_key_last4: credRes.data.api_key_last4,
            rotated_at: credRes.data.rotated_at,
            has_webhook_secret: !!credRes.data.webhook_secret_enc,
            has_api_key: !!credRes.data.api_key_hash,
          }
        : null,
      product_map: mapsRes.data ?? [],
      field_map: (fmapRes.data?.mapping as any) ?? {},
    };
  });

export const createLandingPageConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        landing_page_name: z.string().trim().max(120).optional(),
        url: z.string().trim().max(500).optional(),
        description: z.string().trim().max(1000).optional(),
        platform: z
          .enum([
            "custom", "wordpress", "woocommerce", "shopify", "webflow", "wix",
            "custom_php", "custom_react", "universal", "other",
          ])
          .default("custom"),
        method: z.enum(["webhook", "api", "embed"]).default("webhook"),
        default_product_id: idSchema.optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateApiKey, generateWebhookSecret } = await import("@/lib/landing-pages.server");
    const { data: conn, error } = await supabaseAdmin
      .from("landing_page_connections")
      .insert({
        store_id: storeId,
        name: data.name,
        landing_page_name: data.landing_page_name ?? null,
        url: data.url ?? null,
        description: data.description ?? null,
        platform: data.platform,
        method: data.method,
        default_product_id: data.default_product_id ?? null,
        status: "active",
      })
      .select("id")
      .single();
    if (error || !conn) throw new Error(error?.message ?? "Failed to create connection");

    // Mint initial credentials for both methods so users can switch later.
    const api = generateApiKey();
    const secret = generateWebhookSecret();
    await supabaseAdmin.from("landing_page_credentials").insert({
      connection_id: conn.id,
      webhook_secret_enc: secret.encrypted,
      api_key_hash: api.hash,
      api_key_last4: api.last4,
    });

    return {
      id: conn.id,
      // Plaintext returned ONCE at creation for user to copy.
      api_key: api.plaintext,
      webhook_secret: secret.plaintext,
    };
  });

export const updateLandingPageConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: idSchema,
        name: z.string().trim().min(1).max(120).optional(),
        landing_page_name: z.string().trim().max(120).nullable().optional(),
        url: z.string().trim().max(500).nullable().optional(),
        description: z.string().trim().max(1000).nullable().optional(),
        default_product_id: idSchema.nullable().optional(),
        status: z.enum(["active", "paused"]).optional(),
        method: z.enum(["webhook", "api", "embed"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwnedConnection(context.supabase, data.id);
    const { id, ...rest } = data;
    const { error } = await context.supabase
      .from("landing_page_connections")
      .update(rest)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLandingPageConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: idSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwnedConnection(context.supabase, data.id);
    const { error } = await context.supabase
      .from("landing_page_connections")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rotateLandingPageWebhookSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: idSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwnedConnection(context.supabase, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateWebhookSecret } = await import("@/lib/landing-pages.server");
    const s = generateWebhookSecret();
    const { error } = await supabaseAdmin
      .from("landing_page_credentials")
      .upsert({
        connection_id: data.id,
        webhook_secret_enc: s.encrypted,
        rotated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return { webhook_secret: s.plaintext };
  });

export const rotateLandingPageApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: idSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwnedConnection(context.supabase, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateApiKey } = await import("@/lib/landing-pages.server");
    const k = generateApiKey();
    const { error } = await supabaseAdmin
      .from("landing_page_credentials")
      .upsert({
        connection_id: data.id,
        api_key_hash: k.hash,
        api_key_last4: k.last4,
        rotated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return { api_key: k.plaintext };
  });

export const revokeLandingPageApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: idSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwnedConnection(context.supabase, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("landing_page_credentials")
      .update({ api_key_hash: null, api_key_last4: null, rotated_at: new Date().toISOString() })
      .eq("connection_id", data.id);
    return { ok: true };
  });

export const setLandingPageProductMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: idSchema,
        rows: z.array(
          z.object({
            external_id: z.string().trim().max(120).nullable().optional(),
            external_sku: z.string().trim().max(120).nullable().optional(),
            store_product_id: idSchema.nullable(),
            qty_multiplier: z.number().min(0.01).max(100).default(1),
          }),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwnedConnection(context.supabase, data.id);
    const sb = context.supabase;
    await sb.from("landing_page_product_map").delete().eq("connection_id", data.id);
    if (data.rows.length) {
      const { error } = await sb.from("landing_page_product_map").insert(
        data.rows.map((r) => ({ ...r, connection_id: data.id })),
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const setLandingPageFieldMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: idSchema,
        mapping: z.record(z.string(), z.string().trim().max(80)),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwnedConnection(context.supabase, data.id);
    const { error } = await context.supabase.from("landing_page_field_map").upsert({
      connection_id: data.id,
      mapping: data.mapping as Record<string, string>,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLandingPageLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: idSchema, limit: z.number().int().min(1).max(200).default(50) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwnedConnection(context.supabase, data.id);
    const { data: rows, error } = await context.supabase
      .from("landing_page_logs")
      .select("id,received_at,status,external_order_id,order_id,ip,error,processing_ms,request_snippet")
      .eq("connection_id", data.id)
      .order("received_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const sendLandingPageTestOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: idSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const conn = await assertOwnedConnection(context.supabase, data.id);
    const { intakeLandingPageOrder } = await import("@/lib/landing-pages.server");
    const body = JSON.stringify({
      customer_name: "Test Customer",
      phone: "01700000000",
      address: "Test Address, Dhaka",
      area: "Dhaka",
      quantity: 1,
      note: "Automated test order — safe to delete",
      external_order_id: "TEST-" + Date.now(),
    });
    const result = await intakeLandingPageOrder({
      connectionId: conn.id,
      rawBody: body,
      method: "embed",
      ip: null,
      ua: "landing-page-test",
      auth: {},
      isTest: true,
    });
    return result;
  });
