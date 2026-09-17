// Panel-side server functions for the Merchant AI Command Center.
// Every call resolves the store from the signed-in user — never from input.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { resolveStoreAccess } from "@/lib/store-access";
import { hasFeature } from "@/lib/features";
import {
  AGENTS,
  MERCHANT_ACTIONS,
  NOTIFICATION_EVENTS,
  type PermissionLevel,
} from "@/lib/merchant-ai/registry";

const PLAN_FIELDS =
  "id,name,price,features,is_trial,plan_tier,product_limit,order_limit,staff_limit,landing_page_limit";

/**
 * The store row WITH its plan joined — `hasFeature` needs the package, and an
 * expired plan falls back to the active Free plan.
 */
async function loadStoreWithPlan(db: any, storeId: string) {
  const { data: store } = await db
    .from("stores")
    .select(`*, subscription_packages(${PLAN_FIELDS})`)
    .eq("id", storeId)
    .maybeSingle();
  if (!store) return null;
  if (["expired", "suspended", "cancelled"].includes(store.subscription_status ?? "active")) {
    const { data: freePkg } = await db
      .from("subscription_packages")
      .select(PLAN_FIELDS)
      .eq("is_active", true)
      .eq("is_trial", false)
      .eq("plan_tier", "free")
      .limit(1)
      .maybeSingle();
    (store as any).free_package = freePkg ?? null;
  }
  return store;
}

async function ctxOf(context: any) {
  const access = await resolveStoreAccess(context.supabase, context.userId, context.claims);
  if (!access?.storeId) throw new Error("No store found for this account.");
  return { db: context.supabase, storeId: access.storeId as string, userId: context.userId as string };
}

/* ----------------------------- overview ----------------------------- */

export const aiGetOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, storeId } = await ctxOf(context);
    const [store, state, perms, pending, logs, identities] = await Promise.all([
      loadStoreWithPlan(db, storeId),
      db.from("store_ai_agent_state").select("*").eq("store_id", storeId),
      db.from("store_ai_permissions").select("action_key, level").eq("store_id", storeId),
      db
        .from("store_ai_pending_actions")
        .select("id, agent_key, action_key, title, summary, status, created_at, expires_at")
        .eq("store_id", storeId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("store_ai_activity_logs")
        .select("id, agent_key, action_key, level, message, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("store_ai_identities")
        .select("id, channel, identifier, label, verified, verify_code, verify_expires_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: true }),
    ]);

    const [{ data: messenger }, { data: whatsapp }, { data: facebook }] = await Promise.all([
      db.from("messenger_integrations").select("status").eq("store_id", storeId).maybeSingle(),
      db.from("whatsapp_integrations").select("status").eq("store_id", storeId).maybeSingle(),
      db.from("facebook_page_integrations").select("status, page_name").eq("store_id", storeId).maybeSingle(),
    ]);

    const connected: Record<string, boolean> = {
      messenger: messenger?.status === "connected" || messenger?.status === "active",
      whatsapp: whatsapp?.status === "connected" || whatsapp?.status === "active",
      facebook: facebook?.status === "connected",
    };

    const stateMap: Record<string, any> = {};
    for (const row of state.data ?? []) stateMap[row.agent_key] = row;

    const agents = AGENTS.map((a) => {
      const row = stateMap[a.key];
      const locked = a.feature ? !hasFeature(store, a.feature) : false;
      const enabled = row ? !!row.enabled : true;
      let status: string = "active";
      if (locked) status = "needs_setup";
      else if (!enabled) status = "paused";
      else if (row?.status === "error") status = "error";
      else if (a.channel && !connected[a.channel]) status = "needs_setup";
      return {
        ...a,
        enabled,
        locked,
        status,
        lastActivityAt: row?.last_activity_at ?? null,
        lastError: row?.last_error ?? null,
        connected: a.channel ? connected[a.channel] : true,
      };
    });

    const levels: Record<string, PermissionLevel> = {};
    for (const m of MERCHANT_ACTIONS) levels[m.key] = m.defaultLevel;
    for (const row of perms.data ?? []) {
      const meta = MERCHANT_ACTIONS.find((m) => m.key === row.action_key);
      if (meta && !meta.locked) levels[row.action_key] = row.level as PermissionLevel;
    }

    return {
      agents,
      levels,
      pending: pending.data ?? [],
      logs: logs.data ?? [],
      identities: identities.data ?? [],
      planActive: hasFeature(store, "ai_agent"),
    };
  });

/* ----------------------------- chat ----------------------------- */

export const aiSendCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, storeId, userId } = await ctxOf(context);
    const store = await loadStoreWithPlan(db, storeId);
    if (!hasFeature(store, "ai_agent")) {
      throw new Error("AI Command Center is not included in your current plan.");
    }
    const { ensureThread, loadAgentState, withinRateLimit } = await import("@/lib/merchant-ai/core.server");
    const { runMasterAgent } = await import("@/lib/merchant-ai/master.server");
    const state = await loadAgentState(db, storeId);
    if (state["master"] && state["master"].enabled === false) {
      throw new Error("The Master AI Agent is switched off. Turn it on in AI Command Center → Agents.");
    }
    if (!(await withinRateLimit(db, storeId, userId))) {
      throw new Error("Too many commands right now. Please wait a minute and try again.");
    }
    const threadId = await ensureThread(db, storeId, "panel", userId, "Panel commands");
    const res = await runMasterAgent({
      db,
      storeId,
      text: data.text,
      via: "panel",
      threadId,
      identityRef: userId,
      requestedBy: userId,
    });

    return { ...res, threadId };
  });

