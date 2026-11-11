// Browser -> server bridge for Meta Conversion API.
// Public route: verifies input, loads the store's marketing config with the
// service-role client (needed to read fb_capi_token), and forwards to Graph.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sendFbEvents, extractClientIp, type FbEventInput } from "@/lib/marketing/fb-capi.server";

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
    contents: z.array(z.object({
      id: z.string().max(120).optional().nullable(),
      quantity: z.number().int().min(0).max(10000).optional(),
      item_price: z.number().finite().nonnegative().max(10_000_000).optional(),
    }).passthrough().transform((c) => ({ id: c.id ?? undefined, quantity: c.quantity, item_price: c.item_price }))).max(50).optional(),
    num_items: z.number().int().min(0).max(10000).optional(),
    search_string: z.string().max(200).optional(),
    order_id: z.string().max(120).optional(),
    transaction_id: z.string().max(120).optional(),
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
        const { checkRateLimit, clientIp } = await import("@/lib/security/rate-limit.server");
        const rl = await checkRateLimit("platform_meta", `fbcapi:${clientIp(request)}`);
        if (!rl.allowed) return Response.json({ ok: true, skipped: true });
        let payload: z.infer<typeof bodySchema>;
        try {
          payload = bodySchema.parse(await request.json());
        } catch (e) {
          return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });
        }
        if (!ALLOWED_EVENTS.has(payload.event)) return Response.json({ ok: true, skipped: true });
        const cd = customDataSchema.safeParse(payload.custom_data ?? {});
        let customData: Record<string, unknown> = cd.success ? cd.data : {};

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
          const { readTrackingTargets } = await import("@/lib/marketing/marketing.server");
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

        // Purchase must belong to a real, recent order of this store; value comes from the order.
        if (payload.event === "Purchase") {
          const m2 = /^purchase-([0-9a-f-]{36})$/i.exec(payload.event_id);
          if (!m2) return Response.json({ ok: true, skipped: true });
          const { data: order } = await supabaseAdmin
            .from("orders")
            .select("id, subtotal, created_at")
            .eq("id", m2[1])
            .eq("store_id", (store as any).id)
            .maybeSingle();
          const age = order ? Date.now() - new Date((order as any).created_at).getTime() : Infinity;
          if (!order || age > 24 * 3600_000) return Response.json({ ok: true, skipped: true });
          customData = { ...customData, value: Number((order as any).subtotal) || 0, currency: "BDT", order_id: (order as any).id };
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
          custom_data: customData,
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
