// Server functions for the Custom Payment Gateway Builder.
// All state-changing endpoints go through requireSupabaseAuth + store ownership.
// Secret credentials never leave the server: they are encrypted at rest and
// stripped from every response.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CustomGatewayConfigSchema,
  AUTH_TYPES,
  type CustomGatewayPublic,
  type AuthType,
} from "./types";
import type { PlatformStatus } from "./types";

const storeIdSchema = z.string().uuid();

async function assertStoreOwnership(supabase: any, storeId: string, userId: string) {
  const { data, error } = await supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Store not found or access denied");
}

async function loadGatewayOwned(gatewayId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("custom_payment_gateways")
    .select("*")
    .eq("id", gatewayId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Gateway not found");
  const { data: storeRow } = await supabaseAdmin
    .from("stores")
    .select("owner_user_id")
    .eq("id", data.store_id)
    .maybeSingle();
  if (!storeRow || storeRow.owner_user_id !== userId) throw new Error("Access denied");
  return data as any;
}

function toPublic(row: any): CustomGatewayPublic {
  return {
    id: row.id,
    store_id: row.store_id,
    name: row.name,
    slug: row.slug,
    logo_url: row.logo_url ?? null,
    description: row.description ?? null,
    website_url: row.website_url ?? null,
    docs_url: row.docs_url ?? null,
    support_email: row.support_email ?? null,
    currency: row.currency,
    currencies: row.currencies ?? [row.currency],
    status: row.status,
    environment: row.environment,
    auth_type: row.auth_type,
    api_base_url: row.api_base_url ?? null,
    sandbox_base_url: row.sandbox_base_url ?? null,
    config: row.config ?? {},
    credentials_preview: row.credentials_preview ?? null,
    has_credentials: !!row.credentials_ciphertext,
    is_default: !!row.is_default,
    is_active: !!row.is_active,
    last_tested_at: row.last_tested_at ?? null,
    last_test_result: row.last_test_result ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function audit(storeId: string, gatewayId: string | null, userId: string, action: string, meta: unknown = {}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("custom_payment_gateway_audit").insert({
      store_id: storeId,
      gateway_id: gatewayId,
      actor_user_id: userId,
      action,
      meta: meta as any,
    });
  } catch {
    /* audit best-effort */
  }
}

// ------------ LIST -----------------------------------------------------------

export const listCustomGateways = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: storeIdSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStoreOwnership(context.supabase, data.storeId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("custom_payment_gateways")
      .select("*")
      .eq("store_id", data.storeId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map(toPublic) as any;
  });

export const getCustomGateway = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const row = await loadGatewayOwned(data.id, context.userId);
    return toPublic(row) as any;
  });

// ------------ SAVE (create / update) ----------------------------------------

const SaveInput = z.object({
  storeId: storeIdSchema,
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(40).regex(/^[a-z0-9][a-z0-9_-]*$/i, "Invalid slug"),
  logo_url: z.string().max(500).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  website_url: z.string().max(500).optional().nullable(),
  docs_url: z.string().max(500).optional().nullable(),
  support_email: z.string().max(160).optional().nullable(),
  currency: z.string().min(3).max(8),
  currencies: z.array(z.string().min(3).max(8)).min(1).max(20),
  environment: z.enum(["sandbox", "production"]),
  auth_type: z.enum(AUTH_TYPES),
  api_base_url: z.string().max(500).optional().nullable(),
  sandbox_base_url: z.string().max(500).optional().nullable(),
  config: CustomGatewayConfigSchema,
  /** Provided ONLY when the owner is (re)entering secrets. */
  credentials: z.record(z.string(), z.string()).optional(),
});

function credentialPreview(auth: AuthType, creds: Record<string, string>): string {
  const candidates: Record<AuthType, string[]> = {
    api_key: ["api_key"],
    api_key_secret: ["api_key"],
    bearer: ["bearer_token"],
    basic: ["username"],
    oauth2: ["client_id"],
    hmac: ["hmac_secret"],
    custom_header: ["custom_header_value"],
    none: [],
  };
  for (const k of candidates[auth] ?? []) {
    const v = creds[k];
    if (typeof v === "string" && v.length >= 4) return "••••" + v.slice(-4);
  }
  return "••••••";
}