export const aiGetThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, storeId, userId } = await ctxOf(context);
    const { data: thread } = await db
      .from("store_ai_threads")
      .select("id")
      .eq("store_id", storeId)
      .eq("channel", "panel")
      .eq("identity_ref", userId)
      .maybeSingle();
    if (!thread) return { messages: [] as { role: string; content: string; created_at: string }[] };
    const { data } = await db
      .from("store_ai_thread_messages")
      .select("role, content, created_at")
      .eq("store_id", storeId)
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true })
      .limit(80);
    return { messages: data ?? [] };
  });

/* ----------------------------- approvals ----------------------------- */

export const aiDecideAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), decision: z.enum(["approve", "reject"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, storeId, userId } = await ctxOf(context);
    const { executePendingAction, rejectPendingAction } = await import("@/lib/merchant-ai/master.server");
    if (data.decision === "approve") return executePendingAction(db, storeId, data.id, userId);
    return rejectPendingAction(db, storeId, data.id, userId);
  });

/* ----------------------------- agents ----------------------------- */

export const aiToggleAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ agent: z.string().min(1), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, storeId } = await ctxOf(context);
    if (!AGENTS.some((a) => a.key === data.agent)) throw new Error("Unknown agent.");
    const { setAgentEnabled } = await import("@/lib/merchant-ai/core.server");
    await setAgentEnabled(db, storeId, data.agent as any, data.enabled);
    return { ok: true };
  });

/* ----------------------------- permissions ----------------------------- */

export const aiSetPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ actionKey: z.string(), level: z.enum(["auto", "approval", "restricted"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, storeId } = await ctxOf(context);
    const { setPermission } = await import("@/lib/merchant-ai/core.server");
    await setPermission(db, storeId, data.actionKey, data.level);
    return { ok: true };
  });

/* ----------------------------- identities ----------------------------- */

export const aiAddIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        channel: z.enum(["messenger", "whatsapp"]),
        identifier: z.string().min(3).max(64),
        label: z.string().max(60).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, storeId } = await ctxOf(context);
    const { normalizeIdentifier, makeVerifyCode } = await import("@/lib/merchant-ai/identity.server");
    const identifier = normalizeIdentifier(data.channel, data.identifier);
    const code = makeVerifyCode();
    const { error } = await db.from("store_ai_identities").upsert(
      {
        store_id: storeId,
        channel: data.channel,
        identifier,
        label: data.label ?? null,
        verified: false,
        verify_code: code,
        verify_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
      { onConflict: "store_id,channel,identifier" },
    );
    if (error) throw new Error(error.message);
    return { code, identifier };
  });

export const aiRemoveIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, storeId } = await ctxOf(context);
    await db.from("store_ai_identities").delete().eq("store_id", storeId).eq("id", data.id);
    return { ok: true };
  });

/* ----------------------------- notifications ----------------------------- */

export const aiGetNotificationRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, storeId } = await ctxOf(context);
    const { data } = await db
      .from("store_ai_notification_rules")
      .select("event_key, enabled, channels")
      .eq("store_id", storeId);
    const map: Record<string, { enabled: boolean; channels: string[] }> = {};
    for (const e of NOTIFICATION_EVENTS) map[e.key] = { enabled: true, channels: ["panel"] };
    for (const row of data ?? []) map[row.event_key] = { enabled: !!row.enabled, channels: row.channels ?? ["panel"] };
    return { rules: map };
  });

export const aiSetNotificationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        eventKey: z.string(),
        enabled: z.boolean(),
        channels: z.array(z.enum(["panel", "messenger", "whatsapp"])).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, storeId } = await ctxOf(context);
    if (!NOTIFICATION_EVENTS.some((e) => e.key === data.eventKey)) throw new Error("Unknown event.");
    const { error } = await db.from("store_ai_notification_rules").upsert(
      { store_id: storeId, event_key: data.eventKey, enabled: data.enabled, channels: data.channels },
      { onConflict: "store_id,event_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ----------------------------- logs ----------------------------- */

export const aiGetLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, storeId } = await ctxOf(context);
    const { data } = await db
      .from("store_ai_activity_logs")
      .select("id, agent_key, action_key, level, message, meta, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(200);
    return { logs: data ?? [] };
  });
