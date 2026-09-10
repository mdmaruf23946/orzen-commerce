// Browser -> server bridge for the TikTok Events API.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  store_slug: z.string().min(1).max(120),
  landing_page_id: z.string().uuid().optional().nullable(),
  event: z.string().min(1).max(60),
  event_id: z.string().min(1).max(120),
  event_source_url: z.string().max(2000).optional(),
  custom_data: z.record(z.string(), z.any()).optional(),
  user_data: z
    .object({
      email: z.string().max(200).optional().nullable(),
      phone: z.string().max(60).optional().nullable(),
      external_id: z.string().max(120).optional().nullable(),
      ttp: z.string().max(200).optional().nullable(),
    })
    .optional(),
});

export const Route = createFileRoute("/api/public/tiktok/track")({
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

        const marketing: any = (store as any)?.marketing ?? {};
        const t: any = marketing.tiktok ?? {};
        let pixelId = t.pixel_id as string | undefined;
        let token = t.access_token as string | undefined;
        let enabled = !!t.events_api_enabled;
        if (payload.landing_page_id) {
          const { readTrackingTargets } = await import("@/lib/marketing.server");
          const tt: any = readTrackingTargets(marketing)[payload.landing_page_id];
          if (tt?.tiktok) {
            pixelId = tt.tiktok.pixel_id || undefined;
            token = tt.tiktok.access_token || undefined;
            enabled = !!tt.tiktok.active;
          }
        }
        if (!store || !enabled || !pixelId || !token) {
          return Response.json({ ok: true, skipped: true });
        }

        const { sendTiktokEvents, extractIp } = await import("@/lib/tiktok-events.server");
        const matchOn = t.match_enabled !== false;
        const result = await sendTiktokEvents({
          pixelCode: pixelId,
          accessToken: token,
          testEventCode: t.test_event_code || null,
          matching: matchOn
            ? { email: t.match_email, phone: t.match_phone, external_id: t.match_external_id }
            : { email: false, phone: false, external_id: false },
          events: [
            {
              event: payload.event,
              event_id: payload.event_id,
              page_url: payload.event_source_url,
              properties: payload.custom_data ?? {},
              user_data: {
                ...(payload.user_data ?? {}),
                ip: extractIp(request.headers),
                user_agent: request.headers.get("user-agent"),
              },
            },
          ],
        });
        return Response.json(result, { status: result.ok ? 200 : 502 });
      },
    },
  },
});
