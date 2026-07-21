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
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: "RESPONSE",
        message: { text },
      }),
    },
  );
  const j = await r.json().catch(() => ({} as any));
  if (!r.ok) throw new Error(j?.error?.message || `Send failed (${r.status})`);
  return j as { message_id?: string };
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

async function fetchPsidProfile(token: string, psid: string) {
  try {
    const r = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(psid)}?fields=first_name,last_name,profile_pic,locale,timezone&access_token=${encodeURIComponent(token)}`,
    );
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

type IncomingContent = {
  text: string;
  message_type:
    | "text"
    | "image"
    | "video"
    | "audio"
    | "file"
    | "sticker"
    | "quick_reply"
    | "postback";
  attachments: any[];
};

function parseMessage(msg: any): IncomingContent {
  if (msg?.quick_reply?.payload) {
    return {
      text: msg.text || msg.quick_reply.payload,
      message_type: "quick_reply",
      attachments: [{ type: "quick_reply", payload: msg.quick_reply.payload }],
    };
  }
  if (msg?.text) {
    return { text: msg.text, message_type: "text", attachments: [] };
  }
  const atts = Array.isArray(msg?.attachments) ? msg.attachments : [];
  if (atts.length) {
    const first = atts[0];
    const type = (first.type as string) || "file";
    const mapped: IncomingContent["message_type"] =
      type === "image" || type === "video" || type === "audio" || type === "file"
        ? (type as any)
        : type === "fallback"
        ? "file"
        : "sticker";
    return {
      text: `[${mapped}]`,
      message_type: mapped,
      attachments: atts.map((a: any) => ({ type: a.type, url: a.payload?.url, sticker_id: a.payload?.sticker_id })),
    };
  }
  return { text: "", message_type: "text", attachments: [] };
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
        if (!body || (body.object !== "page" && body.object !== "instagram")) {
          return new Response("ok");
        }
        const sb = admin();
        for (const entry of body.entry ?? []) {
          const pageId = String(entry.id);
          const { data: integ } = await sb
            .from("messenger_integrations")
            .select(
              "id,store_id,page_access_token,page_access_token_encrypted,ai_auto_reply,human_takeover,conversation_history,delivery_failures",
            )
            .eq("page_id", pageId)
            .maybeSingle();
          if (!integ) continue;
          const token =
            (await decryptToken((integ as any).page_access_token_encrypted)) ||
            (integ as any).page_access_token;

          // Handle standby events (log only)
          for (const _st of entry.standby ?? []) {
            // no-op, we don't have thread control
          }

          for (const ev of entry.messaging ?? []) {
            const senderId = ev.sender?.id;
            if (!senderId) continue;

            try {
              // deliveries / reads update outgoing message status by mids
              if (ev.delivery?.mids?.length) {
                await sb
                  .from("ai_messages")
                  .update({ delivery_status: "delivered" })
                  .in("mid", ev.delivery.mids)
                  .neq("delivery_status", "read");
                continue;
              }
              if (ev.read?.watermark) {
                // mark all outgoing before watermark as read for this conversation
                const { data: convRow } = await sb
                  .from("ai_conversations")
                  .select("id")
                  .eq("store_id", integ.store_id)
                  .eq("channel", "messenger")
                  .eq("external_id", senderId)
                  .maybeSingle();
                if (convRow) {
                  const iso = new Date(ev.read.watermark).toISOString();
                  await sb
                    .from("ai_messages")
                    .update({ delivery_status: "read" })
                    .eq("conversation_id", convRow.id)
                    .eq("direction", "out")
                    .lte("created_at", iso);
                }
                continue;
              }

              // Ensure conversation
              let { data: conv } = await sb
                .from("ai_conversations")
                .select("id,psid_profile,unread_count,handoff_mode")
                .eq("store_id", integ.store_id)
                .eq("channel", "messenger")
                .eq("external_id", senderId)
                .maybeSingle();
              if (!conv) {
                const profile = token ? await fetchPsidProfile(token, senderId) : null;
                const name = profile
                  ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null
                  : null;
                const { data: created } = await sb
                  .from("ai_conversations")
                  .insert({
                    store_id: integ.store_id,
                    channel: "messenger",
                    external_id: senderId,
                    customer_name: name,
                    psid_profile: profile ?? {},
                  })
                  .select("id,psid_profile,unread_count,handoff_mode")
                  .single();
                conv = created;
              } else if (
                token &&
                (!conv.psid_profile || Object.keys(conv.psid_profile as any).length === 0)
              ) {
                const profile = await fetchPsidProfile(token, senderId);
                if (profile) {
                  await sb
                    .from("ai_conversations")
                    .update({
                      psid_profile: profile,
                      customer_name:
                        [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null,
                    })
                    .eq("id", conv.id);
                }
              }

              // Optins / referrals — log as system rows, no reply
              if (ev.optin || ev.referral) {
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "system",
                  direction: "in",
                  message_type: "text",
                  content: ev.optin ? "[opt-in]" : "[referral]",
                  attachments: [ev.optin ?? ev.referral],
                });
                continue;
              }

              // Postback
              if (ev.postback) {
                const preview = ev.postback.title || ev.postback.payload || "[postback]";
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "user",
                  direction: "in",
                  message_type: "postback",
                  content: preview,
                  attachments: [{ payload: ev.postback.payload, title: ev.postback.title }],
                });
                await sb
                  .from("ai_conversations")
                  .update({
                    last_message_at: new Date().toISOString(),
                    last_message_preview: preview.slice(0, 200),
                    unread_count: (conv!.unread_count ?? 0) + 1,
                  })
                  .eq("id", conv!.id);
                continue;
              }

              // messages event
              const msg = ev.message;
              if (!msg || msg.is_echo) continue;
              const parsed = parseMessage(msg);
              const preview = parsed.text.slice(0, 200) || `[${parsed.message_type}]`;

              await sb.from("ai_messages").insert({
                conversation_id: conv!.id,
                role: "user",
                direction: "in",
                message_type: parsed.message_type,
                content: parsed.text || preview,
                attachments: parsed.attachments,
                mid: msg.mid ?? null,
              });
              await sb
                .from("ai_conversations")
                .update({
                  last_message_at: new Date().toISOString(),
                  last_message_preview: preview,
                  unread_count: (conv!.unread_count ?? 0) + 1,
                })
                .eq("id", conv!.id);

              // AI reply gate
              const handoff = (conv as any)!.handoff_mode ?? "ai";
              if (handoff !== "ai") continue;
              if ((integ as any).human_takeover || (integ as any).ai_auto_reply === false) continue;
              if (!token) continue;
              if (parsed.message_type !== "text" && parsed.message_type !== "quick_reply") continue;

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
              const messages = history.map((m) => ({ role: m.role as any, content: m.content }));
              const reply = await generateAgentReply({
                storeId: integ.store_id,
                messages,
                system: buildSystemPrompt(store, agent),
              });

              try {
                const sent = await fbSend(token, senderId, reply);
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "assistant",
                  direction: "out",
                  message_type: "text",
                  content: reply,
                  mid: sent.message_id ?? null,
                  delivery_status: "sent",
                });
                await sb
                  .from("ai_conversations")
                  .update({
                    last_message_at: new Date().toISOString(),
                    last_message_preview: reply.slice(0, 200),
                  })
                  .eq("id", conv!.id);
              } catch (sendErr) {
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "assistant",
                  direction: "out",
                  message_type: "text",
                  content: reply,
                  delivery_status: "failed",
                  error: (sendErr as Error).message,
                });
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
