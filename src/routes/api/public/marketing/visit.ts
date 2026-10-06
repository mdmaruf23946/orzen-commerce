// Public, store-scoped beacon for platform-attributed visits & funnel events.
// Validates the store, rate-limits per IP, and only stamps an order's
// attribution when the order belongs to that store and has none yet.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  store_slug: z.string().min(1).max(120),
  visitor_id: z.string().min(8).max(80),
  session_id: z.string().min(8).max(80),
  platform: z.enum(["facebook", "google", "tiktok"]),
  campaign: z.string().max(200).nullable().optional(),
  click_id: z.string().max(500).nullable().optional(),
  path: z.string().max(500).nullable().optional(),
  referrer: z.string().max(500).nullable().optional(),
  event: z.enum(["page_view", "product_view", "add_to_cart", "checkout", "purchase"]),
  order_id: z.string().uuid().nullable().optional(),
  value: z.number().nonnegative().max(1e9).nullable().optional(),
});

export const Route = createFileRoute("/api/public/marketing/visit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let p: z.infer<typeof schema>;
        try {
          p = schema.parse(await request.json());
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const { checkRateLimit, clientIp } = await import("@/lib/rate-limit.server");
        const rl = await checkRateLimit("platform_meta", `mk:${clientIp(request)}`, { limit: 300 });
        if (!rl.allowed) return Response.json({ ok: false }, { status: 429 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        const { data: store } = await db.from("stores").select("id").eq("slug", p.store_slug).maybeSingle();
        if (!store?.id) return Response.json({ ok: false }, { status: 404 });

        const now = new Date().toISOString();
        const { data: existing } = await db
          .from("marketing_visits").select("id,platform").eq("store_id", store.id).eq("session_id", p.session_id).maybeSingle();
        if (!existing) {
          await db.from("marketing_visits").insert({
            store_id: store.id, visitor_id: p.visitor_id, session_id: p.session_id, platform: p.platform,
            campaign: p.campaign ?? null, click_id: p.click_id ?? null, landing_path: p.path ?? null, referrer: p.referrer ?? null,
          });
        } else {
          await db.from("marketing_visits").update({ last_seen_at: now }).eq("id", existing.id);
        }
        const platform = existing?.platform ?? p.platform;

        let orderId: string | null = null;
        if (p.event === "purchase" && p.order_id) {
          const { data: order } = await db
            .from("orders").select("id,attribution_platform").eq("id", p.order_id).eq("store_id", store.id).maybeSingle();
          if (order) {
            orderId = order.id;
            if (!order.attribution_platform) {
              await db.from("orders").update({
                attribution_platform: platform, attribution_campaign: p.campaign ?? null, attribution_session_id: p.session_id,
              }).eq("id", order.id).is("attribution_platform", null);
            }
          }
        }
        await db.from("marketing_events").insert({
          store_id: store.id, session_id: p.session_id, platform, event_type: p.event,
          path: p.path ?? null, order_id: orderId, value: p.value ?? null,
        });
        return Response.json({ ok: true });
      },
    },
  },
});
