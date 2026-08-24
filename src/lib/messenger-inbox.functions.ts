// Messenger Inbox server functions. Owner-scoped via requireSupabaseAuth.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getOwnedStoreId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Store not found");
  return data.id as string;
}

async function assertConvOwned(supabase: any, storeId: string, conversationId: string) {
  const { data } = await supabase
    .from("ai_conversations")
    .select("id,store_id,external_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!data || data.store_id !== storeId) throw new Error("Conversation not found");
  return data as { id: string; store_id: string; external_id: string | null };
}

async function loadPageContext(storeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: integ } = await supabaseAdmin
    .from("messenger_integrations")
    .select("id,page_access_token,page_access_token_encrypted,ai_auto_reply,delivery_failures")
    .eq("store_id", storeId)
    .maybeSingle();
  if (!integ) throw new Error("Messenger integration not connected");
  let token: string | null = (integ as any).page_access_token || null;
  const enc = (integ as any).page_access_token_encrypted;
  if (!token && enc) {
    try {
      const mod = await import("@/lib/crypto/credentials.server");
      token = mod.decryptJSON<string>(enc);
    } catch { /* noop */ }
  }
  if (!token) throw new Error("Missing page access token");
  return { integ, token, admin: supabaseAdmin };
}

async function fbGraphSend(token: string, body: any) {
  const r = await fetch(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Send failed (${r.status})`);
  return j as { message_id?: string; recipient_id?: string };
}

// ---------- Conversations ----------

export const listConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        filter: z.enum(["all", "unread", "ai", "human", "orders"]).default("all"),
        search: z.string().trim().max(120).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    let q = context.supabase
      .from("ai_conversations")
      .select(
        "id,external_id,channel,customer_name,phone,psid_profile,unread_count,last_message_at,last_message_preview,handoff_mode,tags,lead_status,total_orders,total_spent,first_contact_at,created_at",
      )
      .eq("store_id", storeId)
      .eq("channel", "messenger")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.filter === "unread") q = q.gt("unread_count", 0);
    if (data.filter === "ai") q = q.eq("handoff_mode", "ai");
    if (data.filter === "human") q = q.eq("handoff_mode", "human");
    if (data.filter === "orders") q = q.gt("total_orders", 0);
    if (data.search) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.or(
        `customer_name.ilike.%${s}%,phone.ilike.%${s}%,external_id.ilike.%${s}%,last_message_preview.ilike.%${s}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { data: conv, error } = await context.supabase
      .from("ai_conversations")
      .select("*")
      .eq("id", data.id)
      .eq("store_id", storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!conv) throw new Error("Not found");
    const { data: integ } = await context.supabase
      .from("messenger_integrations")
      .select("page_name,page_picture_url,ai_auto_reply,human_takeover,delivery_failures,last_error")
      .eq("store_id", storeId)
      .maybeSingle();
    return { conv, integration: integ ?? null };
  });

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        conversationId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    await assertConvOwned(context.supabase, storeId, data.conversationId);
    const { data: rows, error } = await context.supabase
      .from("ai_messages")
      .select(
        "id,conversation_id,role,content,direction,message_type,attachments,mid,delivery_status,error,sent_by_user_id,created_at",
      )
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return [...(rows ?? [])].reverse();
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const conv = await assertConvOwned(context.supabase, storeId, data.conversationId);
    await context.supabase
      .from("ai_conversations")
      .update({ unread_count: 0 })
      .eq("id", data.conversationId);
    // best-effort mark_seen via Graph
    try {
      if (conv.external_id) {
        const { token } = await loadPageContext(storeId);
        await fbGraphSend(token, {
          recipient: { id: conv.external_id },
          sender_action: "mark_seen",
        });
      }
    } catch { /* noop */ }
    return { ok: true };
  });

