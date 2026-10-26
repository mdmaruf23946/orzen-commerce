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
          // Only stores that actually use photo matching (connected Messenger/WhatsApp,
          // active store) are scanned — idle/unconnected stores cost nothing.
          const sb = supabaseAdmin as any;
          const [m, w] = await Promise.all([
            sb.from("messenger_integrations").select("store_id").eq("status", "connected"),
            sb.from("whatsapp_integrations").select("store_id").eq("status", "connected"),
          ]);
          const ids = [...new Set([...(m.data ?? []), ...(w.data ?? [])].map((r: any) => String(r.store_id)))];
          if (!ids.length) return Response.json({ ok: true, stores: 0 });
          const { data: active } = await sb.from("stores").select("id").in("id", ids).eq("status", "active");
          let budget = 40;
          const totals = { stores: 0, done: 0, failed: 0 };
          for (const s of active ?? []) {
            if (budget <= 0) break;
            const r: any = await syncProductImageEmbeddings(sb, { storeId: s.id, limit: budget });
            totals.stores++;
            totals.done += Number(r?.embedded ?? 0);
            totals.failed += Number(r?.failed ?? 0);
            budget -= Number(r?.embedded ?? 0) + Number(r?.failed ?? 0);
          }
          return Response.json({ ok: true, ...totals });
        } catch {
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
