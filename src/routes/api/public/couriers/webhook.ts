// Incoming courier status webhooks. Auth = per-store HMAC in the URL.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/couriers/webhook")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true }),
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const storeId = url.searchParams.get("s") ?? "";
        const sig = url.searchParams.get("k") ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(storeId)) return new Response("Bad request", { status: 400 });
        const { verifyCourierWebhookSig } = await import("@/lib/couriers/webhook-sign.server");
        if (!verifyCourierWebhookSig(storeId, sig)) return new Response("Unauthorized", { status: 401 });
        const text = (await request.text()).slice(0, 64_000);
        let body: any = {};
        try {
          body = JSON.parse(text);
        } catch {
          body = Object.fromEntries(new URLSearchParams(text));
        }
        const { parseCourierWebhook } = await import("@/lib/couriers/webhook-parse");
        const update = parseCourierWebhook(body);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { applyCourierUpdate } = await import("@/lib/courier-parcels.functions");
        try {
          const r = await applyCourierUpdate(supabaseAdmin, storeId, update, "webhook");
          return Response.json({ ok: true, matched: r.matched }, { status: 202 });
        } catch {
          return Response.json({ ok: false }, { status: 202 });
        }
      },
    },
  },
});
