// AI Admin Control Messenger webhook (platform owner channel).
// Facebook Page -> signature verification -> sender allow-list -> rate limit
// -> dedup -> AI Admin agent -> reply. Mirrors the WhatsApp admin webhook.
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

function verifySignature(raw: string, header: string | null, appSecret: string) {
  if (!header) return false;
  const expected = "sha256=" + createHmac("sha256", appSecret).update(raw, "utf8").digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/ai-admin/messenger-webhook")({
  server: {
    handlers: {
      // Meta verification challenge
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        const { loadMessengerConnection } = await import("@/lib/ai-admin/messenger.server");
        const conn = await loadMessengerConnection();
        if (mode === "subscribe" && conn?.verify_token && token === conn.verify_token) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const raw = await request.text();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { loadMessengerConnection, readMessengerCreds, sendAdminMessengerMessage } = await import(
          "@/lib/ai-admin/messenger.server"
        );
        const { loadSettings } = await import("@/lib/ai-admin/connection.server");

        let payload: any = {};
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const conn = await loadMessengerConnection();
        const creds = readMessengerCreds(conn);

        // Meta uses one Messenger callback per app. Dispatch connected Merchant
        // Pages by the payload's Page ID while preserving the exact signed body.
        // The Merchant endpoint validates the signature again with that Page's
        // encrypted App Secret before it reads or writes tenant data.
        const pageId = String(payload?.entry?.[0]?.id ?? "");

        // Page feed events (comments, posts) share this single callback. They
        // belong to the Facebook Page module, so forward the exact signed body
        // there — that endpoint re-verifies the signature with the Page's own
        // App Secret and resolves the store from the Page ID.
        const hasChanges = Array.isArray(payload?.entry?.[0]?.changes) && payload.entry[0].changes.length > 0;
        if (pageId && hasChanges) {
          const target = new URL("/api/public/facebook/webhook", request.url);
          const headers = new Headers({
            "content-type": "application/json",
            "x-orzen-facebook-routed": "page",
          });
          const sig = request.headers.get("x-hub-signature-256");
          if (sig) headers.set("x-hub-signature-256", sig);
          try {
            const routed = await fetch(target, { method: "POST", headers, body: raw });
            return new Response(await routed.text(), { status: routed.status === 401 ? 200 : routed.status });
          } catch {
            return new Response("ok", { status: 200 });
          }
        }

        if (pageId && pageId !== String(conn?.page_id ?? "")) {
          const { data: merchantPage } = await supabaseAdmin
            .from("messenger_integrations")
            .select("id")
            .eq("page_id", pageId)
            .eq("status", "connected")
            .maybeSingle();
          if (!merchantPage) return new Response("ok", { status: 200 });

          const target = new URL("/api/public/messenger/webhook", request.url);
          const headers = new Headers({
            "content-type": "application/json",
            "x-orzen-messenger-routed": "merchant",
          });
          const signature = request.headers.get("x-hub-signature-256");
          if (signature) headers.set("x-hub-signature-256", signature);
          try {
            // The Merchant endpoint now only verifies and durably enqueues, so
            // awaiting this prevents loss while still acknowledging Meta fast.
            const routed = await fetch(target, { method: "POST", headers, body: raw });
            return new Response(await routed.text(), { status: routed.status });
          } catch {
            return new Response("Messenger route unavailable", { status: 503 });
          }
        }

        if (!conn || !creds?.page_access_token) return new Response("Not configured", { status: 200 });

        if (creds.app_secret) {
          const ok = verifySignature(raw, request.headers.get("x-hub-signature-256"), creds.app_secret);
          if (!ok) return new Response("Invalid signature", { status: 401 });
        }

        const messaging = payload?.entry?.[0]?.messaging?.[0];
        if (!messaging) return new Response("ok", { status: 200 });
        if (messaging.message?.is_echo) return new Response("ok", { status: 200 });

        const psid: string = String(messaging.sender?.id ?? "");
        const messageId: string = String(messaging.message?.mid ?? "");
        const text: string = String(messaging.message?.text ?? messaging.postback?.title ?? "");
        const postbackPayload: string = String(messaging.postback?.payload ?? "");
        if (!psid) return new Response("ok", { status: 200 });

        // Dedup on message id.
        const { error: dedupError } = await supabaseAdmin
          .from("ai_admin_webhook_events")
          .insert({ message_id: messageId || null, wa_id: `psid:${psid}`, payload });
        if (dedupError && String(dedupError.code) === "23505") return new Response("duplicate", { status: 200 });

        const settings = await loadSettings();
        const allowed = (conn.admin_psids ?? []).map((p) => String(p).trim()).filter(Boolean);

        // Secure routing: admin access comes ONLY from the server-side PSID
        // allow-list. Message content can never grant it.
        const isAdmin = allowed.length > 0 && allowed.includes(psid);

        if (!isAdmin) {
          const { handleCustomerMessage } = await import("@/lib/ai-admin/customer-router.server");
          const result = await handleCustomerMessage({
            psid,
            text,
            pageAccessToken: creds.page_access_token,
            enabled: (settings as any)?.customer_agent_enabled ?? true,
          });
          if (messageId) {
            await supabaseAdmin
              .from("ai_admin_webhook_events")
              .update({ processed: true, error: result.error ?? null })
              .eq("message_id", messageId);
          }
          return new Response("ok", { status: 200 });
        }

        // Owner tapped Approve / Reject on a wallet Add Fund alert. This runs
        // even when the AI agent is switched off — it is a direct admin action,
        // authorised only by the server-side PSID allow-list above.
        {
          const { TOPUP_APPROVE_PREFIX, TOPUP_REJECT_PREFIX, decideTopupFromMessenger } = await import(
            "@/lib/ai-admin/topup-messenger.server"
          );
          const isApprove = postbackPayload.startsWith(TOPUP_APPROVE_PREFIX);
          const isReject = postbackPayload.startsWith(TOPUP_REJECT_PREFIX);
          if (isApprove || isReject) {
            const paymentId = postbackPayload.slice(
              (isApprove ? TOPUP_APPROVE_PREFIX : TOPUP_REJECT_PREFIX).length,
            );
            let out = "";
            try {
              out = await decideTopupFromMessenger({ paymentId, approve: isApprove, actor: `psid:${psid}` });
            } catch (e) {
              out = `⚠️ কাজটি সম্পন্ন করা যায়নি: ${e instanceof Error ? e.message : "unknown error"}`;
            }
            await sendAdminMessengerMessage(psid, out).catch(() => {});
            if (messageId) {
              await supabaseAdmin
                .from("ai_admin_webhook_events")
                .update({ processed: true })
                .eq("message_id", messageId);
            }
            return new Response("ok", { status: 200 });
          }
        }

        if (!settings?.agent_enabled) {
          await sendAdminMessengerMessage(
            psid,
            "🔕 AI Admin is currently turned off. Enable it in Winner Admin → AI Admin Control → AI Agent.",
          ).catch(() => {});
          if (messageId) {
            await supabaseAdmin
              .from("ai_admin_webhook_events")
              .update({ processed: true, error: "Agent disabled" })
              .eq("message_id", messageId);
          }
          return new Response("ok", { status: 200 });
        }

        // Rate limit per sender per minute.
        const since = new Date(Date.now() - 60_000).toISOString();
        const { count } = await supabaseAdmin
          .from("ai_admin_webhook_events")
          .select("*", { count: "exact", head: true })
          .eq("wa_id", `psid:${psid}`)
          .gte("created_at", since);
        if ((count ?? 0) > (settings.rate_limit_per_minute ?? 20)) {
          await sendAdminMessengerMessage(psid, "⏳ Too many requests. Please wait a moment and try again.").catch(
            () => {},
          );
          return new Response("rate limited", { status: 200 });
        }

        if (!text.trim()) return new Response("ok", { status: 200 });

        // Thread + history (shared tables, keyed by a psid: prefix).
        const threadKey = `psid:${psid}`;
        let { data: thread } = await supabaseAdmin
          .from("ai_admin_threads")
          .select("id")
          .eq("wa_id", threadKey)
          .maybeSingle();
        if (!thread) {
          const ins = await supabaseAdmin
            .from("ai_admin_threads")
            .insert({ wa_id: threadKey, display_name: "Messenger Admin" })
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
              .limit(20)
          : { data: [] as { role: string; content: string }[] };

        if (threadId) {
          await supabaseAdmin
            .from("ai_admin_messages")
            .insert({ thread_id: threadId, role: "user", content: text, channel: "messenger" });
        }

        let reply = "";
        let actions: string[] = [];
        try {
          const { runAdminAgent } = await import("@/lib/ai-admin/agent.server");
          const result = await runAdminAgent({
            text,
            history: (history ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
            waId: threadKey,
            threadId,
            actor: threadKey,
            channel: "messenger",
          });
          reply = result.reply;
          actions = result.actions;
        } catch (e) {
          const detail = e instanceof Error ? e.message : "Unknown error";
          // This is an AI-provider failure, not a Messenger/Page-ID failure.
          // Avoid the old, misleading instruction to reconnect or republish.
          const friendly = /forbidden|unauthorized|401|403/i.test(detail)
            ? /[\u0980-\u09FF]/.test(text)
              ? "⚠️ AI সেবাটি এই অনুরোধ গ্রহণ করেনি। আপনার Facebook Page সংযোগ ও ID ঠিক আছে; অনুগ্রহ করে একটু পরে আবার চেষ্টা করুন।"
              : "⚠️ The AI service rejected this request. Your Facebook Page connection and ID are valid; please try again shortly."
            : /[\u0980-\u09FF]/.test(text)
              ? "⚠️ এই মুহূর্তে অনুরোধটি সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।"
              : "⚠️ Could not process that right now. Please try again.";
          reply = friendly;
          if (messageId) {
            await supabaseAdmin
              .from("ai_admin_webhook_events")
              .update({ error: detail.slice(0, 300) })
              .eq("message_id", messageId);
          }
        }

        if (threadId) {
          await supabaseAdmin.from("ai_admin_messages").insert({
            thread_id: threadId,
            role: "assistant",
            content: reply,
            channel: "messenger",
            actions: actions as never,
          });
          await supabaseAdmin
            .from("ai_admin_threads")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", threadId);
        }

        await sendAdminMessengerMessage(psid, reply).catch(() => {});
        if (messageId) {
          await supabaseAdmin.from("ai_admin_webhook_events").update({ processed: true }).eq("message_id", messageId);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
