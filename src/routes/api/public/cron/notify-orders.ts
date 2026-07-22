// Cron endpoint: drains order_notifications_outbox by sending Messenger updates.
// Call every 1-2 min from pg_cron or an external scheduler with
//   Authorization: Bearer <CRON_SECRET>
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/notify-orders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") || "";
        const secret = process.env.CRON_SECRET;
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { drainOutbox } = await import("@/lib/messenger-notify.server");
        return Response.json({ ok: true, ...(await drainOutbox({ latestPerOrder: true })) });
      },
    },
  },
});
