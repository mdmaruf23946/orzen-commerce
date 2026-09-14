// Owner-authenticated server functions for the AI Admin Control module.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertOwner(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

// ------------------------------- Overview ---------------------------------

export const aiAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 86400000).toISOString();
    const [conn, settings, commands, actions, pending, failed, recent] = await Promise.all([
      supabaseAdmin.from("ai_admin_connections").select("status, display_number, last_verified_at, last_error").eq("singleton", true).maybeSingle(),
      supabaseAdmin.from("ai_admin_settings").select("*").eq("singleton", true).maybeSingle(),
      supabaseAdmin.from("ai_admin_messages").select("*", { count: "exact", head: true }).eq("role", "user").gte("created_at", since),
      supabaseAdmin.from("ai_admin_action_logs").select("*", { count: "exact", head: true }).gte("created_at", since),
      supabaseAdmin.from("ai_admin_pending_actions").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("ai_admin_action_logs").select("*", { count: "exact", head: true }).eq("result", "failed").gte("created_at", since),
      supabaseAdmin.from("ai_admin_action_logs").select("*").order("created_at", { ascending: false }).limit(10),
    ]);
    return {
      connection: conn.data ?? null,
      settings: settings.data ?? null,
      commands24h: commands.count ?? 0,
      actions24h: actions.count ?? 0,
      pending: pending.count ?? 0,
      failed24h: failed.count ?? 0,
      recent: recent.data ?? [],
    };
  });

// ------------------------------ Connection ---------------------------------

export const getAiAdminConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ai_admin_connections")
      .select("status, phone_number_id, waba_id, display_number, verify_token, credentials_hint, last_verified_at, last_error, updated_at")
      .eq("singleton", true)
      .maybeSingle();
    return data ?? null;
  });

export const saveAiAdminConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        phone_number_id: z.string().min(1),
        waba_id: z.string().min(1),
        access_token: z.string().optional(),
        app_secret: z.string().optional(),
        verify_token: z.string().min(6),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptJSON, decryptJSON } = await import("@/lib/crypto/credentials.server");

    const { data: existing } = await supabaseAdmin
      .from("ai_admin_connections")
      .select("id, credentials_enc")
      .eq("singleton", true)
      .maybeSingle();

    let creds: { access_token: string; app_secret?: string } | null = null;
    if (data.access_token) {
      creds = { access_token: data.access_token, app_secret: data.app_secret || undefined };
    } else if (existing?.credentials_enc) {
      const prev = decryptJSON<{ access_token: string; app_secret?: string }>(existing.credentials_enc);
      creds = { access_token: prev.access_token, app_secret: data.app_secret || prev.app_secret };
    }
    if (!creds?.access_token) throw new Error("Access token is required.");

    const hint = "••••" + creds.access_token.slice(-4);
    const patch = {
      phone_number_id: data.phone_number_id,
      waba_id: data.waba_id,
      verify_token: data.verify_token,
      credentials_enc: encryptJSON(creds),
      credentials_hint: hint,
      last_error: null,
    };
    if (existing) await supabaseAdmin.from("ai_admin_connections").update(patch).eq("id", existing.id);
    else await supabaseAdmin.from("ai_admin_connections").insert({ singleton: true, ...patch });
    return { ok: true };
  });

/** Generate a new verify token and save it immediately, so the same value
 *  works for Meta's webhook verification challenge without extra steps. */
export const generateAiAdminVerifyToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { randomBytes } = await import("node:crypto");
    const token = `orzen_${randomBytes(24).toString("hex")}`;
    const { data: existing } = await supabaseAdmin
      .from("ai_admin_connections")
      .select("id")
      .eq("singleton", true)
      .maybeSingle();
    if (existing) await supabaseAdmin.from("ai_admin_connections").update({ verify_token: token }).eq("id", existing.id);
    else await supabaseAdmin.from("ai_admin_connections").insert({ singleton: true, verify_token: token });
    return { ok: true, verify_token: token };
  });

