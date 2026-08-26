// WhatsApp Inbox server functions. Owner-scoped via requireSupabaseAuth.
// Mirrors src/lib/messenger-inbox.functions.ts, filtered to channel = "whatsapp".
import { createServerFn } from "@tanstack/react-start";
import { myStoreRow } from "@/lib/store-access";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getOwnedStoreId(supabase: any, userId: string) {
  const data = await myStoreRow(supabase, userId, "id");
  if (!data) throw new Error("Store not found");
  return data.id as string;
}

async function assertConvOwned(supabase: any, storeId: string, conversationId: string) {
  const { data } = await supabase
    .from("ai_conversations")
    .select("id,store_id,external_id,channel")
    .eq("id", conversationId)
    .maybeSingle();
  if (!data || data.store_id !== storeId || data.channel !== "whatsapp") throw new Error("Conversation not found");
  return data as { id: string; store_id: string; external_id: string | null };
}

async function waContext(storeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: integ } = await supabaseAdmin
    .from("whatsapp_integrations")
    .select("id,phone_number_id,access_token_encrypted,ai_auto_reply,status")
    .eq("store_id", storeId)
    .maybeSingle();
  if (!integ || !(integ as any).phone_number_id) throw new Error("WhatsApp is not connected");
  let token: string | null = null;
  try {
    const mod = await import("@/lib/crypto/credentials.server");
    token = mod.decryptJSON<string>((integ as any).access_token_encrypted);
  } catch {
    token = null;
  }
  if (!token) throw new Error("WhatsApp credentials are missing. Reconnect WhatsApp.");
  return { integ: integ as any, token, phoneNumberId: (integ as any).phone_number_id as string, admin: supabaseAdmin };
}

// ---------- Conversations ----------

export const listConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        filter: z.enum(["all", "unread", "open", "waiting", "resolved", "ai", "human"]).default("all"),
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
        "id,external_id,channel,customer_name,phone,psid_profile,unread_count,last_message_at,last_message_preview,handoff_mode,status,tags,lead_status,total_orders,total_spent,first_contact_at,created_at",
      )
      .eq("store_id", storeId)
      .eq("channel", "whatsapp")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.filter === "unread") q = q.gt("unread_count", 0);
    if (data.filter === "ai") q = q.eq("handoff_mode", "ai");
    if (data.filter === "human") q = q.eq("handoff_mode", "human");
    if (data.filter === "resolved") q = q.eq("status", "resolved");
    if (data.filter === "open") q = q.neq("status", "resolved");
    if (data.filter === "waiting") q = q.eq("status", "waiting");
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
      .eq("channel", "whatsapp")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!conv) throw new Error("Not found");
    const { data: integ } = await context.supabase
      .from("whatsapp_integrations")
      .select("display_name,phone_number,status,ai_auto_reply,human_takeover,last_error")
      .eq("store_id", storeId)
      .maybeSingle();

    // WhatsApp only allows free-form replies within 24h of the last inbound message.
    const { data: lastIn } = await context.supabase
      .from("ai_messages")
      .select("created_at")
      .eq("conversation_id", data.id)
      .eq("direction", "in")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastInboundAt = lastIn?.created_at ?? null;
    const windowOpen = lastInboundAt ? Date.now() - new Date(lastInboundAt).getTime() < 24 * 3600_000 : false;

    return { conv, integration: integ ?? null, window: { open: windowOpen, last_inbound_at: lastInboundAt } };
  });

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ conversationId: z.string().uuid(), limit: z.number().int().min(1).max(200).default(100) }).parse(d),
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
    await assertConvOwned(context.supabase, storeId, data.conversationId);
    await context.supabase
      .from("ai_conversations")
      .update({ unread_count: 0, last_read_at: new Date().toISOString() })
      .eq("id", data.conversationId);
    return { ok: true };
  });

