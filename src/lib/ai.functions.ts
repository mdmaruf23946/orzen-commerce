// AI Sales Agent server functions.
import { createServerFn } from "@tanstack/react-start";
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
export const getMessengerIntegration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("messenger_integrations")
      .select("page_id,verify_token,status,connected_at")
      .eq("store_id", storeId)
      .maybeSingle();
    return data;
  });

export const connectMessenger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        page_id: z.string().trim().min(2).max(120),
        page_access_token: z.string().trim().min(10).max(500),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertPlan(context.supabase, context.userId, "ai_messenger");
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const verify_token = `vt_${Math.random().toString(36).slice(2, 12)}`;
    const { error } = await context.supabase
      .from("messenger_integrations")
      .upsert(
        {
          store_id: storeId,
          page_id: data.page_id,
          page_access_token: data.page_access_token,
          verify_token,
          status: "connected",
          connected_at: new Date().toISOString(),
        },
        { onConflict: "store_id" },
      );
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
