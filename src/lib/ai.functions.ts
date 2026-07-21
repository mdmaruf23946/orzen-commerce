// AI Sales Agent server functions.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPlan } from "@/lib/plan-guard";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function adminClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

// ---------- Owner: global AI settings ----------
export const getAiGlobalSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb = adminClient();
    const { data } = await sb.from("ai_global_settings").select("*").eq("id", 1).maybeSingle();
    return data ?? { id: 1, enabled: true, default_model: "google/gemini-3-flash-preview", provider_api_key: "" };
  });

export const updateAiGlobalSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        enabled: z.boolean(),
        default_model: z.string().min(2).max(120),
        provider_api_key: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertOwner(context.supabase, context.userId);
    const sb = adminClient();
    const { error } = await sb
      .from("ai_global_settings")
      .upsert({ id: 1, ...data, provider_api_key: data.provider_api_key || null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAiUsageStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb = adminClient();
    const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
    const { data } = await sb
      .from("ai_usage")
      .select("store_id,prompt_tokens,completion_tokens,cost_usd,model,created_at")
      .gte("created_at", since);
    const rows = data ?? [];
    const totals = rows.reduce(
      (acc, r) => {
        acc.prompt += r.prompt_tokens ?? 0;
        acc.completion += r.completion_tokens ?? 0;
        acc.cost += Number(r.cost_usd ?? 0);
        acc.requests += 1;
        return acc;
      },
      { prompt: 0, completion: 0, cost: 0, requests: 0 },
    );
    const byStore = new Map<string, { tokens: number; cost: number; requests: number }>();
    for (const r of rows) {
      const k = r.store_id ?? "global";
      const cur = byStore.get(k) ?? { tokens: 0, cost: 0, requests: 0 };
      cur.tokens += (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0);
      cur.cost += Number(r.cost_usd ?? 0);
      cur.requests += 1;
      byStore.set(k, cur);
    }
    return { totals, byStore: Array.from(byStore.entries()).map(([store_id, v]) => ({ store_id, ...v })) };
  });

// ---------- Store admin: agent config ----------
async function getOwnedStoreId(supabase: any, userId: string) {
  const { data } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
  if (!data) throw new Error("Store not found");
  return data.id as string;
}

export const getMyAgent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("store_ai_agents")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();
    if (data) return data;
    const { data: created, error } = await context.supabase
      .from("store_ai_agents")
      .insert({ store_id: storeId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const updateMyAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        enabled: z.boolean(),
        agent_name: z.string().trim().min(1).max(80),
        welcome_message: z.string().trim().min(1).max(500),
        language: z.enum(["bn", "en", "both"]),
        style: z.string().trim().min(1).max(40),
        use_emoji: z.boolean(),
        human_like: z.boolean(),
        knowledge: z
          .object({
            store_info: z.string().max(2000).optional().default(""),
            delivery_policy: z.string().max(2000).optional().default(""),
            return_policy: z.string().max(2000).optional().default(""),
            warranty_policy: z.string().max(2000).optional().default(""),
            payment_methods: z.string().max(2000).optional().default(""),
            business_hours: z.string().max(500).optional().default(""),
            faqs: z
              .array(z.object({ q: z.string().max(300), a: z.string().max(1000) }))
              .max(30)
              .optional()
              .default([]),
          })
          .default({}),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertPlan(context.supabase, context.userId, "ai_agent");
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("store_ai_agents")
      .upsert({ store_id: storeId, ...data }, { onConflict: "store_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Storefront: read public agent config ----------
export const getStoreAgentPublic = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const sb = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: row } = await sb.rpc("get_public_store_by_slug", { _slug: data.slug });
    const store = row as { id: string } | null;
    if (!store) return null;
    const { data: agent } = await sb
      .from("store_ai_agents")
      .select("enabled,agent_name,welcome_message,language,style,use_emoji,human_like")
      .eq("store_id", store.id)
      .maybeSingle();
    if (!agent || !agent.enabled) return null;
    return { storeId: store.id, ...agent };
  });

// ---------- Messenger ----------
const REQUIRED_MESSENGER_SCOPES = [
  "pages_manage_metadata",
  "pages_messaging",
  "pages_read_engagement",
];

function publicOrigin(): string {
  const explicit = process.env.PUBLIC_APP_URL || process.env.VITE_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const ref = process.env.SUPABASE_PROJECT_ID;
  if (ref) return `https://project--${ref}.lovable.app`;
  return "https://orzen.top";
}

async function loadIntegrationForOwner(context: any) {
  const storeId = await getOwnedStoreId(context.supabase, context.userId);
  const { data } = await context.supabase
    .from("messenger_integrations")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();
  return { storeId, row: data as any };
}

async function decryptToken(enc: string | null): Promise<string | null> {
  if (!enc) return null;
  const mod = await import("@/lib/crypto/credentials.server");
  try {
    return mod.decryptJSON<string>(enc);
  } catch {
    return null;
  }
}

async function generateSecureVerifyToken(): Promise<string> {
  const { randomBytes } = await import("crypto");
  // 24 bytes → 48 hex chars (within 32–64 range)
  return `vt_${randomBytes(24).toString("hex")}`;
}

async function ensureUniqueVerifyToken(supabase: any): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const t = await generateSecureVerifyToken();
    const { data } = await supabase
      .from("messenger_integrations")
      .select("id")
      .eq("verify_token", t)
      .maybeSingle();
    if (!data) return t;
  }
  // fallback (extremely unlikely)
  return await generateSecureVerifyToken();
}