export const setHandoffMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        conversationId: z.string().uuid(),
        mode: z.enum(["ai", "human"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    await assertConvOwned(context.supabase, storeId, data.conversationId);
    const { error } = await context.supabase
      .from("ai_conversations")
      .update({ handoff_mode: data.mode })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        conversationId: z.string().uuid(),
        tags: z.array(z.string().trim().min(1).max(40)).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    await assertConvOwned(context.supabase, storeId, data.conversationId);
    const { error } = await context.supabase
      .from("ai_conversations")
      .update({ tags: data.tags })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        conversationId: z.string().uuid(),
        status: z.enum(["interested", "pending", "ready", "ordered", "cancelled"]).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    await assertConvOwned(context.supabase, storeId, data.conversationId);
    const { error } = await context.supabase
      .from("ai_conversations")
      .update({ lead_status: data.status })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Notes ----------

export const listNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    await assertConvOwned(context.supabase, storeId, data.conversationId);
    const { data: rows } = await context.supabase
      .from("messenger_notes")
      .select("id,body,author_user_id,created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: false });
    return rows ?? [];
  });

export const saveNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        conversationId: z.string().uuid(),
        body: z.string().trim().min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    await assertConvOwned(context.supabase, storeId, data.conversationId);
    const { error } = await context.supabase.from("messenger_notes").insert({
      conversation_id: data.conversationId,
      store_id: storeId,
      body: data.body,
      author_user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("messenger_notes")
      .delete()
      .eq("id", data.id)
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Saved replies ----------

export const listSavedReplies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("saved_replies")
      .select("*")
      .eq("store_id", storeId)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true });
    return data ?? [];
  });

