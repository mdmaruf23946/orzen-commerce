// Owner Panel — Phase 5, 6, 7 server functions
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("id").eq("user_id", userId).eq("role", "owner").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

const MASK = (v?: string | null) => (v ? `••••${v.slice(-4)}` : null);

// ---------- FEATURE FLAGS ----------
export const listFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await (context.supabase as any)
      .from("platform_feature_flags")
      .select("*")
      .order("category")
      .order("sort_order")
      .order("flag_key");
    return data ?? [];
  });

export const upsertFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    flag_key: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/i, "Only letters, numbers and underscore"),
    enabled: z.boolean().default(false),
    label: z.string().max(120).nullish(),
    description: z.string().max(500).nullish(),
    category: z.string().max(40).default("general"),
    sort_order: z.number().int().default(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("platform_feature_flags").upsert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ flag_key: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("platform_feature_flags").delete().eq("flag_key", data.flag_key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- PLAN × FEATURE ACCESS MATRIX ----------
export const getPlanFeatureMatrix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const [pkgs, flags] = await Promise.all([
      sb.from("subscription_packages")
        .select("id,name,is_trial,is_active,features,sort_order,price")
        .order("sort_order")
        .order("price"),
      sb.from("platform_feature_flags")
        .select("flag_key,label,description,category,sort_order")
        .order("category")
        .order("sort_order")
        .order("flag_key"),
    ]);
    return {
      packages: (pkgs.data ?? []).map((p: any) => ({
        id: p.id, name: p.name, is_trial: !!p.is_trial, is_active: !!p.is_active,
        features: (p.features ?? {}) as Record<string, boolean>,
      })),
      features: (flags.data ?? []).map((f: any) => ({
        key: f.flag_key,
        label: f.label ?? f.flag_key,
        description: f.description,
        category: f.category ?? "general",
      })),
    };
  });

export const setPlanFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    packageId: z.string().uuid(),
    featureKey: z.string().min(1),
    enabled: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { data: pkg, error: e1 } = await sb
      .from("subscription_packages")
      .select("features")
      .eq("id", data.packageId)
      .single();
    if (e1) throw new Error(e1.message);
    const features = { ...(pkg?.features ?? {}), [data.featureKey]: data.enabled };
    const { error } = await sb
      .from("subscription_packages")
      .update({ features })
      .eq("id", data.packageId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkSetPlanFeatures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    updates: z.array(z.object({
      packageId: z.string().uuid(),
      features: z.record(z.string(), z.boolean()),
    })).max(50),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    for (const u of data.updates) {
      const { data: pkg } = await sb
        .from("subscription_packages").select("features").eq("id", u.packageId).single();
      const merged = { ...(pkg?.features ?? {}), ...u.features };
      const { error } = await sb
        .from("subscription_packages").update({ features: merged }).eq("id", u.packageId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------- COURIERS ----------
export const listCouriers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await (context.supabase as any).from("courier_providers").select("*").order("name");
    return (data ?? []).map((c: any) => ({ ...c, api_key: undefined, api_key_masked: MASK(c.api_key), has_api_key: !!c.api_key }));
  });

export const upsertCourier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(80),
    code: z.string().min(1).max(40),
    base_url: z.string().max(300).nullish(),
    api_key: z.string().max(500).nullish(),
    clear_api_key: z.boolean().optional(),
    logo_url: z.string().max(500).nullish(),
    is_default: z.boolean().default(false),
    is_active: z.boolean().default(true),
    config: z.record(z.string(), z.any()).default({}),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { id, clear_api_key, api_key, ...rest } = data;
    const patch: any = { ...rest };
    if (clear_api_key) patch.api_key = null;
    else if (api_key) patch.api_key = api_key;
    if (data.is_default) await sb.from("courier_providers").update({ is_default: false }).neq("id", id ?? "00000000-0000-0000-0000-000000000000");
    if (id) {
      const { error } = await sb.from("courier_providers").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("courier_providers").insert(patch);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });


export const deleteCourier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("courier_providers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- MARKETING PIXELS ----------
export const getPixelDefaults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await (context.supabase as any).from("marketing_pixel_defaults").select("*").eq("id", 1).maybeSingle();
    return data ?? { id: 1, fb_pixel_id: null, ga4_id: null, gtm_id: null, tiktok_id: null, capi_token: null, extra: {} };
  });

