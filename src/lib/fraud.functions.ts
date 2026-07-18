// Fraud checker server functions.
// All privileged provider/credential access happens inside handlers via supabaseAdmin.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertPlan } from "@/lib/plan-guard";

const MAX_CHECKS = 2;

async function ownerOnly(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (!data) throw new Error("Forbidden");
}

async function myStoreId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

function mask(v: string | null | undefined): string | null {
  if (!v) return null;
  if (v.length <= 6) return "•".repeat(v.length);
  return `${v.slice(0, 3)}${"•".repeat(Math.max(4, v.length - 6))}${v.slice(-3)}`;
}

// ---------------- PUBLIC (any authenticated store owner) ----------------
export const getFraudPublicStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("get_fraud_public_status");
    return (data as any) ?? { enabled: false, show_in_order_details: true, enable_manual_check: true, enable_auto_check_before_courier: false };
  });

// ---------------- OWNER ADMIN ----------------
export const getFraudSettingsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ownerOnly(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("fraud_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = (data as any) ?? {};
    return {
      ...row,
      api_key_masked: mask(row.api_key),
      api_secret_masked: mask(row.api_secret),
      has_api_key: !!row.api_key,
      api_key: undefined,
      api_secret: undefined,
    };
  });

export const updateFraudSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        enabled: z.boolean().optional(),
        provider: z.string().max(50).optional(),
        api_key: z.string().max(500).optional().nullable(),
        api_secret: z.string().max(500).optional().nullable(),
        enable_manual_check: z.boolean().optional(),
        enable_auto_check_before_courier: z.boolean().optional(),
        show_in_order_details: z.boolean().optional(),
        enable_analytics: z.boolean().optional(),
        thresholds: z
          .object({
            safe_max: z.number().min(0).max(100),
            medium_max: z.number().min(0).max(100),
          })
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ownerOnly(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if ((k === "api_key" || k === "api_secret") && (v === "" || v === null)) continue;
      patch[k] = v;
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("fraud_settings")
      .update(patch as any)
      .eq("id", "global");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testFraudConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        phone: z.string().trim().min(6).max(20).default("01700000000"),
        api_key: z.string().trim().max(500).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ownerOnly(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg } = await supabaseAdmin
      .from("fraud_settings")
      .select("api_key")
      .eq("id", "global")
      .maybeSingle();
    const storedKey = (cfg as any)?.api_key as string | null;
    const apiKey = (data.api_key && data.api_key.length > 0) ? data.api_key : storedKey;
    const now = new Date().toISOString();
    if (!apiKey) {
      const err = "API key not set — enter a BD Courier token above or save one first";
      await supabaseAdmin.from("fraud_settings").update({
        last_test_at: now, last_test_ok: false, last_test_error: err, last_test_sample: null,
      }).eq("id", "global");
      return { ok: false as const, error: err, tested_at: now, phone: data.phone };
    }
    const started = Date.now();
    try {
      const { callBdCourier } = await import("@/lib/fraud.server");
      const stats = await callBdCourier(data.phone, apiKey);
      const latency_ms = Date.now() - started;
      const sample = {
        total: stats.total_orders,
        success: stats.successful,
        returned: stats.returned,
        cancelled: stats.cancelled,
        couriers: stats.courier_history?.length ?? 0,
      };
      await supabaseAdmin.from("fraud_settings").update({
        last_test_at: now, last_test_ok: true, last_test_error: null, last_test_sample: sample,
      }).eq("id", "global");
      return { ok: true as const, sample, latency_ms, tested_at: now, phone: data.phone };
    } catch (e) {
      const err = (e as Error).message;
      const latency_ms = Date.now() - started;
      await supabaseAdmin.from("fraud_settings").update({
        last_test_at: now, last_test_ok: false, last_test_error: err, last_test_sample: null,
      }).eq("id", "global");
      return { ok: false as const, error: err, latency_ms, tested_at: now, phone: data.phone };
    }
  });