export const setHandoffMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ conversationId: z.string().uuid(), mode: z.enum(["ai", "human"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    await assertConvOwned(context.supabase, storeId, data.conversationId);
    const { error } = await context.supabase
      .from("ai_conversations")
      .update({
        handoff_mode: data.mode,
        handoff_at: new Date().toISOString(),
        handoff_reason: data.mode === "human" ? "admin_takeover" : "returned_to_ai",
      })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setConversationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ conversationId: z.string().uuid(), status: z.enum(["open", "waiting", "resolved"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    await assertConvOwned(context.supabase, storeId, data.conversationId);
    const { error } = await context.supabase
      .from("ai_conversations")
      .update({ status: data.status })
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
    z.object({ conversationId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).parse(d),
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

// ---------- Saved replies (shared with Messenger) ----------

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

// ---------- Manual send ----------

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
    delivery_status: "sent" | "failed";
  },
) {
  const preview = opts.content?.slice(0, 200) || `[${opts.message_type}]`;
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
      .update({ last_message_at: new Date().toISOString(), last_message_preview: preview })
      .eq("id", opts.conversationId);
  }
  return inserted;
}

export const sendManualMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        conversationId: z.string().uuid(),
        text: z.string().trim().max(3000).optional(),
        attachmentUrl: z.string().url().optional(),
        attachmentType: z.enum(["image", "video", "audio", "document"]).optional(),
        productId: z.string().uuid().optional(),
      })
      .refine((v) => !!v.text || !!v.attachmentUrl || !!v.productId, {
        message: "text, attachment or product required",
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const conv = await assertConvOwned(context.supabase, storeId, data.conversationId);
    if (!conv.external_id) throw new Error("Conversation has no WhatsApp number");
    const { token, phoneNumberId, admin } = await waContext(storeId);
    const wa = await import("@/lib/whatsapp-send.server");

    // Product message: image + caption + link button
    if (data.productId) {
      const { data: p } = await context.supabase
        .from("products")
        .select("id,name,slug,price,old_price,stock,short_description,primary_image_url,product_type")
        .eq("store_id", storeId)
        .eq("id", data.productId)
        .maybeSingle();
      if (!p) throw new Error("Product not found");
      const { data: store } = await context.supabase.from("stores").select("slug").eq("id", storeId).maybeSingle();
      const origin = (process.env["PUBLIC_APP_URL"] || "https://orzen.top").replace(/\/$/, "");
      const url = `${origin}/store/${store?.slug ?? "store"}/product/${p.id}`;
      const image = p.primary_image_url
        ? /^https?:\/\//i.test(p.primary_image_url)
          ? p.primary_image_url
          : `${origin}/api/img/${String(p.primary_image_url).replace(/^\/+/, "")}`
        : null;
      const caption = [
        `*${p.name}*`,
        p.old_price ? `৳${p.price} (আগে ৳${p.old_price})` : `৳${p.price}`,
        p.short_description ?? "",
        url,
      ]
        .filter(Boolean)
        .join("\n");
      try {
        const res = image
          ? await wa.sendWaImage(phoneNumberId, token, conv.external_id, image, caption)
          : await wa.sendWaText(phoneNumberId, token, conv.external_id, caption);
        return await persistOutgoing(admin, {
          conversationId: data.conversationId,
          userId: context.userId,
          content: `[product] ${p.name}`,
          message_type: "product_card",
          attachments: [{ type: "product_card", product_id: p.id, url, image_url: image }],
          mid: res.message_id ?? null,
          delivery_status: "sent",
        });
      } catch (e) {
        return await persistOutgoing(admin, {
          conversationId: data.conversationId,
          userId: context.userId,
          content: `[product] ${p.name}`,
          message_type: "product_card",
          attachments: [{ type: "product_card", product_id: p.id, url }],
          error: wa.friendlyWaError((e as Error).message),
          delivery_status: "failed",
        });
      }
    }

    const contentPreview = data.text ?? `[${data.attachmentType ?? "attachment"}]`;
    const messageType = data.attachmentUrl ? data.attachmentType! : "text";
    try {
      const res = data.attachmentUrl
        ? await wa.sendWaMedia(
            phoneNumberId,
            token,
            conv.external_id,
            data.attachmentType ?? "image",
            data.attachmentUrl,
            data.text,
          )
        : await wa.sendWaText(phoneNumberId, token, conv.external_id, data.text!);
      return await persistOutgoing(admin, {
        conversationId: data.conversationId,
        userId: context.userId,
        content: contentPreview,
        message_type: messageType,
        attachments: data.attachmentUrl ? [{ type: data.attachmentType, url: data.attachmentUrl }] : [],
        mid: res.message_id ?? null,
        delivery_status: "sent",
      });
    } catch (e) {
      const msg = wa.friendlyWaError((e as Error).message);
      await admin.from("whatsapp_integrations").update({ last_error: msg }).eq("store_id", storeId);
      return await persistOutgoing(admin, {
        conversationId: data.conversationId,
        userId: context.userId,
        content: contentPreview,
        message_type: messageType,
        attachments: data.attachmentUrl ? [{ type: data.attachmentType, url: data.attachmentUrl }] : [],
        error: msg,
        delivery_status: "failed",
      });
    }
  });