export const upsertSavedReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(100),
        body: z.string().trim().min(1).max(2000),
        sort: z.number().int().min(0).max(9999).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    if (data.id) {
      const { error } = await context.supabase
        .from("saved_replies")
        .update({ title: data.title, body: data.body, sort: data.sort })
        .eq("id", data.id)
        .eq("store_id", storeId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("saved_replies")
        .insert({ store_id: storeId, title: data.title, body: data.body, sort: data.sort });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteSavedReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("saved_replies")
      .delete()
      .eq("id", data.id)
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Manual send / retry ----------

async function persistOutgoing(
  admin: any,
  opts: {
    conversationId: string;
    userId: string;
    content: string;
    message_type: string;
    attachments?: any[];
    mid?: string | null;
    error?: string | null;
    delivery_status: "sent" | "failed" | "pending";
  },
) {
  const preview = opts.content?.slice(0, 200) || `[${opts.message_type}]`;
  const now = new Date().toISOString();
  const { data: inserted, error } = await admin
    .from("ai_messages")
    .insert({
      conversation_id: opts.conversationId,
      role: "assistant",
      direction: "out",
      content: opts.content || "",
      message_type: opts.message_type,
      attachments: opts.attachments ?? [],
      mid: opts.mid ?? null,
      delivery_status: opts.delivery_status,
      error: opts.error ?? null,
      sent_by_user_id: opts.userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (opts.delivery_status !== "failed") {
    await admin
      .from("ai_conversations")
      .update({ last_message_at: now, last_message_preview: preview })
      .eq("id", opts.conversationId);
  }
  return inserted;
}

async function sendGraph(
  token: string,
  recipientId: string,
  body: {
    text?: string;
    attachmentUrl?: string;
    attachmentType?: "image" | "video" | "audio" | "file";
    quickReplies?: { title: string; payload: string }[];
  },
) {
  const message: any = {};
  if (body.attachmentUrl && body.attachmentType) {
    message.attachment = {
      type: body.attachmentType,
      payload: { url: body.attachmentUrl, is_reusable: true },
    };
  } else if (body.text) {
    message.text = body.text;
  } else {
    throw new Error("Empty message");
  }
  if (body.quickReplies?.length) {
    message.quick_replies = body.quickReplies.slice(0, 13).map((q) => ({
      content_type: "text",
      title: q.title.slice(0, 20),
      payload: q.payload.slice(0, 1000),
    }));
  }
  return fbGraphSend(token, {
    recipient: { id: recipientId },
    messaging_type: "RESPONSE",
    message,
  });
}

export const sendManualMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        conversationId: z.string().uuid(),
        text: z.string().trim().max(2000).optional(),
        attachmentUrl: z.string().url().optional(),
        attachmentType: z.enum(["image", "video", "audio", "file"]).optional(),
        quickReplies: z
          .array(z.object({ title: z.string().min(1).max(20), payload: z.string().min(1).max(1000) }))
          .max(13)
          .optional(),
        productCard: z
          .object({
            title: z.string(),
            subtitle: z.string().optional(),
            imageUrl: z.string().url().optional(),
            url: z.string().url().optional(),
          })
          .optional(),
        orderCard: z
          .object({
            orderId: z.string(),
            status: z.string(),
            total: z.number().optional(),
            url: z.string().url().optional(),
          })
          .optional(),
      })
      .refine(
        (v) =>
          !!v.text ||
          !!v.attachmentUrl ||
          !!v.productCard ||
          !!v.orderCard,
        { message: "text, attachment, product or order card required" },
      )
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const conv = await assertConvOwned(context.supabase, storeId, data.conversationId);
    if (!conv.external_id) throw new Error("Conversation has no PSID");
    const { token, admin } = await loadPageContext(storeId);

    // Compose payload — cards become a generic template
    if (data.productCard || data.orderCard) {
      const c = data.productCard ?? {
        title: `Order ${data.orderCard!.orderId}`,
        subtitle: `${data.orderCard!.status}${data.orderCard!.total ? ` • ৳${data.orderCard!.total}` : ""}`,
        url: data.orderCard!.url,
      };
      const element: any = { title: c.title.slice(0, 80) };
      if (c.subtitle) element.subtitle = c.subtitle.slice(0, 80);
      if ((c as any).imageUrl) element.image_url = (c as any).imageUrl;
      if (c.url) {
        element.default_action = {
          type: "web_url",
          url: c.url,
          webview_height_ratio: "tall",
        };
        element.buttons = [{ type: "web_url", url: c.url, title: "View" }];
      }
      try {
        const j = await fbGraphSend(token, {
          recipient: { id: conv.external_id },
          messaging_type: "RESPONSE",
          message: {
            attachment: {
              type: "template",
              payload: { template_type: "generic", elements: [element] },
            },
          },
        });
        return await persistOutgoing(admin, {
          conversationId: data.conversationId,
          userId: context.userId,
          content: element.title,
          message_type: "template",
          attachments: [{ type: "template", element }],
          mid: j.message_id ?? null,
          delivery_status: "sent",
        });
      } catch (e) {
        return await persistOutgoing(admin, {
          conversationId: data.conversationId,
          userId: context.userId,
          content: element.title,
          message_type: "template",
          attachments: [{ type: "template", element }],
          error: (e as Error).message,
          delivery_status: "failed",
        });
      }
    }

    const contentPreview = data.text ?? `[${data.attachmentType ?? "attachment"}]`;
    const messageType = data.attachmentUrl
      ? data.attachmentType!
      : data.quickReplies?.length
      ? "quick_reply"
      : "text";

    try {
      const j = await sendGraph(token, conv.external_id, {
        text: data.text,
        attachmentUrl: data.attachmentUrl,
        attachmentType: data.attachmentType,
        quickReplies: data.quickReplies,
      });
      return await persistOutgoing(admin, {
        conversationId: data.conversationId,
        userId: context.userId,
        content: contentPreview,
        message_type: messageType,
        attachments: data.attachmentUrl
          ? [{ type: data.attachmentType, url: data.attachmentUrl }]
          : [],
        mid: j.message_id ?? null,
        delivery_status: "sent",
      });
    } catch (e) {
      // one retry for transient errors
      try {
        const j = await sendGraph(token, conv.external_id, {
          text: data.text,
          attachmentUrl: data.attachmentUrl,
          attachmentType: data.attachmentType,
          quickReplies: data.quickReplies,
        });
        return await persistOutgoing(admin, {
          conversationId: data.conversationId,
          userId: context.userId,
          content: contentPreview,
          message_type: messageType,
          attachments: data.attachmentUrl
            ? [{ type: data.attachmentType, url: data.attachmentUrl }]
            : [],
          mid: j.message_id ?? null,
          delivery_status: "sent",
        });
      } catch (e2) {
        await admin
          .from("messenger_integrations")
          .update({ last_error: (e2 as Error).message })
          .eq("store_id", storeId);
        return await persistOutgoing(admin, {
          conversationId: data.conversationId,
          userId: context.userId,
          content: contentPreview,
          message_type: messageType,
          attachments: data.attachmentUrl
            ? [{ type: data.attachmentType, url: data.attachmentUrl }]
            : [],
          error: (e2 as Error).message,
          delivery_status: "failed",
        });
      }
    }
  });

