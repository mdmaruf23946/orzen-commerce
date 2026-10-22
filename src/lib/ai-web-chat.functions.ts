// Public server functions for the storefront AI web chat widget.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const isNewKey = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isNewKey && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input as any, { ...init, headers });
      },
    },
  });
}

async function resolveStoreId(slug: string): Promise<string | null> {
  const sb = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data } = await sb.rpc("get_public_store_by_slug", { _slug: slug });
  return (data as { id: string } | null)?.id ?? null;
}

export const getWebChatHistory = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({
      slug: z.string().min(1).max(120),
      conversationId: z.string().uuid().optional(),
      chatKey: z.string().max(128).optional(),
      customerToken: z.string().max(128).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const empty = { messages: [] as any[], handedOff: false, conversationId: null as string | null };
    const storeId = await resolveStoreId(data.slug);
    if (!storeId) return empty;
    const sb = admin();
    const { canAccessWebConv, customerIdFromToken } = await import("@/lib/web-chat-access.server");
    const customerId = await customerIdFromToken(sb, storeId, data.customerToken);
    let conv: any = null;
    if (data.conversationId) {
      const { data: c } = await sb
        .from("ai_conversations")
        .select("id,store_id,handoff_mode,web_access_hash,web_customer_id")
        .eq("id", data.conversationId)
        .maybeSingle();
      if (await canAccessWebConv(c as any, storeId, data.chatKey, customerId)) conv = c;
    }
    if (!conv && customerId) {
      // Same signed-in account on another browser → their own latest chat.
      const { data: c } = await sb
        .from("ai_conversations")
        .select("id,store_id,handoff_mode,web_access_hash,web_customer_id")
        .eq("store_id", storeId)
        .eq("channel", "web")
        .eq("web_customer_id", customerId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      conv = c;
    }
    if (!conv) return empty;
    const { data: rows } = await sb
      .from("ai_messages")
      .select("id,role,content,message_type,attachments,created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true })
      .limit(50);
    return {
      messages: (rows ?? []).map((r: any) => ({
        id: r.id,
        role: r.role as "user" | "assistant" | "system",
        content: r.content,
        products:
          r.message_type === "product_card" && Array.isArray(r.attachments)
            ? r.attachments
                .filter((a: any) => a?.type === "product_card" && a.product_id)
                .map((a: any) => ({
                  id: String(a.product_id),
                  name: String(a.name ?? ""),
                  price: Number(a.price ?? 0),
                  old_price: a.old_price ?? null,
                  stock: Number(a.stock ?? 0),
                  image_url: a.image_url ?? null,
                  product_url: a.url ?? null,
                }))
            : [],
      })),
      handedOff: conv.handoff_mode === "human",
      conversationId: conv.id as string,
    };
  });

export const escalateWebChat = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      slug: z.string().min(1).max(120),
      conversationId: z.string().uuid(),
      reason: z.string().trim().min(1).max(500).optional().default("Customer requested a human agent"),
      chatKey: z.string().max(128).optional(),
      customerToken: z.string().max(128).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const storeId = await resolveStoreId(data.slug);
    if (!storeId) throw new Error("Store not found");
    const sb = admin();
    const { data: conv } = await sb
      .from("ai_conversations")
      .select("id,store_id,web_access_hash,web_customer_id")
      .eq("id", data.conversationId)
      .maybeSingle();
    const { canAccessWebConv, customerIdFromToken } = await import("@/lib/web-chat-access.server");
    const customerId = await customerIdFromToken(sb, storeId, data.customerToken);
    if (!(await canAccessWebConv(conv as any, storeId, data.chatKey, customerId))) throw new Error("Conversation not found");
    await sb.from("ai_conversations").update({
      handoff_mode: "human",
      handoff_reason: data.reason,
      handoff_at: new Date().toISOString(),
    } as any).eq("id", conv.id);
    await sb.from("admin_notifications").insert({
      store_id: storeId,
      kind: "human_handoff",
      title: "Web chat needs a human",
      body: data.reason,
      meta: { conversation_id: conv.id, channel: "web" },
    } as any);
    return { ok: true };
  });
