// Store-owner Payment Gateway management.
// All state-changing functions are gated by requireSupabaseAuth + store ownership via RLS.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PROVIDERS, getProvider, listProviderMeta } from "@/lib/subscription-pay/providers/registry";

const providerIdSchema = z.string().min(1).max(64);

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

/**
 * Returns the merged catalog: every provider enabled by Winner Admin, joined
 * with this store's connection row (if any). No secrets ever leave the server.
 */
export const listStorePaymentGateways = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStoreOwnership(context.supabase, data.storeId, context.userId);
    const [{ data: platform, error: pErr }, { data: rows, error: rErr }] = await Promise.all([
      context.supabase
        .from("platform_payment_gateways")
        .select("id,label,enabled,sort_order,logo_url,notes")
        .eq("enabled", true)
        .order("sort_order", { ascending: true }),
      context.supabase
        .from("store_payment_gateways")
        .select("provider_id,sandbox,enabled,is_active,status,last_tested_at,last_test_result,connected_at,credentials_preview")
        .eq("store_id", data.storeId),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (rErr) throw new Error(rErr.message);
    const byId = new Map((rows ?? []).map((r: any) => [r.provider_id, r]));
    return (platform ?? []).map((p: any) => {
      const meta = PROVIDERS[p.id]?.meta;
      const conn = byId.get(p.id) ?? null;
      return {
        provider_id: p.id,
        label: p.label,
        logo_url: p.logo_url,
        notes: p.notes,
        methods: meta?.methods ?? [],
        supportsSandbox: meta?.supportsSandbox ?? false,
        credentialFields: meta?.credentialFields ?? [],
        connection: conn
          ? {
              sandbox: conn.sandbox,
              enabled: conn.enabled,
              is_active: conn.is_active,
              status: conn.status,
              last_tested_at: conn.last_tested_at,
              last_test_result: conn.last_test_result,
              connected_at: conn.connected_at,
              credentials_preview: conn.credentials_preview,
              has_credentials: !!conn.credentials_preview,
            }
          : null,
      };
    });
  });

export const saveStorePaymentGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.string().uuid(),
        providerId: providerIdSchema,
        credentials: z.record(z.string(), z.union([z.string(), z.boolean()])),
        sandbox: z.boolean().default(true),
        enabled: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStoreOwnership(context.supabase, data.storeId, context.userId);
    const provider = getProvider(data.providerId);

    // Merge with existing credentials so partial updates work (empty password field = keep old value)
    const { data: existing } = await context.supabase
      .from("store_payment_gateways")
      .select("id")
      .eq("store_id", data.storeId)
      .eq("provider_id", data.providerId)
      .maybeSingle();

    const { encryptJSON, decryptJSON, credentialsPreview } = await import("@/lib/crypto/credentials.server");
    let mergedCreds: Record<string, unknown> = { ...data.credentials };
    if (existing) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: full } = await supabaseAdmin
        .from("store_payment_gateways")
        .select("credentials_ciphertext")
        .eq("id", existing.id)
        .maybeSingle();
      if (full?.credentials_ciphertext) {
        try {
          const prev = decryptJSON<Record<string, unknown>>(full.credentials_ciphertext);
          for (const k of Object.keys(prev)) {
            const nv = mergedCreds[k];
            if (typeof nv === "string" && nv.trim() === "") mergedCreds[k] = prev[k];
            else if (nv === undefined) mergedCreds[k] = prev[k];
          }
        } catch {
          /* discard */
        }
      }
    }

    // Validate credentials before saving via adapter testConnection.
    const test = await provider.testConnection({ credentials: mergedCreds as any, sandbox: data.sandbox });
    if (!test.ok) {
      return { ok: false as const, error: test.message, latency_ms: test.latency_ms };
    }

    const ciphertext = encryptJSON(mergedCreds);
    const preview = credentialsPreview(mergedCreds as Record<string, unknown>);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();
    const { error: upErr } = await supabaseAdmin.from("store_payment_gateways").upsert(
      {
        store_id: data.storeId,
        provider_id: data.providerId,
        credentials_ciphertext: ciphertext,
        credentials_preview: preview,
        sandbox: data.sandbox,
        enabled: data.enabled,
        status: "connected",
        last_tested_at: nowIso,
        last_test_result: { ok: true, message: test.message, latency_ms: test.latency_ms },
        connected_at: nowIso,
      },
      { onConflict: "store_id,provider_id" },
    );
    if (upErr) throw new Error(upErr.message);
    return { ok: true as const, message: test.message, latency_ms: test.latency_ms };
  });