export const retryFailedMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ messageId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: msg } = await supabaseAdmin
      .from("ai_messages")
      .select(
        "id,conversation_id,content,message_type,attachments,delivery_status,ai_conversations(store_id,external_id)",
      )
      .eq("id", data.messageId)
      .maybeSingle();
    const m = msg as any;
    if (!m || m.ai_conversations?.store_id !== storeId) throw new Error("Message not found");
    if (m.delivery_status !== "failed") throw new Error("Only failed messages can be retried");
    const recipientId = m.ai_conversations?.external_id;
    if (!recipientId) throw new Error("No PSID");
    const { token } = await loadPageContext(storeId);
    const att = Array.isArray(m.attachments) && m.attachments[0];
    try {
      let j: any;
      if (att && att.type === "template" && att.element) {
        j = await fbGraphSend(token, {
          recipient: { id: recipientId },
          messaging_type: "RESPONSE",
          message: {
            attachment: { type: "template", payload: { template_type: "generic", elements: [att.element] } },
          },
        });
      } else if (att && att.url) {
        j = await sendGraph(token, recipientId, {
          attachmentUrl: att.url,
          attachmentType: att.type,
        });
      } else {
        j = await sendGraph(token, recipientId, { text: m.content });
      }
      await supabaseAdmin
        .from("ai_messages")
        .update({ delivery_status: "sent", error: null, mid: j.message_id ?? null })
        .eq("id", data.messageId);
      return { ok: true };
    } catch (e) {
      await supabaseAdmin
        .from("ai_messages")
        .update({ error: (e as Error).message })
        .eq("id", data.messageId);
      throw new Error((e as Error).message);
    }
  });

// ---------- Stats + orders ----------

export const getInboxStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const iso = startOfDay.toISOString();
    const [
      { count: total },
      { count: unread },
      { count: today },
      { count: ai_replied },
      { count: human_replied },
      { count: failed },
    ] = await Promise.all([
      context.supabase
        .from("ai_conversations")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("channel", "messenger"),
      context.supabase
        .from("ai_conversations")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("channel", "messenger")
        .gt("unread_count", 0),
      context.supabase
        .from("ai_messages")
        .select("id, ai_conversations!inner(store_id,channel)", { count: "exact", head: true })
        .eq("ai_conversations.store_id", storeId)
        .eq("ai_conversations.channel", "messenger")
        .gte("created_at", iso),
      context.supabase
        .from("ai_messages")
        .select("id, ai_conversations!inner(store_id,channel)", { count: "exact", head: true })
        .eq("ai_conversations.store_id", storeId)
        .eq("ai_conversations.channel", "messenger")
        .eq("direction", "out")
        .is("sent_by_user_id", null)
        .gte("created_at", iso),
      context.supabase
        .from("ai_messages")
        .select("id, ai_conversations!inner(store_id,channel)", { count: "exact", head: true })
        .eq("ai_conversations.store_id", storeId)
        .eq("ai_conversations.channel", "messenger")
        .eq("direction", "out")
        .not("sent_by_user_id", "is", null)
        .gte("created_at", iso),
      context.supabase
        .from("ai_messages")
        .select("id, ai_conversations!inner(store_id,channel)", { count: "exact", head: true })
        .eq("ai_conversations.store_id", storeId)
        .eq("ai_conversations.channel", "messenger")
        .eq("delivery_status", "failed"),
    ]);
    return {
      total: total ?? 0,
      unread: unread ?? 0,
      today: today ?? 0,
      ai_replied: ai_replied ?? 0,
      human_replied: human_replied ?? 0,
      failed: failed ?? 0,
    };
  });

