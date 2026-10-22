// Places due order-verification calls. Takes no input and only acts on rows
// already queued and due, so calling it early cannot do anything harmful.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/voice/process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        if (!(await verifyCronRequest(request))) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { drainVoiceQueue } = await import("@/lib/voice/queue.server");
        try {
          return Response.json({ ok: true, ...(await drainVoiceQueue(supabaseAdmin, 10)) });
        } catch (e) {
          console.error("[voice-process]", (e as Error).message);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
