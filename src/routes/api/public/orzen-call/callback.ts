// Orzen Call → store callback. Auth = per-store random token in the URL
// (?s=<store>&k=<token>), compared timing-safe. Every callback is logged in the
// store's call history (provider=orzen_call); only pending orders of that
// store can be moved to confirmed/cancelled.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  order_id: z.string().uuid().optional(),
  invoice_no: z.string().max(80).optional(),
  status: z.string().max(40),
  call_id: z.string().max(120).optional(),
  call_status: z.string().max(40).optional(),
  duration_sec: z.coerce.number().int().min(0).max(86400).optional(),
  phone: z.string().max(40).optional(),
  customer_name: z.string().max(200).optional(),
  note: z.string().max(1000).optional(),
});

function mapStatus(s: string): "confirmed" | "cancelled" | null {
  const v = s.toLowerCase();
  if (["confirmed", "confirm", "verified", "yes"].includes(v)) return "confirmed";
  if (["cancelled", "canceled", "cancel", "rejected", "no"].includes(v)) return "cancelled";
  return null;
}

function mapCallStatus(s: string | undefined, decided: boolean) {
  const v = (s ?? "").toLowerCase().replace(/[\s-]/g, "_");
  if (["no_answer", "unanswered", "noanswer", "not_answered"].includes(v)) return "no_answer";
  if (["busy"].includes(v)) return "busy";
  if (["missed"].includes(v)) return "missed";
  if (["failed", "error"].includes(v)) return "failed";
  if (["answered", "completed", "done", "success"].includes(v) || decided) return "completed";
  return "completed";
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

        let q = supabaseAdmin.from("orders").select("id,status,customer_name,phone").eq("store_id", store);
        q = body.order_id ? q.eq("id", body.order_id) : q.eq("invoice_no", body.invoice_no!);
        const { data: order } = await q.maybeSingle();
        if (!order) return Response.json({ ok: false, error: "order not found" }, { status: 404 });
        const o = order as any;

        const next = mapStatus(body.status);
        const callStatus = mapCallStatus(body.call_status ?? (next ? undefined : body.status), !!next);
        const now = new Date().toISOString();
        const dur = body.duration_sec ?? 0;
        const callRow = {
          store_id: store,
          order_id: o.id,
          customer_name: body.customer_name ?? o.customer_name ?? null,
          phone: body.phone ?? o.phone ?? "",
          provider: "orzen_call",
          provider_call_sid: body.call_id ? `orzen:${store}:${body.call_id}` : null,
          direction: "outbound",
          call_type: "ai",
          status: callStatus,
          result: next === "confirmed" ? "order_confirmed" : next === "cancelled" ? "order_cancelled" : callStatus === "completed" ? "other" : "unavailable",
          duration_sec: dur,
          note: body.note ?? null,
          started_at: new Date(Date.now() - dur * 1000).toISOString(),
          ended_at: now,
        };
        try {
          if (callRow.provider_call_sid) {
            await supabaseAdmin.from("calls").upsert(callRow as never, { onConflict: "provider_call_sid" });
          } else {
            await supabaseAdmin.from("calls").insert(callRow as never);
          }
        } catch (e) {
          console.error("[orzen-call] log failed", (e as Error).message);
        }

        if (!next) return Response.json({ ok: true, logged: true, order_id: o.id, call_status: callStatus });
        if (o.status !== "pending") return Response.json({ ok: true, skipped: true, status: o.status });

        const patch: Record<string, unknown> = { status: next };
        if (next === "confirmed") patch.confirmed_at = now;
        await supabaseAdmin.from("orders").update(patch as never).eq("id", o.id).eq("store_id", store).eq("status", "pending");
        return Response.json({ ok: true, order_id: o.id, status: next });
      },
    },
  },
});
