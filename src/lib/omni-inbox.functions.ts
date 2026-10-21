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
      .select("id,channel,customer_name,phone,unread_count,last_message_at,last_message_preview,handoff_mode,handoff_reason,total_orders,total_spent,lead_status,created_at,profile_pic:psid_profile->>profile_pic,pending_phone:psid_profile->pending_order->>phone,pending_product:psid_profile->pending_order->>product_id")
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
    // Automatic segments
    if (data.folder === "customers") q = q.or("total_orders.gte.1,lead_status.eq.ordered");
    if (data.folder === "hold") q = q.eq("lead_status", "hold");
    if (data.folder === "interested")
      q = q.eq("total_orders", 0).or("lead_status.is.null,lead_status.neq.ordered").not("psid_profile->pending_order", "is", null);
    if (data.folder === "incomplete")
      q = q.eq("total_orders", 0).not("psid_profile->pending_order", "is", null).is("psid_profile->pending_order->>phone", null);
    if (data.folder === "new") q = q.gte("first_contact_at", new Date(Date.now() - 86400_000).toISOString());
    if (data.search) {
      const s = data.search.replace(/[%_,()]/g, "");
      q = q.or(`customer_name.ilike.%${s}%,phone.ilike.%${s}%,last_message_preview.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const out = (rows ?? []).map((r: any) => {
      const ordered = (r.total_orders ?? 0) > 0 || r.lead_status === "ordered";
      const segment = ordered ? "customer" : r.lead_status === "hold" ? "hold" : r.pending_product ? (r.pending_phone ? "interested" : "incomplete") : null;
      return { ...r, failed: failed.has(r.id), vip: isVip(r), segment };
    });

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

// ---------- Customer CRM (right sidebar) ----------
// Matches this store's orders by the conversation's phone (last 10 digits) so
// "+8801…", "01…" and "8801…" are the same customer. Store-scoped always.
function phoneKey(p?: string | null) {
  const d = String(p ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
}

export const getOmniCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const storeId = await storeIdFor(sb, context.userId);
    const { data: conv } = await sb
      .from("ai_conversations")
      .select("id,store_id,channel,customer_name,phone,address,first_contact_at,tags,lead_status")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv || (conv as any).store_id !== storeId) throw new Error("Conversation not found");
    const key = phoneKey((conv as any).phone);
    let orders: any[] = [];
    if (key) {
      const { data: rows, error } = await sb
        .from("orders")
        .select("id,invoice_no,status,subtotal,created_at,courier_status,followup_status,address,customer_name")
        .eq("store_id", storeId)
        .eq("is_test", false)
        .ilike("phone", `%${key}`)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      orders = rows ?? [];
    }
    const total = orders.length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;
    const pending = orders.filter((o) => o.status === "pending").length;
    const ltv = orders.filter((o) => o.status === "delivered").reduce((s, o) => s + Number(o.subtotal || 0), 0);
    const closed = delivered + cancelled;
    const c = conv as any;
    return {
      customer: {
        name: c.customer_name ?? orders[0]?.customer_name ?? null,
        phone: c.phone ?? null,
        address: c.address ?? orders[0]?.address ?? null,
        channel: c.channel,
        firstContact: c.first_contact_at,
      },
      stats: {
        total,
        delivered,
        cancelled,
        pending,
        ltv,
        deliveryRate: closed ? Math.round((delivered / closed) * 100) : null,
        cancelRate: closed ? Math.round((cancelled / closed) * 100) : null,
      },
      recent: orders.slice(0, 8).map((o) => ({
        id: o.id,
        invoice_no: o.invoice_no,
        status: o.status,
        followup_status: o.followup_status,
        total: Number(o.subtotal || 0),
        created_at: o.created_at,
      })),
    };
  });

export const updateOmniCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        conversationId: z.string().uuid(),
        name: z.string().trim().max(100),
        phone: z.string().trim().max(20).regex(/^[+\d\s-]*$/, "ফোন নম্বর সঠিক নয়"),
        address: z.string().trim().max(400),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    await assertConv(context.supabase, storeId, data.conversationId);
    const { error } = await context.supabase
      .from("ai_conversations")
      .update({
        customer_name: data.name || null,
        phone: data.phone || null,
        address: data.address || null,
      } as any)
      .eq("id", data.conversationId)
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
