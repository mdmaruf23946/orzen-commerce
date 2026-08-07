// Browser -> server bridge for GA4 Measurement Protocol.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  store_slug: z.string().min(1).max(120),
  event: z.string().min(1).max(60),
  event_id: z.string().min(1).max(120),
  client_id: z.string().min(1).max(120),
  event_source_url: z.string().max(2000).optional(),
  custom_data: z.record(z.string(), z.any()).optional(),
  user_id: z.string().max(120).optional().nullable(),
});

export const Route = createFileRoute("/api/public/ga4/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: z.infer<typeof bodySchema>;
        try {
          payload = bodySchema.parse(await request.json());
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: store } = await supabaseAdmin
          .from("stores")
          .select("marketing")
          .eq("slug", payload.store_slug)
          .eq("status", "active")
          .maybeSingle();

        const g: any = ((store as any)?.marketing ?? {}).google ?? {};
        const measurementId = g.ga4_id as string | undefined;
        const apiSecret = g.ga4_api_secret as string | undefined;
        if (!store || !g.ga4_enabled || !measurementId || !apiSecret) {
          return Response.json({ ok: true, skipped: true });
        }

        const { sendGa4Events } = await import("@/lib/ga4-mp.server");
        const params: Record<string, unknown> = {
          ...(payload.custom_data ?? {}),
          engagement_time_msec: 100,
          page_location: payload.event_source_url,
        };
        const result = await sendGa4Events({
          measurementId,
          apiSecret,
          clientId: payload.client_id,
          userId: payload.user_id ?? null,
          events: [{ name: payload.event, params }],
        });
        return Response.json(result, { status: result.ok ? 200 : 502 });
      },
    },
  },
});
