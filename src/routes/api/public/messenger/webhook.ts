import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildSystemPrompt, generateAgentReply, loadAiContext } from "@/lib/ai-agent.server";

function admin() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function fbSend(pageToken: string, recipientId: string, text: string) {
  const r = await fetch(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(pageToken)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
    },
  );
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j?.error?.message || `Send failed (${r.status})`);
  }
}

async function decryptToken(enc: string | null | undefined): Promise<string | null> {
  if (!enc) return null;
  const mod = await import("@/lib/crypto/credentials.server");
  try {
    return mod.decryptJSON<string>(enc);
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/messenger/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode === "subscribe" && token) {
          const sb = admin();
          const { data } = await sb
            .from("messenger_integrations")
            .select("id")
            .eq("verify_token", token)
            .maybeSingle();
          if (data) return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);
        if (!body || body.object !== "page") return new Response("ok");
        const sb = admin();
        for (const entry of body.entry ?? []) {
          const pageId = String(entry.id);
          const { data: integ } = await sb
            .from("messenger_integrations")
            .select(
              "id,store_id,page_access_token,page_access_token_encrypted,ai_auto_reply,human_takeover,conversation_history",
            )
            .eq("page_id", pageId)
            .maybeSingle();
          if (!integ) continue;
          const token =
            (await decryptToken((integ as any).page_access_token_encrypted)) ||
            (integ as any).page_access_token;
          for (const ev of entry.messaging ?? []) {
            const senderId = ev.sender?.id;
            const text = ev.message?.text;
            if (!senderId || !text) continue;
            try {
              // persist conversation
              let { data: conv } = await sb
                .from("ai_conversations")
                .select("id")
                .eq("store_id", integ.store_id)
                .eq("channel", "messenger")
                .eq("external_id", senderId)
                .maybeSingle();
              if (!conv) {
                const { data: created } = await sb
                  .from("ai_conversations")
                  .insert({ store_id: integ.store_id, channel: "messenger", external_id: senderId })
                  .select("id")
                  .single();
                conv = created;
              }
              // always log the incoming
              await sb.from("ai_messages").insert({ conversation_id: conv!.id, role: "user", content: text });

              // Skip AI reply when handed to human or auto-reply disabled
              if ((integ as any).human_takeover || (integ as any).ai_auto_reply === false) continue;
              if (!token) continue;

              const { store, agent } = await loadAiContext(integ.store_id);
              const useHistory = (integ as any).conversation_history !== false;
              const history = useHistory
                ? (
                    await sb
                      .from("ai_messages")
                      .select("role,content")
                      .eq("conversation_id", conv!.id)
                      .order("created_at", { ascending: true })
                      .limit(20)
                  ).data ?? []
                : [];
              const messages = [
                ...history.map((m) => ({ role: m.role as any, content: m.content })),
              ];
              const reply = await generateAgentReply({
                storeId: integ.store_id,
                messages,
                system: buildSystemPrompt(store, agent),
              });
              await sb.from("ai_messages").insert({
                conversation_id: conv!.id,
                role: "assistant",
                content: reply,
              });
              try {
                await fbSend(token, senderId, reply);
              } catch (sendErr) {
                await sb
                  .from("messenger_integrations")
                  .update({
                    last_error: (sendErr as Error).message,
                    delivery_failures: ((integ as any).delivery_failures ?? 0) + 1,
                  } as any)
                  .eq("id", (integ as any).id);
              }
            } catch (e) {
              console.error("messenger handler", e);
              await sb
                .from("messenger_integrations")
                .update({ last_error: (e as Error).message } as any)
                .eq("id", (integ as any).id);
            }
          }
        }
        return new Response("ok");
      },
    },
  },
});
