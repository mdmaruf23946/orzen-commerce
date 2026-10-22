// Scheduled: fingerprints new/changed product photos so Messenger can match
// customer photos instantly. Idempotent and bounded — returns counts only.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/product-image-embeddings")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        if (!(await verifyCronRequest(request))) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncProductImageEmbeddings } = await import("@/lib/product-image-embeddings.server");
        try {
          const result = await syncProductImageEmbeddings(supabaseAdmin as any, { limit: 40 });
          return Response.json({ ok: true, ...result });
        } catch {
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