// ---------------- STORE OWNER ----------------
// Internal core: performs (or reuses) a fraud check with strict count enforcement.
async function performFraudCheck(opts: {
  supabaseAdmin: any;
  storeId: string;
  phone: string;
  orderId?: string | null;
  source: "system" | "admin";
  actorId: string;
  force: boolean;
  isOwner: boolean;
}) {
  const { supabaseAdmin, storeId, phone, orderId, source, actorId, force, isOwner } = opts;

  const { data: cfg } = await supabaseAdmin
    .from("fraud_settings")
    .select("enabled, api_key, thresholds")
    .eq("id", "global")
    .maybeSingle();
  if (!cfg || !(cfg as any).enabled) throw new Error("Fraud checker is not enabled by the platform");
  const apiKey = (cfg as any).api_key as string | null;
  if (!apiKey) throw new Error("Fraud checker API key is not configured");
  const thresholds = ((cfg as any).thresholds ?? { safe_max: 10, medium_max: 30 }) as {
    safe_max: number; medium_max: number;
  };

  // Existing cached row (if any)
  const { data: cached } = await supabaseAdmin
    .from("fraud_checks")
    .select("*")
    .eq("store_id", storeId)
    .eq("phone", phone)
    .maybeSingle();

  // No force => return cached as-is
  if (cached && !force) {
    return { ...(cached as any), cached: true, max_checks: MAX_CHECKS };
  }

  // Force path: enforce max unless owner
  if (cached && force && !isOwner && ((cached as any).check_count ?? 0) >= MAX_CHECKS) {
    throw new Error("Maximum Fraud Check limit reached.");
  }

  const { callBdCourier, computeRisk } = await import("@/lib/fraud.server");
  const stats = await callBdCourier(phone, apiKey);
  const risk = computeRisk(stats, thresholds);
  const now = new Date().toISOString();
  const nextCount = cached ? Math.min(((cached as any).check_count ?? 0) + 1, MAX_CHECKS) : 1;

  const row: Record<string, any> = {
    store_id: storeId,
    order_id: orderId ?? (cached as any)?.order_id ?? null,
    phone,
    risk,
    score: stats.cod_success_rate,
    total_orders: stats.total_orders,
    successful: stats.successful,
    returned: stats.returned,
    cancelled: stats.cancelled,
    cod_success_rate: stats.cod_success_rate,
    last_delivery: stats.last_delivery,
    courier_history: stats.courier_history,
    raw: stats.raw,
    checked_by: actorId,
    checked_at: now,
    last_check_source: source,
    last_check_by: actorId,
    check_count: nextCount,
    first_checked_at: cached ? (cached as any).first_checked_at ?? (cached as any).checked_at : now,
  };
  const { data: up, error } = await supabaseAdmin
    .from("fraud_checks")
    .upsert(row, { onConflict: "store_id,phone" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { ...(up as any), cached: false, max_checks: MAX_CHECKS };
}

export const runFraudCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        phone: z.string().trim().min(6).max(20),
        order_id: z.string().uuid().optional(),
        force: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "fraud_checker" as any);
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { data: isOwner } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "owner" });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return performFraudCheck({
      supabaseAdmin,
      storeId: sid,
      phone: data.phone,
      orderId: data.order_id,
      source: "admin",
      actorId: context.userId,
      force: !!data.force,
      isOwner: !!isOwner,
    });
  });

// Auto-runs the first fraud check for an order (system source) if none exists yet.
// Silently no-ops if fraud checker is disabled or plan not entitled.
export const ensureAutoFraudCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return null;
    // Load order to get phone under RLS
    const { data: order } = await context.supabase
      .from("orders")
      .select("id, phone, store_id")
      .eq("id", data.order_id)
      .maybeSingle();
    if (!order || (order as any).store_id !== sid) return null;
    const phone = (order as any).phone as string;
    if (!phone) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // If already exists, return cached (don't call provider)
    const { data: cached } = await supabaseAdmin
      .from("fraud_checks")
      .select("*")
      .eq("store_id", sid)
      .eq("phone", phone)
      .maybeSingle();
    if (cached) return { ...(cached as any), cached: true, max_checks: MAX_CHECKS };

    // Only auto-run if plan + feature enabled; swallow errors so UI doesn't break
    try {
      await assertPlan(context.supabase, context.userId, "fraud_checker" as any);
      return await performFraudCheck({
        supabaseAdmin,
        storeId: sid,
        phone,
        orderId: data.order_id,
        source: "system",
        actorId: context.userId,
        force: true, // first check
        isOwner: false,
      });
    } catch {
      return null;
    }
  });

export const getCachedFraudCheck = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ phone: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return null;
    const { data: row } = await context.supabase
      .from("fraud_checks")
      .select("*")
      .eq("store_id", sid)
      .eq("phone", data.phone)
      .maybeSingle();
    if (!row) return null;
    return { ...(row as any), max_checks: MAX_CHECKS };
  });

