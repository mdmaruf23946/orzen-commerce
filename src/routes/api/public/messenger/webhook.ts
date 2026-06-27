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
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(pageToken)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
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
          const { data } = await sb.from("messenger_integrations").select("id").eq("verify_token", token).maybeSingle();
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
            .select("store_id,page_access_token")
            .eq("page_id", pageId)
            .maybeSingle();
          if (!integ) continue;
          for (const ev of entry.messaging ?? []) {
            const senderId = ev.sender?.id;
            const text = ev.message?.text;
            if (!senderId || !text) continue;
            try {
              const { store, agent } = await loadAiContext(integ.store_id);
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
              const { data: history } = await sb
                .from("ai_messages")
                .select("role,content")
                .eq("conversation_id", conv!.id)
                .order("created_at", { ascending: true })
                .limit(20);
              const messages = [
                ...(history ?? []).map((m) => ({ role: m.role as any, content: m.content })),
                { role: "user" as const, content: text },
              ];
              const reply = await generateAgentReply({
                storeId: integ.store_id,
                messages,
                system: buildSystemPrompt(store, agent),
              });
              await sb.from("ai_messages").insert([
                { conversation_id: conv!.id, role: "user", content: text },
                { conversation_id: conv!.id, role: "assistant", content: reply },
              ]);
              await fbSend(integ.page_access_token!, senderId, reply);
            } catch (e) {
              console.error("messenger handler", e);
            }
          }
        }
        return new Response("ok");
      },
    },
  },
});