export const saveCustomGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SaveInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertStoreOwnership(context.supabase, data.storeId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let ciphertext: string | null | undefined;
    let preview: string | null | undefined;
    if (data.credentials && Object.keys(data.credentials).length > 0) {
      const { encryptJSON } = await import("@/lib/crypto/credentials.server");
      ciphertext = encryptJSON(data.credentials);
      preview = credentialPreview(data.auth_type, data.credentials);
    }

    const patch: Record<string, unknown> = {
      store_id: data.storeId,
      name: data.name,
      slug: data.slug.toLowerCase(),
      logo_url: data.logo_url ?? null,
      description: data.description ?? null,
      website_url: data.website_url ?? null,
      docs_url: data.docs_url ?? null,
      support_email: data.support_email ?? null,
      currency: data.currency.toUpperCase(),
      currencies: data.currencies.map((c) => c.toUpperCase()),
      environment: data.environment,
      auth_type: data.auth_type,
      api_base_url: data.api_base_url ?? null,
      sandbox_base_url: data.sandbox_base_url ?? null,
      config: data.config,
    };
    if (ciphertext !== undefined) {
      patch.credentials_ciphertext = ciphertext;
      patch.credentials_preview = preview;
    }

    let saved: any;
    if (data.id) {
      const owned = await loadGatewayOwned(data.id, context.userId);
      if (owned.store_id !== data.storeId) throw new Error("Store mismatch");
      const { data: row, error } = await supabaseAdmin
        .from("custom_payment_gateways")
        .update(patch as any)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      saved = row;
      await audit(data.storeId, saved.id, context.userId, "gateway_updated");
    } else {
      const { data: row, error } = await supabaseAdmin
        .from("custom_payment_gateways")
        .insert({ ...patch, status: "draft" } as any)
        .select("*")
        .single();
      if (error) {
        if (String(error.message).match(/duplicate/i)) throw new Error("A gateway with this slug already exists");
        throw new Error(error.message);
      }
      saved = row;
      await audit(data.storeId, saved.id, context.userId, "gateway_created");
    }

    return toPublic(saved) as any;
  });

export const deleteCustomGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const owned = await loadGatewayOwned(data.id, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("custom_payment_gateways").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(owned.store_id, null, context.userId, "gateway_deleted", { slug: owned.slug });
    return { ok: true };
  });

export const setCustomGatewayEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const owned = await loadGatewayOwned(data.id, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const status = data.enabled ? (owned.status === "disabled" ? "connected" : owned.status) : "disabled";
    const { error } = await supabaseAdmin
      .from("custom_payment_gateways")
      .update({ is_active: data.enabled, status } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(owned.store_id, data.id, context.userId, data.enabled ? "gateway_enabled" : "gateway_disabled");
    return { ok: true };
  });

// ------------ TEST -----------------------------------------------------------

export const testCustomGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      /** Optional owner-supplied credentials to test without saving. */
      credentialsOverride: z.record(z.string(), z.string()).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const owned = await loadGatewayOwned(data.id, context.userId);
    const pub = toPublic(owned);
    let creds: Record<string, string> = {};
    if (data.credentialsOverride) creds = data.credentialsOverride;
    else if (owned.credentials_ciphertext) {
      const { decryptJSON } = await import("@/lib/crypto/credentials.server");
      try {
        creds = decryptJSON<Record<string, string>>(owned.credentials_ciphertext);
      } catch {
        creds = {};
      }
    }
    const { executeCheckout } = await import("./engine.server");
    const now = Date.now();
    const testOrderId = `TEST-${now}`;
    const proto =
      (context as any)?.request?.headers?.get?.("x-forwarded-proto") ?? "https";
    const host =
      (context as any)?.request?.headers?.get?.("host") ?? "orzen-commerce.lovable.app";
    const base = `${proto}://${host}`;
    const webhookUrl = `${base}/api/public/store-payments/custom-webhook/${owned.store_id}/${owned.id}`;
    const result = await executeCheckout(pub, creds, {
      order_id: testOrderId,
      amount: 10,
      currency: pub.currency,
      customer_name: "Test Customer",
      customer_email: "test@example.com",
      customer_phone: "01700000000",
      product_name: "Custom Gateway Connectivity Test",
      product_quantity: 1,
      shipping_address: "N/A",
      success_url: `${base}/thank-you?test=1`,
      cancel_url: `${base}/checkout?test=1`,
      fail_url: `${base}/checkout?test=1`,
      callback_url: `${base}/api/public/store-payments/custom-webhook/${owned.store_id}/${owned.id}?source=test`,
      webhook_url: `${webhookUrl}?source=test`,
      store_id: owned.store_id,
    });
    const summary = {
      ok: result.ok,
      status_code: result.status,
      redirect_url: result.redirect_url,
      provider_ref: result.provider_ref,
      provider_status: result.provider_status,
      message: result.message ?? (result.raw_text ? String(result.raw_text).slice(0, 300) : null),
      error: result.error ?? null,
      tested_at: new Date().toISOString(),
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("custom_payment_gateways")
      .update({
        last_tested_at: summary.tested_at,
        last_test_result: summary as any,
        status: result.ok ? "connected" : "error",
      })
      .eq("id", data.id);
    await audit(owned.store_id, data.id, context.userId, "gateway_tested", { ok: result.ok, status_code: result.status });
    return summary;
  });

// ------------ WEBHOOK EVENTS (viewer) ---------------------------------------

export const listCustomGatewayEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ gatewayId: z.string().uuid(), limit: z.number().int().min(1).max(100).default(20) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const owned = await loadGatewayOwned(data.gatewayId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("custom_payment_gateway_events")
      .select("id, event_id, event_type, provider_ref, normalized_status, signature_valid, processing_status, error_message, created_at")
      .eq("gateway_id", data.gatewayId)
      .eq("store_id", owned.store_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export type PublicPaymentStatus = PlatformStatus;
