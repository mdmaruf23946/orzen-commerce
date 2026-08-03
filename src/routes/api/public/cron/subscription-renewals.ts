// Cron endpoint: daily subscription renewal engine — reminders, renewal
// invoices, grace periods and expiries. Call once a day with
//   Authorization: Bearer <CRON_SECRET>
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/subscription-renewals")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") || "";
        const secret = process.env.CRON_SECRET;
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { processRenewals } = await import("@/lib/subscriptions.server");
        const stats = await processRenewals(supabaseAdmin as any);
        return Response.json({ ok: true, ...stats });
      },
    },
  },
});
