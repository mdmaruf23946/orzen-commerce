import { createFileRoute } from "@tanstack/react-router";

// Woken by the database when a new order/customer message is queued. Accepts no input;
// only delivers already-queued notifications to already-registered merchant devices.
export const Route = createFileRoute("/api/public/push/dispatch")({
  server: {
    handlers: {
      POST: async () => {
        const { dispatchPush } = await import("@/lib/push.server");
        const r = await dispatchPush(30);
        return Response.json({ ok: true, ...r });
      },
    },
  },
});
