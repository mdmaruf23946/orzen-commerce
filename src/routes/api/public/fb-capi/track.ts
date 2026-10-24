// Browser -> server bridge for Meta Conversion API.
// Public route: verifies input, loads the store's marketing config with the
// service-role client (needed to read fb_capi_token), and forwards to Graph.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sendFbEvents, extractClientIp, type FbEventInput } from "@/lib/fb-capi.server";

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
      fbp: z.string().max(200).optional().nullable(),
      fbc: z.string().max(500).optional().nullable(),
    })
    .optional(),
});

export const Route = createFileRoute("/api/public/fb-capi/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Real storefront pages post same-origin from a browser. Requests from
        // scripts/other sites (no or foreign Origin/Referer) are dropped quietly.
        const host = new URL(request.url).host;
        const fwdHost = request.headers.get("x-forwarded-host");
        const src = request.headers.get("origin") || request.headers.get("referer");
        let srcHost = "";
        try { srcHost = src ? new URL(src).host : ""; } catch { srcHost = ""; }
        if (!srcHost || (srcHost !== host && srcHost !== fwdHost)) {
          return Response.json({ ok: true, skipped: true });
        }
        const { checkRateLimit, clientIp } = await import("@/lib/rate-limit.server");
        const rl = await checkRateLimit("platform_meta", `fbcapi:${clientIp(request)}`);
        if (!rl.allowed) return Response.json({ ok: true, skipped: true });
        let payload: z.infer<typeof bodySchema>;
        try {
          payload = bodySchema.parse(await request.json());
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: store } = await supabaseAdmin
          .from("stores")
          .select("id, marketing")
          .eq("slug", payload.store_slug)
          .eq("status", "active")
          .maybeSingle();

        const m: any = (store as any)?.marketing ?? {};
        let pixelId = m.fb_pixel_id as string | undefined;
        let token = m.fb_capi_token as string | undefined;
        let capiEnabled = m.fb_capi_enabled !== false;
        let testCode = (m.fb_test_event_code as string | undefined) || null;

        if (payload.landing_page_id) {
          const { readTrackingTargets } = await import("@/lib/marketing.server");
          const t: any = readTrackingTargets(m)[payload.landing_page_id];
          if (t?.facebook) {
            pixelId = t.facebook.pixel_id || undefined;
            token = t.facebook.capi_token || undefined;
            capiEnabled = !!t.facebook.active;
            testCode = t.facebook.test_event_code || null;
          }
        }

        if (!store || !pixelId || !token || !capiEnabled) {
          return Response.json({ ok: true, skipped: true });
        }

        const ip = extractClientIp(request.headers);
        const ua = request.headers.get("user-agent");

        const event: FbEventInput = {
          event_name: payload.event,
          event_id: payload.event_id,
          event_source_url: payload.event_source_url,
          user_data: {
            ...(payload.user_data ?? {}),
            client_ip_address: ip,
            client_user_agent: ua,
          },
          custom_data: payload.custom_data,
        };

        const result = await sendFbEvents({
          pixelId,
          accessToken: token,
          events: [event],
          testCode,
        });
        return Response.json(result, { status: result.ok ? 200 : 502 });
      },
    },
  },
});
