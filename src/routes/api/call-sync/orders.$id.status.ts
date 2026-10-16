import { createFileRoute } from "@tanstack/react-router";
import { preflight } from "@/lib/call-sync.server";
import { updateOrderStatus } from "@/lib/call-sync-status.server";

export const Route = createFileRoute("/api/call-sync/orders/$id/status")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request, params }) => updateOrderStatus(request, params.id),
    },
  },
});
