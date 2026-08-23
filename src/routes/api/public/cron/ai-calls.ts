// Cron endpoint: places due AI outbound calls (order confirmations + retries).
// Call every minute with Authorization: Bearer <CRON_SECRET>
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/ai-calls")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") || "";
        const secret = process.env.CRON_SECRET;
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { drainCallQueue } = await import("@/lib/ai-call-provision.server");
        return Response.json({ ok: true, ...(await drainCallQueue(supabaseAdmin, 10)) });
      },
    },
  },
});