/** Sends an approved template — the only way to reopen a closed 24h window. */
export const sendTemplateMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ conversationId: z.string().uuid(), templateId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const conv = await assertConvOwned(context.supabase, storeId, data.conversationId);
    if (!conv.external_id) throw new Error("Conversation has no WhatsApp number");
    const { data: tpl } = await context.supabase
      .from("whatsapp_templates")
      .select("name,language,status")
      .eq("id", data.templateId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!tpl) throw new Error("Template not found");
    if (String(tpl.status).toUpperCase() !== "APPROVED") throw new Error("This template is not approved yet");
    const { token, phoneNumberId, admin } = await waContext(storeId);
    const wa = await import("@/lib/whatsapp-send.server");
    try {
      const res = await wa.sendWaTemplate(phoneNumberId, token, conv.external_id, tpl.name, tpl.language);
      return await persistOutgoing(admin, {
        conversationId: data.conversationId,
        userId: context.userId,
        content: `[template] ${tpl.name}`,
        message_type: "template",
        attachments: [{ type: "template", name: tpl.name, language: tpl.language }],
        mid: res.message_id ?? null,
        delivery_status: "sent",
      });
    } catch (e) {
      return await persistOutgoing(admin, {
        conversationId: data.conversationId,
        userId: context.userId,
        content: `[template] ${tpl.name}`,
        message_type: "template",
        error: wa.friendlyWaError((e as Error).message),
        delivery_status: "failed",
      });
    }
  });

// ---------- Stats / helpers ----------

export const getInboxStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const iso = startOfDay.toISOString();
    const [{ count: total }, { count: unread }, { count: today }, { count: failed }] = await Promise.all([
      context.supabase
        .from("ai_conversations")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("channel", "whatsapp"),
      context.supabase
        .from("ai_conversations")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("channel", "whatsapp")
        .gt("unread_count", 0),
      context.supabase
        .from("ai_messages")
        .select("id, ai_conversations!inner(store_id,channel)", { count: "exact", head: true })
        .eq("ai_conversations.store_id", storeId)
        .eq("ai_conversations.channel", "whatsapp")
        .gte("created_at", iso),
      context.supabase
        .from("ai_messages")
        .select("id, ai_conversations!inner(store_id,channel)", { count: "exact", head: true })
        .eq("ai_conversations.store_id", storeId)
        .eq("ai_conversations.channel", "whatsapp")
        .eq("delivery_status", "failed"),
    ]);
    return { total: total ?? 0, unread: unread ?? 0, today: today ?? 0, failed: failed ?? 0 };
  });

export const listCustomerOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { data: conv } = await context.supabase
      .from("ai_conversations")
      .select("phone")
      .eq("id", data.conversationId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!conv?.phone) return [];
    const { data: orders } = await context.supabase
      .from("orders")
      .select("id,invoice_no,status,subtotal,delivery_amount,discount_amount,created_at")
      .eq("store_id", storeId)
      .eq("phone", conv.phone)
      .order("created_at", { ascending: false })
      .limit(20);
    return orders ?? [];
  });

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

export const listApprovedTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("whatsapp_templates")
      .select("id,name,language,status,body_preview")
      .eq("store_id", storeId)
      .eq("status", "APPROVED")
      .order("name");
    return data ?? [];
  });
