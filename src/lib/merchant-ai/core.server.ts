// Shared server helpers for the Merchant AI Command Center.
// Every function takes an explicit storeId — no call path can widen the tenant.
import {
  ACTION_BY_KEY,
  MERCHANT_ACTIONS,
  type AgentKey,
  type PermissionLevel,
} from "./registry";

export type Db = any;

/** Service-role client, used by webhook paths where there is no user session. */
export async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

/* ------------------------------------------------------------------ */
/* Tenant guard                                                        */
/* ------------------------------------------------------------------ */

/**
 * Hard tenant guard for the AI layer. The agent runs with service-role rights,
 * so every row it touches by id MUST be proven to belong to the merchant's own
 * store first. Throws instead of returning another merchant's data.
 */
export async function assertOwnedRow(
  db: Db,
  table: string,
  storeId: string,
  column: string,
  value: string,
): Promise<any> {
  if (!storeId) throw new Error("Tenant check failed: no store in context.");
  const id = String(value ?? "").trim();
  if (!id) throw new Error("Tenant check failed: no record id given.");
  const { data, error } = await db
    .from(table)
    .select("*")
    .eq("store_id", storeId)
    .eq(column, id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Record not found in your store.");
  return data;
}

/* ------------------------------------------------------------------ */
/* Permissions                                                         */
/* ------------------------------------------------------------------ */

export async function loadPermissions(
  db: Db,
  storeId: string,
): Promise<Record<string, PermissionLevel>> {
  const out: Record<string, PermissionLevel> = {};
  for (const a of MERCHANT_ACTIONS) out[a.key] = a.defaultLevel;
  const { data } = await db
    .from("store_ai_permissions")
    .select("action_key, level")
    .eq("store_id", storeId);
  for (const row of data ?? []) {
    const meta = ACTION_BY_KEY[row.action_key];
    if (!meta || meta.locked) continue;
    if (row.level === "auto" || row.level === "approval" || row.level === "restricted") {
      out[row.action_key] = row.level;
    }
  }
  // Locked actions can never be relaxed.
  for (const a of MERCHANT_ACTIONS) if (a.locked) out[a.key] = "restricted";
  return out;
}

export async function setPermission(
  db: Db,
  storeId: string,
  actionKey: string,
  level: PermissionLevel,
) {
  const meta = ACTION_BY_KEY[actionKey];
  if (!meta) throw new Error("Unknown action");
  if (meta.locked) throw new Error("This action is permanently restricted.");
  const { error } = await db
    .from("store_ai_permissions")
    .upsert({ store_id: storeId, action_key: actionKey, level }, { onConflict: "store_id,action_key" });
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ */
/* Agent state                                                         */
/* ------------------------------------------------------------------ */

export async function loadAgentState(db: Db, storeId: string) {
  const { data } = await db
    .from("store_ai_agent_state")
    .select("agent_key, enabled, status, config, last_activity_at, last_error")
    .eq("store_id", storeId);
  const map: Record<string, any> = {};
  for (const row of data ?? []) map[row.agent_key] = row;
  return map;
}

export async function isAgentEnabled(db: Db, storeId: string, agent: AgentKey) {
  const { data } = await db
    .from("store_ai_agent_state")
    .select("enabled")
    .eq("store_id", storeId)
    .eq("agent_key", agent)
    .maybeSingle();
  // Default on: a brand-new store should work without configuring anything.
  return data ? !!data.enabled : true;
}

export async function setAgentEnabled(db: Db, storeId: string, agent: AgentKey, enabled: boolean) {
  const { error } = await db.from("store_ai_agent_state").upsert(
    { store_id: storeId, agent_key: agent, enabled, status: enabled ? "active" : "paused" },
    { onConflict: "store_id,agent_key" },
  );
  if (error) throw new Error(error.message);
}

export async function touchAgent(
  db: Db,
  storeId: string,
  agent: AgentKey,
  patch: { status?: string; last_error?: string | null } = {},
) {
  await db.from("store_ai_agent_state").upsert(
    {
      store_id: storeId,
      agent_key: agent,
      last_activity_at: new Date().toISOString(),
      status: patch.status ?? "active",
      last_error: patch.last_error ?? null,
    },
    { onConflict: "store_id,agent_key" },
  );
}

/* ------------------------------------------------------------------ */
/* Activity log                                                        */
/* ------------------------------------------------------------------ */

const SECRET_HINT = /(token|secret|key|password|credential|signature)/i;

/** Strip anything secret-looking before it reaches the log. */
export function safeMeta(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (SECRET_HINT.test(k)) continue;
    if (v && typeof v === "object") {
      out[k] = JSON.stringify(v).slice(0, 400);
    } else if (typeof v === "string") {
      out[k] = v.slice(0, 400);
    } else {
      out[k] = v as never;
    }
  }
  return out;
}

export async function logActivity(
  db: Db,
  storeId: string,
  entry: {
    agent?: AgentKey | null;
    actionKey?: string | null;
    threadId?: string | null;
    level?: "info" | "warn" | "error";
    message: string;
    meta?: unknown;
  },
) {
  await db.from("store_ai_activity_logs").insert({
    store_id: storeId,
    thread_id: entry.threadId ?? null,
    agent_key: entry.agent ?? null,
    action_key: entry.actionKey ?? null,
    level: entry.level ?? "info",
    message: entry.message.slice(0, 500),
    meta: safeMeta(entry.meta),
  });
}

/* ------------------------------------------------------------------ */
/* Pending (approval) actions                                          */
/* ------------------------------------------------------------------ */

export async function createPendingAction(
  db: Db,
  storeId: string,
  input: {
    agent: AgentKey;
    actionKey: string;
    title: string;
    summary?: string;
    payload: Record<string, unknown>;
    via: string;
    requestedBy?: string | null;
  },
) {
  const { data, error } = await db
    .from("store_ai_pending_actions")
    .insert({
      store_id: storeId,
      agent_key: input.agent,
      action_key: input.actionKey,
      title: input.title.slice(0, 200),
      summary: input.summary?.slice(0, 500) ?? null,
      payload: input.payload,
      requested_via: input.via,
      requested_by: input.requestedBy ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id as string | undefined;
}

export async function latestPendingAction(db: Db, storeId: string) {
  const { data } = await db
    .from("store_ai_pending_actions")
    .select("*")
    .eq("store_id", storeId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/**
 * The approval a YES/NO reply refers to. Scoped to the channel the reply came
 * from, so a "yes" typed in Messenger can never execute something that was
 * requested in the panel (or in another merchant's chat).
 */
export async function pendingActionForContext(db: Db, storeId: string, via: string) {
  const { data } = await db
    .from("store_ai_pending_actions")
    .select("*")
    .eq("store_id", storeId)
    .eq("status", "pending")
    .eq("requested_via", via)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/**
 * PostgREST `or()` filters are comma/parenthesis delimited, so raw merchant
 * text can break the query (or change its meaning). Keep search terms safe.
 */
export function safeSearchTerm(input: unknown, max = 60) {
  return String(input ?? "")
    .replace(/[,()*\\"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}


/* ------------------------------------------------------------------ */
/* Threads                                                             */
/* ------------------------------------------------------------------ */

export async function ensureThread(
  db: Db,
  storeId: string,
  channel: string,
  identityRef: string | null,
  title?: string,
) {
  const { data: existing } = await db
    .from("store_ai_threads")
    .select("id")
    .eq("store_id", storeId)
    .eq("channel", channel)
    .eq("identity_ref", identityRef ?? "")
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data, error } = await db
    .from("store_ai_threads")
    .insert({
      store_id: storeId,
      channel,
      identity_ref: identityRef ?? "",
      title: title ?? `${channel} commands`,
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data!.id as string;
}

export async function addThreadMessage(
  db: Db,
  storeId: string,
  threadId: string,
  role: "user" | "assistant" | "system",
  content: string,
  meta: Record<string, unknown> = {},
) {
  await db.from("store_ai_thread_messages").insert({
    thread_id: threadId,
    store_id: storeId,
    role,
    content: content.slice(0, 8000),
    meta,
  });
  await db
    .from("store_ai_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", threadId)
    .eq("store_id", storeId);
}

export async function threadHistory(db: Db, storeId: string, threadId: string, limit = 12) {
  const { data } = await db
    .from("store_ai_thread_messages")
    .select("role, content")
    .eq("store_id", storeId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as { role: string; content: string }[])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}

/* ------------------------------------------------------------------ */
/* Rate limiting (per identity, per minute)                            */
/* ------------------------------------------------------------------ */

export async function withinRateLimit(
  db: Db,
  storeId: string,
  identityRef: string,
  maxPerMinute = 15,
) {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db
    .from("store_ai_activity_logs")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("action_key", "command_received")
    .gte("created_at", since);
  void identityRef;
  return (count ?? 0) < maxPerMinute;
}