export const listCustomerOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { data: conv } = await context.supabase
      .from("ai_conversations")
      .select("phone,customer_name")
      .eq("id", data.conversationId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!conv) return [];
    if (!conv.phone) return [];
    const { data: orders } = await context.supabase
      .from("orders")
      .select("id,invoice_no,status,subtotal,delivery_amount,discount_amount,created_at")
      .eq("store_id", storeId)
      .eq("phone", conv.phone)
      .order("created_at", { ascending: false })
      .limit(20);
    return orders ?? [];
  });

// ---------- Product picker (for product card composer) ----------

export const searchStoreProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ query: z.string().trim().max(120).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    let q = context.supabase
      .from("products")
      .select("id,name,price,primary_image_url,slug")
      .eq("store_id", storeId)
      .neq("status", "draft")
      .limit(20);
    if (data.query) q = q.ilike("name", `%${data.query}%`);
    const { data: rows } = await q;
    return rows ?? [];
  });

// ---------- Live Facebook profiles (name + picture) ----------
// Meta's stored `profile_pic` CDN URLs are signed and expire after a while, so
// cached values eventually 403. We re-fetch the profile from the Graph API on
// demand and persist the fresh name/picture back on the conversation.
export const refreshMessengerProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ ids: z.array(z.string().uuid()).max(60).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    let token: string;
    let admin: any;
    try {
      const ctx = await loadPageContext(storeId);
      token = ctx.token;
      admin = ctx.admin;
    } catch {
      return [] as { id: string; name: string | null; profile_pic: string | null }[];
    }

    let q = admin
      .from("ai_conversations")
      .select("id,external_id,psid_profile,customer_name")
      .eq("store_id", storeId)
      .eq("channel", "messenger")
      .not("external_id", "is", null)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(60);
    if (data.ids?.length) q = q.in("id", data.ids);
    const { data: rows } = await q;

    const out: { id: string; name: string | null; profile_pic: string | null }[] = [];
    const list = (rows ?? []) as any[];
    const CONCURRENCY = 5;
    for (let i = 0; i < list.length; i += CONCURRENCY) {
      const chunk = list.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (row) => {
          try {
            const r = await fetch(
              `https://graph.facebook.com/v19.0/${encodeURIComponent(row.external_id)}?fields=first_name,last_name,name,profile_pic&access_token=${encodeURIComponent(token)}`,
            );
            if (!r.ok) return;
            const p = (await r.json()) as Record<string, any>;
            const name =
              (p.name as string | undefined) ||
              [p.first_name, p.last_name].filter(Boolean).join(" ") ||
              null;
            const pic = (p.profile_pic as string | undefined) || null;
            if (!name && !pic) return;
            const merged = { ...((row.psid_profile ?? {}) as Record<string, any>), ...p };
            await admin
              .from("ai_conversations")
              .update({
                psid_profile: merged,
                ...(name ? { customer_name: name } : {}),
              })
              .eq("id", row.id);
            out.push({ id: row.id, name, profile_pic: pic });
          } catch {
            /* ignore individual failures */
          }
        }),
      );
    }
    return out;
  });
