// Omni Inbox: one store-scoped view over every chat channel (ai_conversations.channel).
// Sending reuses each channel's own send function so delivery logic stays in one place.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { myStoreRow } from "@/lib/store-access";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OMNI_CHANNEL_KEYS, OMNI_FOLDERS, isVip } from "@/lib/omni-channels";

async function storeIdFor(supabase: any, userId: string) {
  const row = await myStoreRow(supabase, userId, "id", "omni_inbox");
  if (!row) throw new Error("Store not found");
  return row.id as string;
}

async function assertConv(supabase: any, storeId: string, id: string) {
  const { data } = await supabase.from("ai_conversations").select("id,store_id").eq("id", id).maybeSingle();
  if (!data || data.store_id !== storeId) throw new Error("Conversation not found");
}

const FOLDER_KEYS = OMNI_FOLDERS.map((f) => f.key) as [string, ...string[]];

export const listOmniConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        channel: z.enum(["all", ...OMNI_CHANNEL_KEYS] as [string, ...string[]]).default("all"),
        folder: z.enum(FOLDER_KEYS).default("all"),
        search: z.string().trim().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const storeId = await storeIdFor(sb, context.userId);

    // Conversations with a failed reply in the last 7 days.
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data: errs } = await sb
      .from("ai_messages")
      .select("conversation_id, ai_conversations!inner(store_id)")
      .or("message_type.eq.error,delivery_status.eq.failed")
      .eq("ai_conversations.store_id", storeId)
      .gte("created_at", since)
      .limit(300);
    const failed = new Set((errs ?? []).map((e: any) => e.conversation_id as string));

    let q = sb
      .from("ai_conversations")
      .select("id,channel,customer_name,phone,unread_count,last_message_at,last_message_preview,handoff_mode,handoff_reason,total_orders,total_spent,created_at")
      .eq("store_id", storeId)
      .in("channel", data.channel === "all" ? [...OMNI_CHANNEL_KEYS] : [data.channel])
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(150);
    if (data.folder === "unread") q = q.gt("unread_count", 0);
    if (data.folder === "human") q = q.eq("handoff_mode", "human");
    if (data.folder === "ai") q = q.neq("handoff_mode", "human");
    if (data.folder === "attention") {
      if (!failed.size) return { rows: [], counts: {} as Record<string, number> };
      q = q.in("id", [...failed]);
    }
    if (data.folder === "vip") q = q.or("total_orders.gte.3,total_spent.gte.5000");
    if (data.search) {
      const s = data.search.replace(/[%_,()]/g, "");
      q = q.or(`customer_name.ilike.%${s}%,phone.ilike.%${s}%,last_message_preview.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const out = (rows ?? []).map((r: any) => ({ ...r, failed: failed.has(r.id), vip: isVip(r) }));

    // Badge counts per channel (unread conversations).
    const { data: unread } = await sb
      .from("ai_conversations")
      .select("channel")
      .eq("store_id", storeId)
      .gt("unread_count", 0)
      .limit(1000);
    const counts: Record<string, number> = { all: 0 };
    for (const u of unread ?? []) {
      counts[(u as any).channel] = (counts[(u as any).channel] ?? 0) + 1;
      counts.all++;
    }
    return { rows: out, counts };
  });

export const listOmniMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    await assertConv(context.supabase, storeId, data.conversationId);
    const { data: rows, error } = await context.supabase
      .from("ai_messages")
      .select("id,role,content,direction,message_type,delivery_status,attachments,sent_by_user_id,created_at")
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

export const setOmniHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversationId: z.string().uuid(), mode: z.enum(["ai", "human"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    await assertConv(context.supabase, storeId, data.conversationId);
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
