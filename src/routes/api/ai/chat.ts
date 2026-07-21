import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildSystemPrompt, buildTools, getModelForStore, loadAiContext, logUsage } from "@/lib/ai-agent.server";

export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { slug?: string; messages?: UIMessage[] };
        if (!body.slug || !Array.isArray(body.messages)) {
          return new Response("Invalid request", { status: 400 });
        }
        const sb = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        const { data: storeRow } = await sb.rpc("get_public_store_by_slug", { _slug: body.slug });
        const store = storeRow as { id: string } | null;
        if (!store) return new Response("Store not found", { status: 404 });

        try {
          const { store: s, agent } = await loadAiContext(store.id);
          const { model, modelId } = await getModelForStore();
          const result = streamText({
            model,
            system: buildSystemPrompt(s, agent),
            messages: await convertToModelMessages(body.messages),
            tools: buildTools({ storeId: store.id, storeSlug: body.slug }),
            stopWhen: stepCountIs(50),
            onFinish: ({ usage }) => {
              void logUsage(store.id, modelId, usage, "chat");
            },
          });
          return result.toUIMessageStreamResponse({ originalMessages: body.messages });
        } catch (e) {
          return new Response((e as Error).message, { status: 400 });
        }
      },
    },
  },
});