export const getMessengerIntegration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    let { storeId, row } = await loadIntegrationForOwner(context);
    const webhookUrl = `${publicOrigin()}/api/public/messenger/webhook`;
    let stats: any = { messages_today: 0, failed_today: 0, last_incoming_at: null };
    try {
      const { data: s } = await context.supabase.rpc("get_messenger_daily_stats", { _store_id: storeId });
      if (s) stats = s;
    } catch {}

    // Auto-provision a secure verify token the first time this page is opened,
    // or backfill one if the row exists but has no token.
    if (!row) {
      const verify_token = await ensureUniqueVerifyToken(context.supabase);
      const { data: created } = await context.supabase
        .from("messenger_integrations")
        .insert({ store_id: storeId, verify_token, status: "pending" })
        .select("*")
        .single();
      row = created as any;
    } else if (!row.verify_token) {
      const verify_token = await ensureUniqueVerifyToken(context.supabase);
      const { data: updated } = await context.supabase
        .from("messenger_integrations")
        .update({ verify_token })
        .eq("store_id", storeId)
        .select("*")
        .single();
      if (updated) row = updated as any;
    }

    return {
      connected: row.status === "connected",
      webhook_url: webhookUrl,
      page_id: row.page_id,
      page_name: row.page_name,
      page_picture_url: row.page_picture_url,
      app_id: row.app_id,
      has_app_secret: !!row.app_secret_encrypted,
      has_token: !!(row.page_access_token_encrypted || row.page_access_token),
      verify_token: row.verify_token,
      status: row.status,
      connected_at: row.connected_at,
      last_verified_at: row.last_verified_at,
      token_expires_at: row.token_expires_at,
      permissions: (row.permissions ?? []) as string[],
      last_error: row.last_error,
      delivery_failures: row.delivery_failures ?? 0,
      ai_auto_reply: row.ai_auto_reply,
      human_takeover: row.human_takeover,
      conversation_history: row.conversation_history,
      order_detection: row.order_detection,
      product_recommendation: row.product_recommendation,
      faq_reply: row.faq_reply,
      required_scopes: REQUIRED_MESSENGER_SCOPES,
      stats,
    };
  });

export const connectMessenger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        page_id: z.string().trim().min(2).max(120),
        page_access_token: z.string().trim().min(10).max(1000),
        app_id: z.string().trim().max(64).optional().nullable(),
        app_secret: z.string().trim().max(200).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertPlan(context.supabase, context.userId, "ai_messenger");
    const { storeId, row } = await loadIntegrationForOwner(context);
    const { encryptJSON } = await import("@/lib/crypto/credentials.server");

    // Verify page + fetch metadata
    let pageName: string | null = null;
    let picture: string | null = null;
    try {
      const r = await fetch(
        `https://graph.facebook.com/v19.0/${encodeURIComponent(data.page_id)}?fields=name,picture.type(large)&access_token=${encodeURIComponent(data.page_access_token)}`,
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || "Unable to reach Facebook Page");
      pageName = j.name ?? null;
      picture = j.picture?.data?.url ?? null;
    } catch (e) {
      throw new Error((e as Error).message);
    }

    // Optionally inspect token
    let permissions: string[] = row?.permissions ?? [];
    let expiresAt: string | null = null;
    if (data.app_id && data.app_secret) {
      try {
        const appAccess = `${data.app_id}|${data.app_secret}`;
        const dr = await fetch(
          `https://graph.facebook.com/v19.0/debug_token?input_token=${encodeURIComponent(data.page_access_token)}&access_token=${encodeURIComponent(appAccess)}`,
        );
        const dj = await dr.json();
        const info = dj?.data;
        if (info) {
          permissions = Array.isArray(info.scopes) ? info.scopes : permissions;
          const exp = info.expires_at || info.data_access_expires_at;
          if (exp && Number(exp) > 0) expiresAt = new Date(Number(exp) * 1000).toISOString();
        }
      } catch {
        // non-fatal
      }
    }

    const verify_token = row?.verify_token || (await ensureUniqueVerifyToken(context.supabase));
    const upsertRow: any = {
      store_id: storeId,
      page_id: data.page_id,
      page_access_token: null,
      page_access_token_encrypted: encryptJSON(data.page_access_token),
      app_id: data.app_id || null,
      app_secret_encrypted: data.app_secret ? encryptJSON(data.app_secret) : row?.app_secret_encrypted ?? null,
      verify_token,
      page_name: pageName,
      page_picture_url: picture,
      permissions,
      token_expires_at: expiresAt,
      status: "connected",
      connected_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      last_error: null,
    };
    const { error } = await context.supabase
      .from("messenger_integrations")
      .upsert(upsertRow, { onConflict: "store_id" });
    if (error) throw new Error(error.message);
    return { ok: true, verify_token };
  });

