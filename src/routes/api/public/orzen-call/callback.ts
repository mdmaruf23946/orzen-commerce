// Orzen Call → store callback. Auth = per-store random token in the URL
// (?s=<store>&k=<token>), compared timing-safe. Only pending orders of that
// store can be moved to confirmed/cancelled.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  order_id: z.string().uuid().optional(),
  invoice_no: z.string().max(80).optional(),
  status: z.string().max(40),
  note: z.string().max(1000).optional(),
});

function mapStatus(s: string): "confirmed" | "cancelled" | null {
  const v = s.toLowerCase();
  if (["confirmed", "confirm", "verified", "yes"].includes(v)) return "confirmed";
  if (["cancelled", "canceled", "cancel", "rejected", "no"].includes(v)) return "cancelled";
  return null;
}

export const Route = createFileRoute("/api/public/orzen-call/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const store = url.searchParams.get("s") ?? "";
        const key = url.searchParams.get("k") ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(store) || key.length < 16) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        let body: z.infer<typeof Body>;
        try {
          body = Body.parse(await request.json());
        } catch {
          return Response.json({ ok: false, error: "invalid body" }, { status: 400 });
        }
        if (!body.order_id && !body.invoice_no) return Response.json({ ok: false, error: "order_id or invoice_no required" }, { status: 400 });
        const next = mapStatus(body.status);
        if (!next) return Response.json({ ok: false, error: "status must be confirmed or cancelled" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: conn } = await supabaseAdmin
          .from("voice_provider_connections")
          .select("encrypted_token,status")
          .eq("store_id", store)
          .eq("provider", "orzen_call")
          .maybeSingle();
        const token = (conn as any)?.encrypted_token as string | undefined;
        const { timingSafeEqual } = await import("node:crypto");
        const ok = !!token && (conn as any).status === "connected" && token.length === key.length &&
          timingSafeEqual(Buffer.from(token), Buffer.from(key));
        if (!ok) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

        let q = supabaseAdmin.from("orders").select("id,status").eq("store_id", store);
        q = body.order_id ? q.eq("id", body.order_id) : q.eq("invoice_no", body.invoice_no!);
        const { data: order } = await q.maybeSingle();
        if (!order) return Response.json({ ok: false, error: "order not found" }, { status: 404 });
        if ((order as any).status !== "pending") return Response.json({ ok: true, skipped: true, status: (order as any).status });

        const patch: Record<string, unknown> = { status: next };
        if (next === "confirmed") patch.confirmed_at = new Date().toISOString();
        await supabaseAdmin.from("orders").update(patch as never).eq("id", (order as any).id).eq("store_id", store).eq("status", "pending");
        return Response.json({ ok: true, order_id: (order as any).id, status: next });
      },
    },
  },
});
