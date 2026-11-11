// Browser -> server bridge for the TikTok Events API.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Only standard storefront events are relayed; anything else is dropped.
const ALLOWED_EVENTS = new Set([
  "PageView", "ViewContent", "AddToCart", "InitiateCheckout", "AddPaymentInfo",
  "Search", "Lead", "Contact", "CompleteRegistration", "Purchase",
]);
const customDataSchema = z
  .object({
    value: z.number().finite().nonnegative().max(10_000_000).optional(),
    currency: z.string().regex(/^[A-Z]{3}$/).optional(),
    content_ids: z.array(z.string().max(120)).max(50).optional(),
    content_name: z.string().max(200).optional(),
    content_type: z.string().max(40).optional(),
    content_category: z.string().max(200).optional(),
    num_items: z.number().int().min(0).max(10000).optional(),
    search_string: z.string().max(200).optional(),
  })
  .strip();

const bodySchema = z.object({
  store_slug: z.string().min(1).max(120),
  landing_page_id: z.string().uuid().optional().nullable(),
  event: z.string().min(1).max(60),
  event_id: z.string().min(1).max(120),
  event_source_url: z.string().max(2000).optional(),
  custom_data: z.unknown().optional(),
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
          return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });
        }
        if (!ALLOWED_EVENTS.has(payload.event)) return Response.json({ ok: true, skipped: true });
        // Browser beacons must come from a page (no cross-site/program forgery).
        const site = request.headers.get("sec-fetch-site");
        if (site && site !== "same-origin" && site !== "same-site") {
          return Response.json({ ok: true, skipped: true });
        }
        const cd = customDataSchema.safeParse(payload.custom_data ?? {});
        let customData: Record<string, unknown> = cd.success ? cd.data : {};

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: store } = await supabaseAdmin
          .from("stores")
          .select("id, marketing")
          .eq("slug", payload.store_slug)
          .eq("status", "active")
          .maybeSingle();

        const marketing: any = (store as any)?.marketing ?? {};
        const t: any = marketing.tiktok ?? {};
        let pixelId = t.pixel_id as string | undefined;
        let token = t.access_token as string | undefined;
        let enabled = !!t.events_api_enabled;
        if (payload.landing_page_id) {
          const { readTrackingTargets } = await import("@/lib/marketing/marketing.server");
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

        // Purchase must belong to a real, recent order of this store; value comes from the order.
        if (payload.event === "Purchase") {
          const m = /^purchase-([0-9a-f-]{36})$/i.exec(payload.event_id);
          if (!m) return Response.json({ ok: true, skipped: true });
          const { data: order } = await supabaseAdmin
            .from("orders")
            .select("id, subtotal, created_at")
            .eq("id", m[1])
            .eq("store_id", (store as any).id)
            .maybeSingle();
          const age = order ? Date.now() - new Date((order as any).created_at).getTime() : Infinity;
          if (!order || age > 24 * 3600_000) return Response.json({ ok: true, skipped: true });
          customData = { ...customData, value: Number((order as any).subtotal) || 0, currency: "BDT" };
        }

        const { sendTiktokEvents, extractIp } = await import("@/lib/marketing/tiktok-events.server");
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
              properties: customData,
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
