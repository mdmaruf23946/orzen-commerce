// AI Admin Control WhatsApp webhook (platform owner channel).
// Meta Cloud API -> signature verification -> sender allow-list -> rate limit
// -> dedup -> AI Admin agent -> reply. Kept separate from the per-store webhook.
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

function verifySignature(raw: string, header: string | null, appSecret: string) {
  if (!header) return false;
  const expected = "sha256=" + createHmac("sha256", appSecret).update(raw, "utf8").digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/ai-admin/webhook")({
  server: {
    handlers: {
      // Meta verification challenge
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        const { loadConnection } = await import("@/lib/ai-admin/connection.server");
        const conn = await loadConnection();
        if (mode === "subscribe" && conn?.verify_token && token === conn.verify_token) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const raw = await request.text();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { loadConnection, readCreds, loadSettings, sendAdminMessage } = await import(
          "@/lib/ai-admin/connection.server"
        );
        const conn = await loadConnection();
        const creds = readCreds(conn);
        if (!conn || !creds?.access_token) return new Response("Not configured", { status: 200 });

        // 1. Signature verification is mandatory — unsigned calls are rejected.
        if (!creds.app_secret) return new Response("App secret required", { status: 401 });
        if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), creds.app_secret))
          return new Response("Invalid signature", { status: 401 });

        let payload: any = {};
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const value = payload?.entry?.[0]?.changes?.[0]?.value;
        const msg = value?.messages?.[0];
        if (!msg) return new Response("ok", { status: 200 });

        const waId: string = String(msg.from ?? "").replace(/[^\d]/g, "");
        const messageId: string = String(msg.id ?? "");
        const text: string =
          msg.type === "text" ? String(msg.text?.body ?? "") : msg.type === "button" ? String(msg.button?.text ?? "") : "";

        // 2. Dedup on message id.
        const { error: dedupError } = await supabaseAdmin
          .from("ai_admin_webhook_events")
          .insert({ message_id: messageId || null, wa_id: waId, payload });
        if (dedupError && String(dedupError.code) === "23505") return new Response("duplicate", { status: 200 });

        const settings = await loadSettings();
        const allowed = ((settings?.admin_numbers as string[] | null) ?? []).map((n) => n.replace(/[^\d]/g, ""));

        // 3. Sender verification.
        if (allowed.length === 0 || !allowed.includes(waId)) {
          await supabaseAdmin
            .from("ai_admin_webhook_events")
            .update({ processed: true, error: "Sender not allow-listed" })
            .eq("message_id", messageId);
          return new Response("ok", { status: 200 });
        }

        if (!settings?.agent_enabled) {
          await supabaseAdmin
            .from("ai_admin_webhook_events")
            .update({ processed: true, error: "Agent disabled" })
            .eq("message_id", messageId);
          return new Response("ok", { status: 200 });
        }

        // 4. Rate limit per sender per minute.
        const since = new Date(Date.now() - 60_000).toISOString();
        const { count } = await supabaseAdmin
          .from("ai_admin_webhook_events")
          .select("*", { count: "exact", head: true })
          .eq("wa_id", waId)
          .gte("created_at", since);
        if ((count ?? 0) > (settings.rate_limit_per_minute ?? 20)) {
          await sendAdminMessage(waId, "⏳ Too many requests. Please wait a moment and try again.").catch(() => {});
          return new Response("rate limited", { status: 200 });
        }

        if (!text.trim()) return new Response("ok", { status: 200 });

        // 5. Thread + history.
        let { data: thread } = await supabaseAdmin
          .from("ai_admin_threads")
          .select("id")
          .eq("wa_id", waId)
          .maybeSingle();
        if (!thread) {
          const ins = await supabaseAdmin
            .from("ai_admin_threads")
            .insert({ wa_id: waId, display_name: value?.contacts?.[0]?.profile?.name ?? null })
            .select("id")
            .maybeSingle();
          thread = ins.data;
        }
        const threadId = thread?.id ?? null;

        const { data: history } = threadId
          ? await supabaseAdmin
              .from("ai_admin_messages")
              .select("role, content")
              .eq("thread_id", threadId)
              .order("created_at", { ascending: false })
              .limit(10)
          : { data: [] as { role: string; content: string }[] };

        if (threadId) {
          await supabaseAdmin
            .from("ai_admin_messages")
            .insert({ thread_id: threadId, role: "user", content: text, channel: "whatsapp" });
        }

        // 6. Agent run (permission + confirmation gated inside).
        let reply = "";
        let actions: string[] = [];
        try {
          const { runAdminAgent } = await import("@/lib/ai-admin/agent.server");
          const result = await runAdminAgent({
            text,
            history: (history ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
            waId,
            threadId,
            actor: waId,
            channel: "whatsapp",
          });
          reply = result.reply;
          actions = result.actions;
        } catch (e) {
          reply = `⚠️ ${e instanceof Error ? e.message : "Something went wrong."}`;
        }

        if (threadId) {
          await supabaseAdmin.from("ai_admin_messages").insert({
            thread_id: threadId,
            role: "assistant",
            content: reply,
            channel: "whatsapp",
            actions: actions as never,
          });
          await supabaseAdmin
            .from("ai_admin_threads")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", threadId);
        }

        await sendAdminMessage(waId, reply).catch(() => {});
        if (messageId) {
          await supabaseAdmin.from("ai_admin_webhook_events").update({ processed: true }).eq("message_id", messageId);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