// Owner-only: reset the check counter for a phone (or by check id) so admin can re-check again.
export const resetFraudCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      store_id: z.string().uuid().optional(),
      phone: z.string().trim().min(6).max(20).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ownerOnly(context.supabase, context.userId);
    if (!data.id && !(data.store_id && data.phone)) {
      throw new Error("Provide id or store_id + phone");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("fraud_checks").update({ check_count: 0 });
    if (data.id) q = q.eq("id", data.id);
    else q = q.eq("store_id", data.store_id!).eq("phone", data.phone!);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Owner-only: recalculate totals from BD Courier and overwrite cached result
// without consuming the store's check limit.
export const resyncFraudCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      store_id: z.string().uuid().optional(),
      phone: z.string().trim().min(6).max(20).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ownerOnly(context.supabase, context.userId);
    if (!data.id && !(data.store_id && data.phone)) {
      throw new Error("Provide id or store_id + phone");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin.from("fraud_checks").select("*").limit(1);
    if (data.id) q = q.eq("id", data.id);
    else q = q.eq("store_id", data.store_id!).eq("phone", data.phone!);
    const { data: rows, error: selErr } = await q;
    if (selErr) throw new Error(selErr.message);
    const existing = (rows?.[0] as any) ?? null;
    const storeId = existing?.store_id ?? data.store_id;
    const phone = existing?.phone ?? data.phone;
    if (!storeId || !phone) throw new Error("No matching fraud check row");

    const { data: cfg } = await supabaseAdmin
      .from("fraud_settings")
      .select("enabled, api_key, thresholds")
      .eq("id", "global")
      .maybeSingle();
    if (!cfg || !(cfg as any).enabled) throw new Error("Fraud checker is not enabled");
    const apiKey = (cfg as any).api_key as string | null;
    if (!apiKey) throw new Error("Fraud checker API key is not configured");
    const thresholds = ((cfg as any).thresholds ?? { safe_max: 10, medium_max: 30 }) as {
      safe_max: number; medium_max: number;
    };

    const { callBdCourier, computeRisk } = await import("@/lib/fraud.server");
    const stats = await callBdCourier(phone, apiKey);
    const risk = computeRisk(stats, thresholds);
    const now = new Date().toISOString();

    const row: Record<string, any> = {
      store_id: storeId,
      phone,
      order_id: existing?.order_id ?? null,
      check_count: existing?.check_count ?? 1,
      first_checked_at: existing?.first_checked_at ?? existing?.checked_at ?? now,
      risk,
      score: stats.cod_success_rate,
      total_orders: stats.total_orders,
      successful: stats.successful,
      returned: stats.returned,
      cancelled: stats.cancelled,
      cod_success_rate: stats.cod_success_rate,
      last_delivery: stats.last_delivery,
      courier_history: stats.courier_history,
      raw: stats.raw,
      checked_by: context.userId,
      checked_at: now,
      last_check_source: "admin",
      last_check_by: context.userId,
    };
    const { data: up, error } = await supabaseAdmin
      .from("fraud_checks")
      .upsert(row, { onConflict: "store_id,phone" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { ...(up as any), cached: false, max_checks: MAX_CHECKS, resynced: true };
  });



// ---------------- ANALYTICS (owner) ----------------
export const fraudAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ownerOnly(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("fraud_checks")
      .select("risk, checked_at, order_id");
    const list = (rows ?? []) as any[];
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const totals = { total: list.length, safe: 0, medium: 0, high: 0, prevented: 0 };
    const daily: Record<string, number> = {};
    const weekly: Record<string, number> = {};
    const monthly: Record<string, number> = {};
    for (const r of list) {
      totals[r.risk as "safe" | "medium" | "high"]++;
      if (r.risk === "high" && r.order_id) totals.prevented++;
      const dt = new Date(r.checked_at);
      const dKey = dt.toISOString().slice(0, 10);
      const mKey = dKey.slice(0, 7);
      const wStart = new Date(dt);
      wStart.setDate(dt.getDate() - dt.getDay());
      const wKey = wStart.toISOString().slice(0, 10);
      daily[dKey] = (daily[dKey] ?? 0) + 1;
      weekly[wKey] = (weekly[wKey] ?? 0) + 1;
      monthly[mKey] = (monthly[mKey] ?? 0) + 1;
    }
    const recentDaily = Object.entries(daily)
      .filter(([k]) => now - new Date(k).getTime() < 30 * day)
      .sort(([a], [b]) => (a < b ? -1 : 1));
    return { totals, daily: recentDaily, weekly: Object.entries(weekly).sort(), monthly: Object.entries(monthly).sort() };
  });