export const updatePixelDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    fb_pixel_id: z.string().max(80).nullish(),
    ga4_id: z.string().max(80).nullish(),
    gtm_id: z.string().max(80).nullish(),
    tiktok_id: z.string().max(80).nullish(),
    capi_token: z.string().max(500).nullish(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("marketing_pixel_defaults").update(data).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- PLATFORM SETTINGS ----------
export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await (context.supabase as any).from("platform_settings").select("settings").eq("id", 1).maybeSingle();
    return (data?.settings ?? {}) as Record<string, any>;
  });

export const updatePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ settings: z.record(z.string(), z.any()) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("platform_settings").update({ settings: data.settings }).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- PLATFORM USERS ----------
export const listPlatformUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const all: any[] = [];
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw new Error(error.message);
      all.push(...data.users);
      if (data.users.length < 100) break;
    }
    const { data: roles } = await (context.supabase as any).from("user_roles").select("user_id, role");
    const rolesMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesMap.set(r.user_id, arr);
    }
    return all.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      email_confirmed_at: u.email_confirmed_at ?? null,
      roles: rolesMap.get(u.id) ?? [],
    })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  });

// ---------- REPORTS ----------
export const getOwnerReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const now = Date.now();
    const last30 = new Date(now - 30 * 86400000).toISOString();
    const last90 = new Date(now - 90 * 86400000).toISOString();

    const [{ data: payments }, { data: stores }, { data: orders }, { data: ai }] = await Promise.all([
      sb.from("payments").select("amount,status,created_at,verified_at,method").gte("created_at", last90),
      sb.from("stores").select("id,created_at,subscription_status"),
      sb.from("orders").select("total,status,created_at").gte("created_at", last30),
      sb.from("ai_usage").select("cost_usd,prompt_tokens,completion_tokens,model,created_at").gte("created_at", last30),
    ]);

    const paid = (payments ?? []).filter((p: any) => p.status === "paid");
    const revenue90 = paid.reduce((a: number, p: any) => a + Number(p.amount || 0), 0);
    const byMethod: Record<string, number> = {};
    for (const p of paid) byMethod[p.method ?? "other"] = (byMethod[p.method ?? "other"] ?? 0) + Number(p.amount || 0);

    // per-day revenue last 30d
    const revDays: { date: string; total: number }[] = [];
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(dayStart.getTime() - i * 86400000);
      const next = new Date(d.getTime() + 86400000);
      const t = paid.filter((p: any) => {
        const ts = new Date(p.verified_at || p.created_at);
        return ts >= d && ts < next;
      }).reduce((a: number, p: any) => a + Number(p.amount || 0), 0);
      revDays.push({ date: d.toISOString().slice(5, 10), total: t });
    }

    // store growth
    const growth: { date: string; count: number }[] = [];
    const totalStores = (stores ?? []).length;
    let running = totalStores;
    const sorted = [...(stores ?? [])].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    for (let i = 0; i < 30; i++) {
      const d = new Date(dayStart.getTime() - i * 86400000);
      const created = sorted.filter((s: any) => new Date(s.created_at) > d).length;
      growth.unshift({ date: d.toISOString().slice(5, 10), count: totalStores - created });
    }
    void running;

    const orderTotal = (orders ?? []).reduce((a: number, o: any) => a + Number(o.total || 0), 0);
    const aiCost = (ai ?? []).reduce((a: number, r: any) => a + Number(r.cost_usd || 0), 0);
    const aiTokens = (ai ?? []).reduce((a: number, r: any) => a + (Number(r.prompt_tokens || 0) + Number(r.completion_tokens || 0)), 0);

    const subStatus: Record<string, number> = {};
    for (const s of stores ?? []) subStatus[s.subscription_status ?? "active"] = (subStatus[s.subscription_status ?? "active"] ?? 0) + 1;

    return { revenue90, byMethod, revDays, growth, orderTotal, orderCount: (orders ?? []).length, aiCost, aiTokens, aiCount: (ai ?? []).length, subStatus, totalStores };
  });