export const verifyAiAdminConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadConnection, readCreds } = await import("@/lib/ai-admin/connection.server");
    const conn = await loadConnection();
    const creds = readCreds(conn);
    if (!conn?.phone_number_id || !creds?.access_token) throw new Error("Add credentials first.");
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${conn.phone_number_id}?fields=display_phone_number,verified_name`,
      { headers: { authorization: `Bearer ${creds.access_token}` } },
    );
    const body = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      const msg = body?.error?.message || `HTTP ${res.status}`;
      await supabaseAdmin
        .from("ai_admin_connections")
        .update({ status: "error", last_error: String(msg).slice(0, 300) })
        .eq("id", conn.id);
      return { ok: false, error: String(msg) };
    }
    await supabaseAdmin
      .from("ai_admin_connections")
      .update({
        status: "connected",
        display_number: body.display_phone_number ?? null,
        last_verified_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", conn.id);
    return { ok: true, number: body.display_phone_number as string | null, name: body.verified_name as string | null };
  });

export const testAiAdminConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ to: z.string().min(6) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { sendAdminMessage } = await import("@/lib/ai-admin/connection.server");
    await sendAdminMessage(data.to, "✅ ORZEN AI Admin Control test message. Your WhatsApp connection is working.");
    return { ok: true };
  });

export const disconnectAiAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("ai_admin_connections")
      .update({
        status: "disconnected",
        credentials_enc: null,
        credentials_hint: null,
        display_number: null,
        last_verified_at: null,
        last_error: null,
      })
      .eq("singleton", true);
    return { ok: true };
  });

// ------------------------------- Settings ----------------------------------

export const getAiAdminSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("ai_admin_settings").select("*").eq("singleton", true).maybeSingle();
    return data ?? null;
  });

export const saveAiAdminSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        agent_enabled: z.boolean(),
        test_mode: z.boolean(),
        reply_language: z.enum(["auto", "English", "Bengali"]),
        model: z.string().min(1),
        admin_numbers: z.array(z.string()),
        rate_limit_per_minute: z.number().int().min(1).max(120),
        confirm_medium_risk: z.boolean(),
        confirm_high_risk: z.boolean(),
        daily_digest_enabled: z.boolean(),
        daily_digest_hour: z.number().int().min(0).max(23),
        pending_alert_enabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const numbers = data.admin_numbers.map((n) => n.replace(/[^\d]/g, "")).filter(Boolean);
    const { error } = await supabaseAdmin
      .from("ai_admin_settings")
      .update({ ...data, admin_numbers: numbers })
      .eq("singleton", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --------------------------- Permissions -----------------------------------

export const listAiAdminPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadPermissions } = await import("@/lib/ai-admin/tools.server");
    return await loadPermissions(supabaseAdmin);
  });

export const setAiAdminPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ action_key: z.string(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ACTION_BY_KEY } = await import("@/lib/ai-admin/catalog");
    const meta = ACTION_BY_KEY[data.action_key];
    if (!meta) throw new Error("Unknown action");
    const { error } = await supabaseAdmin
      .from("ai_admin_permissions")
      .upsert(
        { action_key: data.action_key, group_key: meta.group, risk: meta.risk, enabled: data.enabled },
        { onConflict: "action_key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------------------------- Notification rules ------------------------------

export const listAiAdminRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("ai_admin_notification_rules").select("*").order("event_key");
    return data ?? [];
  });

export const saveAiAdminRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        event_key: z.string(),
        enabled: z.boolean(),
        template: z.string().max(3000),
        recipient: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ai_admin_notification_rules").upsert(
      {
        event_key: data.event_key,
        enabled: data.enabled,
        template: data.template,
        recipient: data.recipient ? data.recipient.replace(/[^\d]/g, "") : null,
      },
      { onConflict: "event_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------------------------ Test mode -----------------------------------

const TEST_VARS: Record<string, Record<string, string>> = {
  new_user: { name: "Test Merchant", email: "test@example.com", plan: "Free" },
  new_subscription: { name: "Test Merchant", plan: "Premium", amount: "৳1,500", txn: "TEST123456", status: "Pending" },
  payment: { name: "Test Merchant", amount: "৳1,500", method: "bKash", status: "Paid" },
  new_order: { store: "Test Store", invoice: "INV-TEST-001", amount: "৳2,300", name: "Test Customer" },
  failed_payment: { name: "Test Merchant", amount: "৳1,500", reason: "Insufficient balance" },
  pending_subscription: { count: "3" },
  system_alert: { message: "This is a test system alert." },
};

export const sendAiAdminTestEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ event_key: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { notifyAdminEvent } = await import("@/lib/ai-admin/notify.server");
    return await notifyAdminEvent(data.event_key as any, TEST_VARS[data.event_key] ?? {}, { test: true });
  });

export const runAiAdminCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ text: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runAdminAgent } = await import("@/lib/ai-admin/agent.server");

    // Console conversations share one thread so confirmations can be resolved.
    const waId = `console:${context.userId}`;
    let { data: thread } = await supabaseAdmin
      .from("ai_admin_threads")
      .select("id")
      .eq("wa_id", waId)
      .maybeSingle();
    if (!thread) {
      const ins = await supabaseAdmin
        .from("ai_admin_threads")
        .insert({ wa_id: waId, display_name: "Admin Console" })
        .select("id")
        .maybeSingle();
      thread = ins.data;
    }
    const threadId = thread?.id ?? null;

    const { data: history } = threadId
      ? await supabaseAdmin
          .from("ai_admin_messages")
          .select("role, content")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: false })
          .limit(10)
      : { data: [] as { role: string; content: string }[] };

    if (threadId) {
      await supabaseAdmin.from("ai_admin_messages").insert({
        thread_id: threadId,
        role: "user",
        content: data.text,
        channel: "console",
      });
    }

    const result = await runAdminAgent({
      text: data.text,
      history: (history ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      threadId,
      waId,
      actor: context.userId,
      channel: "console",
    });

    if (threadId) {
      await supabaseAdmin.from("ai_admin_messages").insert({
        thread_id: threadId,
        role: "assistant",
        content: result.reply,
        channel: "console",
        actions: result.actions as never,
      });
      await supabaseAdmin
        .from("ai_admin_threads")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", threadId);
    }
    return result;
  });

// --------------------------- History & logs ---------------------------------

export const listAiAdminThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ai_admin_threads")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const listAiAdminMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ thread_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("ai_admin_messages")
      .select("*")
      .eq("thread_id", data.thread_id)
      .order("created_at", { ascending: true })
      .limit(200);
    return rows ?? [];
  });

export const listAiAdminLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ result: z.string().optional(), search: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("ai_admin_action_logs").select("*").order("created_at", { ascending: false }).limit(200);
    if (data.result && data.result !== "all") q = q.eq("result", data.result);
    if (data.search) q = q.or(`action_key.ilike.%${data.search}%,target_label.ilike.%${data.search}%`);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const listAiAdminPending = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ai_admin_pending_actions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const decideAiAdminPending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { TOOL_BY_KEY, loadPermissions, logAction } = await import("@/lib/ai-admin/tools.server");
    const { data: pending } = await supabaseAdmin
      .from("ai_admin_pending_actions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!pending || pending.status !== "pending") throw new Error("This action is no longer pending.");

    if (!data.approve) {
      await supabaseAdmin.from("ai_admin_pending_actions").update({ status: "cancelled" }).eq("id", pending.id);
      await logAction(supabaseAdmin, {
        action_key: pending.action_key,
        risk: pending.risk,
        args: pending.args,
        result: "cancelled",
        target_label: pending.summary,
        channel: "console",
        actor: context.userId,
      });
      return { ok: true, executed: false, summary: pending.summary, result: "" };
    }

    const tool = TOOL_BY_KEY[pending.action_key];
    if (!tool) throw new Error("Unknown action");
    const perms = await loadPermissions(supabaseAdmin);
    if (!perms[tool.key]) throw new Error("This action is disabled in Commands & Permissions.");

    try {
      const result = await tool.run(supabaseAdmin, pending.args as any);
      await supabaseAdmin.from("ai_admin_pending_actions").update({ status: "executed" }).eq("id", pending.id);
      await logAction(supabaseAdmin, {
        action_key: tool.key,
        risk: tool.risk,
        args: pending.args,
        target_label: pending.summary,
        channel: "console",
        actor: context.userId,
      });
      return { ok: true, executed: true, summary: pending.summary, result: JSON.stringify(result).slice(0, 2000) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin.from("ai_admin_pending_actions").update({ status: "failed" }).eq("id", pending.id);
      await logAction(supabaseAdmin, {
        action_key: tool.key,
        risk: tool.risk,
        args: pending.args,
        result: "failed",
        result_detail: msg,
        target_label: pending.summary,
        channel: "console",
        actor: context.userId,
      });
      throw new Error(msg);
    }
  });

// --------------------------- Messenger channel ------------------------------

export const getAiAdminMessenger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("ai_admin_messenger_connections")
      .select(
        "status, page_id, page_name, verify_token, admin_psids, credentials_hint, last_verified_at, last_error, updated_at",
      )
      .eq("singleton", true)
      .maybeSingle();
    return data ?? null;
  });

export const saveAiAdminMessenger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        page_id: z.string().min(1),
        page_access_token: z.string().optional(),
        app_secret: z.string().optional(),
        verify_token: z.string().min(6),
        admin_psids: z.array(z.string()).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { encryptJSON, decryptJSON } = await import("@/lib/crypto/credentials.server");

    const { data: existing } = await context.supabase
      .from("ai_admin_messenger_connections")
      .select("id, credentials_enc")
      .eq("singleton", true)
      .maybeSingle();

    let creds: { page_access_token: string; app_secret?: string } | null = null;
    if (data.page_access_token) {
      creds = { page_access_token: data.page_access_token, app_secret: data.app_secret || undefined };
    } else if (existing?.credentials_enc) {
      const prev = decryptJSON<{ page_access_token: string; app_secret?: string }>(existing.credentials_enc);
      creds = { page_access_token: prev.page_access_token, app_secret: data.app_secret || prev.app_secret };
    }
    if (!creds?.page_access_token) throw new Error("Page access token is required.");

    const patch = {
      page_id: data.page_id,
      verify_token: data.verify_token,
      admin_psids: data.admin_psids.map((p) => p.trim()).filter(Boolean),
      credentials_enc: encryptJSON(creds),
      credentials_hint: "••••" + creds.page_access_token.slice(-4),
      last_error: null,
    };
    if (existing) await context.supabase.from("ai_admin_messenger_connections").update(patch).eq("id", existing.id);
    else await context.supabase.from("ai_admin_messenger_connections").insert({ singleton: true, ...patch });
    return { ok: true };
  });

export const generateAiAdminMessengerToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { randomBytes } = await import("node:crypto");
    const token = `orzen_msgr_${randomBytes(24).toString("hex")}`;
    const { data: existing } = await context.supabase
      .from("ai_admin_messenger_connections")
      .select("id")
      .eq("singleton", true)
      .maybeSingle();
    if (existing)
      await context.supabase.from("ai_admin_messenger_connections").update({ verify_token: token }).eq("id", existing.id);
    else await context.supabase.from("ai_admin_messenger_connections").insert({ singleton: true, verify_token: token });
    return { ok: true, verify_token: token };
  });

export const verifyAiAdminMessenger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { loadMessengerConnection, readMessengerCreds } = await import("@/lib/ai-admin/messenger.server");
    const conn = await loadMessengerConnection(context.supabase);
    const creds = readMessengerCreds(conn);
    if (!conn || !creds?.page_access_token) throw new Error("Add credentials first.");
    const res = await fetch("https://graph.facebook.com/v20.0/me?fields=id,name", {
      headers: { authorization: `Bearer ${creds.page_access_token}` },
    });
    const body = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      const msg = body?.error?.message || `HTTP ${res.status}`;
      await context.supabase
        .from("ai_admin_messenger_connections")
        .update({ status: "error", last_error: String(msg).slice(0, 300) })
        .eq("id", conn.id);
      return { ok: false, error: String(msg) };
    }
    await context.supabase
      .from("ai_admin_messenger_connections")
      .update({
        status: "connected",
        page_id: body.id ?? conn.page_id,
        page_name: body.name ?? null,
        last_verified_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", conn.id);
    return { ok: true, page: body.name as string | null };
  });

export const testAiAdminMessenger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ psid: z.string().min(3) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { sendAdminMessengerMessage } = await import("@/lib/ai-admin/messenger.server");
    await sendAdminMessengerMessage(
      data.psid,
      "✅ ORZEN AI Admin Control test message. Your Messenger connection is working.",
    );
    return { ok: true };
  });

export const disconnectAiAdminMessenger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    await context.supabase
      .from("ai_admin_messenger_connections")
      .update({
        status: "disconnected",
        credentials_enc: null,
        credentials_hint: null,
        page_name: null,
        last_verified_at: null,
        last_error: null,
      })
      .eq("singleton", true);
    return { ok: true };
  });

// ============================== AI Agents =================================
// Dual-agent overview, public knowledge base, and customer support handoff.

export const aiAgentsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [messenger, settings, kb, openReq, threads, lastEvent, lastCustomer, adminCmds] = await Promise.all([
      supabaseAdmin
        .from("ai_admin_messenger_connections")
        .select("status, page_name, page_id, admin_psids, last_verified_at, last_error")
        .eq("singleton", true)
        .maybeSingle(),
      supabaseAdmin.from("ai_admin_settings").select("*").eq("singleton", true).maybeSingle(),
      supabaseAdmin.from("ai_admin_kb_entries").select("*", { count: "exact", head: true }).eq("published", true),
      supabaseAdmin.from("ai_admin_support_requests").select("*", { count: "exact", head: true }).eq("status", "open"),
      supabaseAdmin.from("ai_admin_customer_threads").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("ai_admin_webhook_events")
        .select("created_at, processed, error, wa_id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("ai_admin_customer_messages")
        .select("content, role, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      supabaseAdmin
        .from("ai_admin_action_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 86400000).toISOString()),
    ]);
    return {
      messenger: messenger.data ?? null,
      settings: settings.data ?? null,
      kbCount: kb.count ?? 0,
      openSupport: openReq.count ?? 0,
      customerThreads: threads.count ?? 0,
      lastEvent: lastEvent.data ?? null,
      recentCustomerMessages: lastCustomer.data ?? [],
      adminActions24h: adminCmds.count ?? 0,
    };
  });

export const setCustomerAgentEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("ai_admin_settings")
      .select("id")
      .eq("singleton", true)
      .maybeSingle();
    if (row) {
      await supabaseAdmin.from("ai_admin_settings").update({ customer_agent_enabled: data.enabled }).eq("id", row.id);
    } else {
      await supabaseAdmin.from("ai_admin_settings").insert({ singleton: true, customer_agent_enabled: data.enabled });
    }
    return { ok: true };
  });

// ---------------------------- Knowledge base -------------------------------

export const listKnowledgeEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("ai_admin_kb_entries")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    return data ?? [];
  });

const kbInput = z.object({
  id: z.string().uuid().optional(),
  category: z.string().min(1),
  title: z.string().min(1),
  body: z.string().default(""),
  published: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const saveKnowledgeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => kbInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const patch = {
      category: data.category,
      title: data.title,
      body: data.body,
      published: data.published,
      sort_order: data.sort_order,
    };
    if (data.id) {
      const { error } = await context.supabase.from("ai_admin_kb_entries").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("ai_admin_kb_entries").insert(patch);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteKnowledgeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("ai_admin_kb_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --------------------------- Customer support ------------------------------

export const listSupportRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("ai_admin_support_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const getCustomerConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ thread_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const [thread, messages] = await Promise.all([
      context.supabase.from("ai_admin_customer_threads").select("*").eq("id", data.thread_id).maybeSingle(),
      context.supabase
        .from("ai_admin_customer_messages")
        .select("role, content, created_at")
        .eq("thread_id", data.thread_id)
        .order("created_at", { ascending: true })
        .limit(200),
    ]);
    return { thread: thread.data ?? null, messages: messages.data ?? [] };
  });

export const replyToCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ thread_id: z.string().uuid(), message: z.string().min(1).max(1800) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: thread } = await supabaseAdmin
      .from("ai_admin_customer_threads")
      .select("id, psid")
      .eq("id", data.thread_id)
      .maybeSingle();
    if (!thread) throw new Error("Conversation not found.");

    const { sendAdminMessengerMessage } = await import("@/lib/ai-admin/messenger.server");
    await sendAdminMessengerMessage(thread.psid, data.message);

    const { appendCustomerMessage } = await import("@/lib/ai-admin/support.server");
    await appendCustomerMessage(thread.id, "admin", data.message);
    await supabaseAdmin.from("ai_admin_customer_threads").update({ status: "human" }).eq("id", thread.id);
    await supabaseAdmin
      .from("ai_admin_support_requests")
      .update({ status: "answered" })
      .eq("thread_id", thread.id)
      .eq("status", "open");
    return { ok: true };
  });

export const setCustomerThreadMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ thread_id: z.string().uuid(), mode: z.enum(["ai", "human", "closed"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("ai_admin_customer_threads")
      .update({ status: data.mode })
      .eq("id", data.thread_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const closeSupportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("ai_admin_support_requests")
      .update({ status: "closed", resolved_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --------------------------- Deployment health ----------------------------
// Presence-only report for the host the owner is currently on. Never returns
// or logs any secret value.

export const deploymentHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { serverEnvReport } = await import("@/lib/server-env");
    const keys = serverEnvReport();
    const has = (n: string) => keys.find((k) => k.name === n)?.present ?? false;

    let database = false;
    let databaseError: string | null = null;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("ai_admin_settings")
        .select("singleton")
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw new Error(error.message);
      database = true;
    } catch (e: any) {
      databaseError = e?.message ?? "Database access failed.";
    }

    let credentials = false;
    let credentialsError: string | null = null;
    try {
      const { encryptJSON, decryptJSON } = await import("@/lib/crypto/credentials.server");
      const probe = decryptJSON<{ ok: boolean }>(encryptJSON({ ok: true }));
      credentials = probe?.ok === true;
    } catch (e: any) {
      credentialsError = e?.message ?? "Credential encryption is unavailable.";
    }

    let forwardedFrom: string | null = null;
    try {
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      if (getRequestHeader("x-orzen-forwarded")) {
        forwardedFrom = getRequestHeader("x-forwarded-host") ?? "custom domain";
      }
    } catch {
      /* header access unavailable — not critical */
    }

    return {
      keys,
      database,
      databaseError,
      credentials,
      credentialsError,
      ai: has("LOVABLE_API_KEY"),
      forwarded: Boolean(forwardedFrom),
      forwardedFrom,
      ok: database && credentials && has("LOVABLE_API_KEY"),
    };
  });
