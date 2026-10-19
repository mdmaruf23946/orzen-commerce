import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  buildSystemPrompt,
  scopedToolsForText,
  getModelForStore,
  loadAiContext,
  logUsage,
  resolveFocusProduct,
} from "@/lib/ai-agent.server";

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const isNewKey = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isNewKey && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input as any, { ...init, headers });
      },
    },
  });
}

function siteOriginFromRequest(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  return `${proto}://${host}`.replace(/\/$/, "");
}

export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { guardRequest } = await import("@/lib/rate-limit.server");
        const blocked = await guardRequest("ai_chat", request);
        if (blocked) return blocked;
        const body = (await request.json()) as {
          slug?: string;
          messages?: UIMessage[];
          conversationId?: string;
        };
        if (!body.slug || !Array.isArray(body.messages)) {
          return new Response("Invalid request", { status: 400 });
        }

        const sbPublic = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        const { data: storeRow } = await sbPublic.rpc("get_public_store_by_slug", {
          _slug: body.slug,
        });
        const store = storeRow as { id: string } | null;
        if (!store) return new Response("Store not found", { status: 404 });

        const sb = admin();

        // Load or create the web conversation.
        let convId = body.conversationId?.trim() || null;
        if (convId) {
          const { data: existing } = await sb
            .from("ai_conversations")
            .select("id,store_id,handoff_mode")
            .eq("id", convId)
            .maybeSingle();
          if (!existing || existing.store_id !== store.id) convId = null;
        }
        if (!convId) {
          const { data: created, error } = await sb
            .from("ai_conversations")
            .insert({ store_id: store.id, channel: "web", status: "open" } as any)
            .select("id")
            .single();
          if (error || !created) return new Response("Cannot start conversation", { status: 500 });
          convId = created.id;
        }

        // Persist the newest user message (last item in UIMessages).
        const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
        if (lastUser) {
          const text = (lastUser.parts as any[])
            .map((p: any) => (p.type === "text" ? p.text : ""))
            .join("")
            .slice(0, 4000);
          if (text) {
            await sb.from("ai_messages").insert({
              conversation_id: convId,
              role: "user",
              direction: "in",
              message_type: "text",
              content: text,
            } as any);
            await sb
              .from("ai_conversations")
              .update({
                last_message_at: new Date().toISOString(),
                last_message_preview: text.slice(0, 200),
              } as any)
              .eq("id", convId);
          }
        }

        // Respect human handoff — do not answer if conversation is in human mode.
        const { data: convRow } = await sb
          .from("ai_conversations")
          .select("handoff_mode")
          .eq("id", convId)
          .maybeSingle();
        if (convRow?.handoff_mode === "human") {
          return Response.json({ conversationId: convId, handedOff: true }, { status: 200 });
        }

        try {
          const { store: s, agent, settings } = await loadAiContext(store.id);
          const { model, modelId } = await getModelForStore();
          const siteOrigin = siteOriginFromRequest(request);
          const ctxConvId = convId;

          // Conversation state block for the LLM (pending order + last order + recent recs).
          const { data: convStateRow } = await sb
            .from("ai_conversations")
            .select("psid_profile")
            .eq("id", ctxConvId)
            .maybeSingle();
          const profile = ((convStateRow as any)?.psid_profile ?? {}) as Record<string, any>;
          const pending = (profile.pending_order ?? {}) as Record<string, any>;
          const lastOrder = profile.last_order ?? null;
          const { data: recentRecs } = await sb
            .from("ai_product_recommendations")
            .select("product_id")
            .eq("conversation_id", ctxConvId)
            .order("created_at", { ascending: false })
            .limit(3);
          const recentIds = Array.from(
            new Set((recentRecs ?? []).map((r: any) => r.product_id).filter(Boolean)),
          );

          // Pull generation params inline to avoid exporting from the server module.
          const temperature =
            typeof settings?.temperature === "number"
              ? Math.max(0, Math.min(1, settings.temperature))
              : undefined;
          const maxOutputTokens =
            typeof settings?.max_tokens === "number" && settings.max_tokens > 0
              ? Math.floor(settings.max_tokens)
              : 1024;
          const lastUserText = (() => {
            const u = [...body.messages].reverse().find((m) => m.role === "user");
            if (!u) return "";
            return (u.parts as any[]).map((p: any) => (p.type === "text" ? p.text : "")).join("");
          })();
          const focus = await resolveFocusProduct({
            storeId: store.id,
            conversationId: ctxConvId,
            text: lastUserText,
          });
          const result = streamText({
            model,
            system: buildSystemPrompt(s, agent, {
              channel: "web",
              settings,
              state: {
                pending_order: pending,
                last_order: lastOrder,
                recent_product_ids: recentIds,
              },
              focus,
              latestUserText: lastUserText,
              customerHistory: body.messages
                .filter((m) => m.role === "user")
                .map((m) => (m.parts as any[]).map((p: any) => (p.type === "text" ? p.text : "")).join(""))
                .filter(Boolean)
                .slice(-10),
            }),

            messages: await convertToModelMessages(body.messages),
            tools: await scopedToolsForText(
              {
                storeId: store.id,
                storeSlug: body.slug,
                conversationId: ctxConvId,
                siteOrigin,
                channel: "web",
                focusProductId: focus.product?.id ?? null,
              },
              lastUserText,
            ),

            stopWhen: stepCountIs(50),
            temperature,
            maxOutputTokens,

            onFinish: async ({ usage, text }) => {
              void logUsage(store.id, modelId, usage, "chat");
              // Persist the assistant reply (text only; product cards logged separately via tools).
              const clean = (text ?? "").trim().slice(0, 8000);
              if (clean) {
                await sb.from("ai_messages").insert({
                  conversation_id: ctxConvId,
                  role: "assistant",
                  direction: "out",
                  message_type: "text",
                  content: clean,
                } as any);
              }
            },
          });
          const response = result.toUIMessageStreamResponse({
            originalMessages: body.messages,
            onError: (error) => {
              const msg = error instanceof Error ? error.message : String(error);
              console.error("[ai/chat] stream error", msg);
              void sb.from("ai_messages").insert({
                conversation_id: ctxConvId,
                role: "system",
                direction: "out",
                message_type: "error",
                content: msg.slice(0, 2000),
              } as any);
              return msg.slice(0, 500);
            },
          });
          // Expose conversation id to the browser so it can persist it.
          response.headers.set("x-orzen-conversation-id", ctxConvId);
          response.headers.set("access-control-expose-headers", "x-orzen-conversation-id");
          return response;
        } catch (e) {
          const raw = (e as Error).message || "AI request failed";
          const friendly =
            raw === "Agent disabled" || raw === "AI globally disabled"
              ? "এই স্টোরের AI সহকারী এখন বন্ধ আছে। / The AI assistant is currently turned off for this store."
              : "দুঃখিত, এই মুহূর্তে উত্তর দেওয়া যাচ্ছে না। একটু পরে আবার চেষ্টা করুন। / Sorry, we couldn't reply right now. Please try again.";
          console.error("[ai/chat] failed", raw);
          void sb.from("ai_messages").insert({
            conversation_id: convId,
            role: "system",
            direction: "out",
            message_type: "error",
            content: raw.slice(0, 2000),
          } as any);
          return Response.json({ error: friendly }, { status: 503 });
        }
      },
    },
  },
});
