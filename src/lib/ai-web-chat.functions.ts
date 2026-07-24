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
      conversationId: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const storeId = await resolveStoreId(data.slug);
    if (!storeId) return { messages: [], handedOff: false };
    const sb = admin();
    const { data: conv } = await sb
      .from("ai_conversations")
      .select("id,store_id,handoff_mode")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv || conv.store_id !== storeId) return { messages: [], handedOff: false };
    const { data: rows } = await sb
      .from("ai_messages")
      .select("id,role,content,message_type,created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true })
      .limit(50);
    return {
      messages: (rows ?? []).map((r: any) => ({
        id: r.id,
        role: r.role as "user" | "assistant" | "system",
        content: r.content,
      })),
      handedOff: conv.handoff_mode === "human",
    };
  });

export const escalateWebChat = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      slug: z.string().min(1).max(120),
      conversationId: z.string().uuid(),
      reason: z.string().trim().min(1).max(500).optional().default("Customer requested a human agent"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const storeId = await resolveStoreId(data.slug);
    if (!storeId) throw new Error("Store not found");
    const sb = admin();
    const { data: conv } = await sb
      .from("ai_conversations")
      .select("id,store_id")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv || conv.store_id !== storeId) throw new Error("Conversation not found");
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
