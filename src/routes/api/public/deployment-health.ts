import { createFileRoute } from "@tanstack/react-router";
import { PRODUCTION_SUPABASE_PROJECT_ID } from "@/lib/deployment-target";
import { serverSupabaseProjectId } from "@/lib/server-env";

export const Route = createFileRoute("/api/public/deployment-health")({
  server: {
    handlers: {
      GET: async () => {
        const serverProjectId = serverSupabaseProjectId();
        return Response.json(
          {
            ok: serverProjectId === PRODUCTION_SUPABASE_PROJECT_ID,
            serverProjectId,
            expectedProjectId: PRODUCTION_SUPABASE_PROJECT_ID,
          },
          {
            status: serverProjectId ? 200 : 503,
            headers: { "cache-control": "no-store" },
          },
        );
      },
    },
  },
});