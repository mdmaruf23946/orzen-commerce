import { createFileRoute } from "@tanstack/react-router";
import { preflight } from "@/lib/calls/call-sync.server";
import { updateOrderStatus } from "@/lib/calls/call-sync-status.server";

export const Route = createFileRoute("/api/call-sync/orders/$id")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      PATCH: async ({ request, params }) => updateOrderStatus(request, params.id),
    },
  },
});
