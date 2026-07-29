// Cron endpoint: refreshes courier status for all in-flight parcels.
// Call every 15-30 min with: Authorization: Bearer <CRON_SECRET>
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/sync-parcels")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") || "";
        const secret = process.env.CRON_SECRET;
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { ACTIVE_STATUSES } = await import("@/lib/couriers/status");
        const { syncOne } = await import("@/lib/courier-parcels.functions");

        const { data: parcels } = await supabaseAdmin
          .from("courier_parcels")
          .select("id, store_id")
          .in("status", ACTIVE_STATUSES as unknown as string[])
          .order("last_synced_at", { ascending: true, nullsFirst: true })
          .limit(200);

        const storeIds = [...new Set((parcels ?? []).map((p: any) => p.store_id))];
        if (!storeIds.length) return Response.json({ ok: true, checked: 0, updated: 0 });

        const { data: stores } = await supabaseAdmin
          .from("stores")
          .select("id, couriers")
          .in("id", storeIds);
        const byId = new Map((stores ?? []).map((s: any) => [s.id, s]));

        let checked = 0;
        let updated = 0;
        const errors: string[] = [];
        for (const p of parcels ?? []) {
          const store = byId.get((p as any).store_id);
          if (!store) continue;
          checked += 1;
          try {
            const r: any = await syncOne(supabaseAdmin, store as any, (p as any).id);
            if (r?.changed) updated += 1;
          } catch (e) {
            errors.push((e as Error).message);
          }
        }
        return Response.json({ ok: true, checked, updated, errors: errors.slice(0, 5) });
      },
    },
  },
});