export const disconnectMessenger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlan(context.supabase, context.userId, "ai_messenger");
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    await context.supabase.from("messenger_integrations").delete().eq("store_id", storeId);
    return { ok: true };
  });

export const verifyMessengerWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { storeId, row } = await loadIntegrationForOwner(context);
    if (!row?.verify_token) throw new Error("Not configured");
    const url = `${publicOrigin()}/api/public/messenger/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(row.verify_token)}&hub.challenge=ping`;
    try {
      const r = await fetch(url);
      const t = await r.text();
      const ok = r.ok && t === "ping";
      await context.supabase
        .from("messenger_integrations")
        .update({
          last_verified_at: ok ? new Date().toISOString() : row.last_verified_at,
          last_error: ok ? null : `Webhook verify failed (${r.status})`,
        })
        .eq("store_id", storeId);
      return { ok, status: r.status };
    } catch (e) {
      await context.supabase
        .from("messenger_integrations")
        .update({ last_error: (e as Error).message })
        .eq("store_id", storeId);
      throw new Error((e as Error).message);
    }
  });

export const sendMessengerTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ recipient_id: z.string().trim().min(3).max(64) }).parse(d))
  .handler(async ({ context, data }) => {
    const { storeId, row } = await loadIntegrationForOwner(context);
    if (!row) throw new Error("Not connected");
    const token = (await decryptToken(row.page_access_token_encrypted)) || row.page_access_token;
    if (!token) throw new Error("No token on file");
    const r = await fetch(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipient: { id: data.recipient_id },
          message: { text: "✅ Test message from ORZEN" },
        }),
      },
    );
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      await context.supabase
        .from("messenger_integrations")
        .update({ last_error: j?.error?.message || `Send failed (${r.status})` })
        .eq("store_id", storeId);
      throw new Error(j?.error?.message || `Send failed (${r.status})`);
    }
    return { ok: true };
  });

export const regenerateMessengerVerifyToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const verify_token = await ensureUniqueVerifyToken(context.supabase);
    // Update existing row; if none exists yet, insert a pending one.
    const { data: existing } = await context.supabase
      .from("messenger_integrations")
      .select("id")
      .eq("store_id", storeId)
      .maybeSingle();
    if (existing) {
      const { error } = await context.supabase
        .from("messenger_integrations")
        .update({ verify_token, last_verified_at: null, last_error: null })
        .eq("store_id", storeId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("messenger_integrations")
        .insert({ store_id: storeId, verify_token, status: "pending" });
      if (error) throw new Error(error.message);
    }
    return { ok: true, verify_token };
  });



export const refreshMessengerPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { storeId, row } = await loadIntegrationForOwner(context);
    if (!row) throw new Error("Not connected");
    const token = (await decryptToken(row.page_access_token_encrypted)) || row.page_access_token;
    const secret = await decryptToken(row.app_secret_encrypted);
    if (!token || !row.app_id || !secret)
      throw new Error("Provide App ID and App Secret to check permissions");
    const appAccess = `${row.app_id}|${secret}`;
    const dr = await fetch(
      `https://graph.facebook.com/v19.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appAccess)}`,
    );
    const dj = await dr.json();
    if (!dr.ok) throw new Error(dj?.error?.message || "debug_token failed");
    const info = dj?.data || {};
    const permissions = Array.isArray(info.scopes) ? info.scopes : [];
    const exp = info.expires_at || info.data_access_expires_at;
    const expiresAt = exp && Number(exp) > 0 ? new Date(Number(exp) * 1000).toISOString() : null;
    await context.supabase
      .from("messenger_integrations")
      .update({ permissions, token_expires_at: expiresAt })
      .eq("store_id", storeId);
    return { ok: true, permissions, token_expires_at: expiresAt };
  });

export const updateMessengerAiFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        ai_auto_reply: z.boolean().optional(),
        human_takeover: z.boolean().optional(),
        conversation_history: z.boolean().optional(),
        order_detection: z.boolean().optional(),
        product_recommendation: z.boolean().optional(),
        faq_reply: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const patch: any = {};
    for (const k of Object.keys(data)) if ((data as any)[k] !== undefined) patch[k] = (data as any)[k];
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("messenger_integrations")
      .update(patch)
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