// ---------- SUPPORT ----------
export const listTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ status: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    let q = (context.supabase as any).from("support_tickets").select("*, stores(name,slug)").order("created_at", { ascending: false }).limit(200);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const updateTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { id, ...rest } = data;
    const { error } = await (context.supabase as any).from("support_tickets").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("support_tickets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listContactRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await (context.supabase as any).from("contact_requests").select("*").order("created_at", { ascending: false }).limit(200);
    return data ?? [];
  });

export const updateContactRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.enum(["new", "in_progress", "resolved"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("contact_requests").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await (context.supabase as any).from("feedback").select("*, stores(name)").order("created_at", { ascending: false }).limit(200);
    return data ?? [];
  });

// ---------- ANNOUNCEMENTS ----------
export const listAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await (context.supabase as any).from("announcements").select("*").order("created_at", { ascending: false }).limit(100);
    return data ?? [];
  });

export const upsertAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(4000),
    audience: z.enum(["all", "active", "trial", "expired"]).default("all"),
    publish: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const payload: any = {
      title: data.title, body: data.body, audience: data.audience,
      published_at: data.publish ? new Date().toISOString() : null,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await sb.from("announcements").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("announcements").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- API KEYS ----------
async function sha256Hex(s: string) {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await (context.supabase as any).from("api_keys").select("id,name,prefix,scopes,created_by,last_used_at,revoked_at,created_at").order("created_at", { ascending: false });
    return data ?? [];
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    name: z.string().min(1).max(80),
    scopes: z.array(z.string()).default(["read"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const raw = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const prefix = raw.slice(0, 8);
    const key = `lvbl_${raw}`;
    const key_hash = await sha256Hex(key);
    const { error } = await (context.supabase as any).from("api_keys").insert({
      name: data.name, prefix, key_hash, scopes: data.scopes, created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { key, prefix };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("api_keys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- WEBHOOKS ----------
export const listWebhooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await (context.supabase as any).from("webhooks").select("id,name,url,event,is_active,last_delivery_at,last_status,created_at").order("created_at", { ascending: false });
    return data ?? [];
  });

export const upsertWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(80),
    url: z.string().url(),
    event: z.string().min(1).max(80),
    secret: z.string().max(200).nullish(),
    is_active: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { id, ...rest } = data;
    if (id) {
      const { error } = await sb.from("webhooks").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("webhooks").insert(rest);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("webhooks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { data: wh } = await sb.from("webhooks").select("url,secret,event").eq("id", data.id).maybeSingle();
    if (!wh) throw new Error("Not found");
    let status = 0;
    try {
      const res = await fetch(wh.url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-webhook-secret": wh.secret ?? "" },
        body: JSON.stringify({ event: "test.ping", at: new Date().toISOString() }),
      });
      status = res.status;
    } catch { status = 0; }
    await sb.from("webhooks").update({ last_delivery_at: new Date().toISOString(), last_status: status }).eq("id", data.id);
    return { status };
  });

// ---------- LOGIN HISTORY ----------
export const listLoginHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const all: any[] = [];
    for (let page = 1; page <= 5; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw new Error(error.message);
      all.push(...data.users);
      if (data.users.length < 100) break;
    }
    return all
      .filter((u) => u.last_sign_in_at)
      .map((u) => ({ id: u.id, email: u.email ?? null, last_sign_in_at: u.last_sign_in_at, created_at: u.created_at }))
      .sort((a, b) => new Date(b.last_sign_in_at).getTime() - new Date(a.last_sign_in_at).getTime())
      .slice(0, 200);
  });

// ---------- DEV LOGS ----------
export const listDevLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const [{ data: audit }, { data: notif }] = await Promise.all([
      sb.from("role_audit_log").select("*").order("created_at", { ascending: false }).limit(50),
      sb.from("subscription_notifications").select("*, stores(name)").order("created_at", { ascending: false }).limit(50),
    ]);
    const items: any[] = [];
    for (const a of audit ?? []) items.push({ kind: "audit", at: a.created_at, text: `${a.action} ${a.role} → ${a.target_email ?? "user"} (by ${a.actor_email ?? "—"})` });
    for (const n of notif ?? []) items.push({ kind: "notification", at: n.created_at, text: `${n.type} · ${n.stores?.name ?? "—"}`, meta: n.meta });
    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return items.slice(0, 100);
  });