export const testStorePaymentGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ storeId: z.string().uuid(), providerId: providerIdSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStoreOwnership(context.supabase, data.storeId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("store_payment_gateways")
      .select("credentials_ciphertext,sandbox")
      .eq("store_id", data.storeId)
      .eq("provider_id", data.providerId)
      .maybeSingle();
    if (!row?.credentials_ciphertext) throw new Error("Gateway is not connected");
    const { decryptJSON } = await import("@/lib/crypto/credentials.server");
    const creds = decryptJSON<Record<string, unknown>>(row.credentials_ciphertext);
    const provider = getProvider(data.providerId);
    const res = await provider.testConnection({ credentials: creds as any, sandbox: !!row.sandbox });
    await supabaseAdmin
      .from("store_payment_gateways")
      .update({
        status: res.ok ? "connected" : "error",
        last_tested_at: new Date().toISOString(),
        last_test_result: { ok: res.ok, message: res.message, latency_ms: res.latency_ms },
      })
      .eq("store_id", data.storeId)
      .eq("provider_id", data.providerId);
    return res;
  });

export const setActiveStorePaymentGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ storeId: z.string().uuid(), providerId: providerIdSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStoreOwnership(context.supabase, data.storeId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Clear others first (partial unique index enforces at most one)
    await supabaseAdmin
      .from("store_payment_gateways")
      .update({ is_active: false })
      .eq("store_id", data.storeId)
      .neq("provider_id", data.providerId);
    const { error } = await supabaseAdmin
      .from("store_payment_gateways")
      .update({ is_active: true, enabled: true })
      .eq("store_id", data.storeId)
      .eq("provider_id", data.providerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleStorePaymentGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ storeId: z.string().uuid(), providerId: providerIdSchema, enabled: z.boolean() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStoreOwnership(context.supabase, data.storeId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { enabled: data.enabled };
    if (!data.enabled) patch.is_active = false;
    const { error } = await supabaseAdmin
      .from("store_payment_gateways")
      .update(patch)
      .eq("store_id", data.storeId)
      .eq("provider_id", data.providerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectStorePaymentGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ storeId: z.string().uuid(), providerId: providerIdSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStoreOwnership(context.supabase, data.storeId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("store_payment_gateways")
      .delete()
      .eq("store_id", data.storeId)
      .eq("provider_id", data.providerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Owner-side management --------

async function assertOwner(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const listPlatformPaymentGateways = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("platform_payment_gateways")
      .select("id,label,enabled,sort_order,logo_url,notes,updated_at")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    const meta = listProviderMeta();
    return (data ?? []).map((row: any) => ({
      ...row,
      methods: meta.find((m) => m.id === row.id)?.methods ?? [],
    }));
  });

export const togglePlatformPaymentGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ providerId: providerIdSchema, enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("platform_payment_gateways")
      .update({ enabled: data.enabled })
      .eq("id", data.providerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertPlatformPaymentGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        providerId: providerIdSchema,
        label: z.string().min(1).max(80),
        sort_order: z.number().int().min(0).max(9999).default(100),
        logo_url: z.string().url().nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("platform_payment_gateways").upsert(
      {
        id: data.providerId,
        label: data.label,
        sort_order: data.sort_order,
        logo_url: data.logo_url ?? null,
        notes: data.notes ?? null,
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
