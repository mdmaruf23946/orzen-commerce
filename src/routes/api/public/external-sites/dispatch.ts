import { createFileRoute } from "@tanstack/react-router";
import { dispatchOutbox } from "@/lib/external-sites.server";

// Woken by the database when an order from a connected website changes.
// Only delivers already-queued updates to merchant-configured links; accepts no input.
export const Route = createFileRoute("/api/public/external-sites/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { guardRequest } = await import("@/lib/rate-limit.server");
        const blocked = await guardRequest("landing_order", request, {});
        if (blocked) return blocked;
        const r = await dispatchOutbox(50);
        return Response.json({ ok: true, ...r });
      },
    },
  },
});
