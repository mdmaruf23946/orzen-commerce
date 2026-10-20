// Web Chat (storefront chat box) settings + inbox. Store-scoped via requireSupabaseAuth.
// Conversations live in ai_conversations with channel = "web".
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { myStoreRow } from "@/lib/store-access";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function storeIdFor(supabase: any, userId: string) {
  const row = await myStoreRow(supabase, userId, "id", "ai_agent");
  if (!row) throw new Error("Store not found");
  return row.id as string;
}

async function assertWebConv(supabase: any, storeId: string, id: string) {
  const { data } = await supabase.from("ai_conversations").select("id,store_id,channel").eq("id", id).maybeSingle();
  if (!data || data.store_id !== storeId || data.channel !== "web") throw new Error("Conversation not found");
}

// ---------- Settings ----------

export const getWebchatSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("store_ai_agents")
      .select("enabled,agent_name,welcome_message")
      .eq("store_id", storeId)
      .maybeSingle();
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { count: convs } = await context.supabase
      .from("ai_conversations")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("channel", "web")
      .gte("created_at", since);
    return {
      enabled: (data as any)?.enabled !== false,
      agent_name: (data as any)?.agent_name ?? "Sales Assistant",
      welcome_message: (data as any)?.welcome_message ?? "Hi! How can I help you today?",
      conversations_7d: convs ?? 0,
    };
  });

export const updateWebchatSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        enabled: z.boolean(),
        agent_name: z.string().trim().min(1).max(80),
        welcome_message: z.string().trim().min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("store_ai_agents")
      .upsert({ store_id: storeId, ...data } as any, { onConflict: "store_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Inbox ----------

export const listWebConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        filter: z.enum(["all", "unread", "ai", "human", "failed"]).default("all"),
        search: z.string().trim().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    let failedIds: string[] | null = null;
    if (data.filter === "failed") {
      const { data: errs } = await context.supabase
        .from("ai_messages")
        .select("conversation_id, ai_conversations!inner(store_id,channel)")
        .eq("message_type", "error")
        .eq("ai_conversations.store_id", storeId)
        .eq("ai_conversations.channel", "web")
        .order("created_at", { ascending: false })
        .limit(200);
      failedIds = Array.from(new Set((errs ?? []).map((e: any) => e.conversation_id)));
      if (!failedIds.length) return [];
    }
    let q = context.supabase
      .from("ai_conversations")
      .select("id,customer_name,phone,unread_count,last_message_at,last_message_preview,handoff_mode,status,lead_status,created_at")
      .eq("store_id", storeId)
      .eq("channel", "web")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(80);
    if (data.filter === "unread") q = q.gt("unread_count", 0);
    if (data.filter === "ai") q = q.eq("handoff_mode", "ai");
    if (data.filter === "human") q = q.eq("handoff_mode", "human");
    if (failedIds) q = q.in("id", failedIds);
    if (data.search) {
      const s = data.search.replace(/[%_,()]/g, "");
      q = q.or(`customer_name.ilike.%${s}%,phone.ilike.%${s}%,last_message_preview.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listWebMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    await assertWebConv(context.supabase, storeId, data.conversationId);
    const { data: rows, error } = await context.supabase
      .from("ai_messages")
      .select("id,role,content,direction,message_type,sent_by_user_id,created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    await context.supabase
      .from("ai_conversations")
      .update({ unread_count: 0, last_read_at: new Date().toISOString() } as any)
      .eq("id", data.conversationId);
    return [...(rows ?? [])].reverse();
  });

export const setWebHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversationId: z.string().uuid(), mode: z.enum(["ai", "human"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    await assertWebConv(context.supabase, storeId, data.conversationId);
    const { error } = await context.supabase
      .from("ai_conversations")
      .update({
        handoff_mode: data.mode,
        handoff_at: new Date().toISOString(),
        handoff_reason: data.mode === "human" ? "admin_takeover" : "returned_to_ai",
      } as any)
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendWebManualMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ conversationId: z.string().uuid(), text: z.string().trim().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    await assertWebConv(context.supabase, storeId, data.conversationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ai_messages").insert({
      conversation_id: data.conversationId,
      role: "assistant",
      direction: "out",
      message_type: "text",
      content: data.text,
      sent_by_user_id: context.userId,
      delivery_status: "sent",
    } as any);
    if (error) throw new Error(error.message);
    // A merchant reply means a human owns this chat now.
    await supabaseAdmin
      .from("ai_conversations")
      .update({
        handoff_mode: "human",
        handoff_at: new Date().toISOString(),
        handoff_reason: "admin_takeover",
        last_message_at: new Date().toISOString(),
        last_message_preview: data.text.slice(0, 200),
      } as any)
      .eq("id", data.conversationId);
    return { ok: true };
  });
