// Orzen Call → store callback. Auth = per-store random token in the URL
// (?s=<store>&k=<token>), compared timing-safe.
// - event "call.completed": one call record per call_id (upsert), with transcript.
// - event "order.status_changed": only updates the order status (any current status), no call record.
// - legacy (no event): logs the call and moves pending orders to confirmed/cancelled.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  event: z.string().max(60).optional(),
  order_id: z.string().uuid().optional(),
  invoice_no: z.string().max(80).optional(),
  status: z.string().max(40).optional(),
  call_id: z.string().max(120).optional(),
  call_status: z.string().max(40).optional(),
  duration_sec: z.coerce.number().int().min(0).max(86400).optional(),
  duration_seconds: z.coerce.number().int().min(0).max(86400).optional(),
  transcript: z.array(z.object({ role: z.string().max(40), text: z.string().max(5000) }).passthrough()).max(500).optional(),
  conversation_text: z.string().max(100000).optional(),
  phone: z.string().max(40).optional(),
  customer_name: z.string().max(200).optional(),
  note: z.string().max(1000).optional(),
  summary: z.string().max(4000).optional(),
  recording_url: z.string().url().max(2000).optional(),
});

function mapFollowup(s: string | undefined): "no_response" | "on_hold" | null {
  const v = (s ?? "").toLowerCase().replace(/[\s-]/g, "_");
  if (["no_response", "no_answer", "unanswered", "not_answered", "busy", "missed", "unreachable", "switched_off"].includes(v)) return "no_response";
  if (["on_hold", "hold", "call_later", "callback", "later", "postponed"].includes(v)) return "on_hold";
  return null;
}

function mapStatus(s: string | undefined): "confirmed" | "cancelled" | "pending" | null {
  const v = (s ?? "").toLowerCase();
  if (["confirmed", "confirm", "verified", "yes"].includes(v)) return "confirmed";
  if (["cancelled", "canceled", "cancel", "rejected", "no"].includes(v)) return "cancelled";
  if (v === "pending") return "pending";
  return null;
}

function mapCallStatus(s: string | undefined, decided: boolean) {
  const v = (s ?? "").toLowerCase().replace(/[\s-]/g, "_");
  if (["no_answer", "unanswered", "noanswer", "not_answered"].includes(v)) return "no_answer";
  if (v === "busy") return "busy";
  if (v === "missed") return "missed";
  if (["failed", "error"].includes(v)) return "failed";
  void decided;
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

        const event = (body.event ?? "").toLowerCase();
        const findOrder = async () => {
          if (!body.order_id && !body.invoice_no) return null;
          let q = supabaseAdmin.from("orders").select("id,status,customer_name,phone").eq("store_id", store);
          q = body.order_id ? q.eq("id", body.order_id) : q.eq("invoice_no", body.invoice_no!);
          const { data } = await q.maybeSingle();
          return data as any;
        };
        const now = new Date().toISOString();

        // (2) Order status change only — no call record.
        if (event === "order.status_changed") {
          const follow = mapFollowup(body.status);
          if (follow) {
            const o = await findOrder();
            if (!o) return Response.json({ ok: false, error: "order not found" }, { status: 404 });
            if (o.status !== "pending") return Response.json({ ok: true, order_id: o.id, skipped: true, status: o.status });
            await supabaseAdmin.from("orders").update({ followup_status: follow, status_source: "ai_call" } as never).eq("id", o.id).eq("store_id", store).eq("status", "pending");
            return Response.json({ ok: true, order_id: o.id, status: follow });
          }
          const next = mapStatus(body.status);
          if (!next) return Response.json({ ok: false, error: "invalid status" }, { status: 400 });
          const o = await findOrder();
          if (!o) return Response.json({ ok: false, error: "order not found" }, { status: 404 });
          if (o.status === next) return Response.json({ ok: true, order_id: o.id, status: next, unchanged: true });
          const patch: Record<string, unknown> = { status: next, status_source: "ai_call" };
          if (next === "confirmed") patch.confirmed_at = now;
          const { error } = await supabaseAdmin.from("orders").update(patch as never).eq("id", o.id).eq("store_id", store);
          if (error) return Response.json({ ok: false, error: "update failed" }, { status: 500 });
          return Response.json({ ok: true, order_id: o.id, status: next });
        }

        // (1) Call completed / legacy: one record per call_id.
        const o = await findOrder();
        if (!o && event !== "call.completed") return Response.json({ ok: false, error: "order not found" }, { status: 404 });
        if (event === "call.completed" && !body.call_id) return Response.json({ ok: false, error: "call_id required" }, { status: 400 });
        const next = mapStatus(body.status);
        const decided = next === "confirmed" || next === "cancelled";
        const callStatus = mapCallStatus(body.call_status ?? (decided ? undefined : body.status), decided);
        const dur = body.duration_seconds ?? body.duration_sec ?? 0;
        const transcript = body.transcript?.map((m) => ({ role: m.role, text: m.text })) ?? null;
        const conversation = body.conversation_text ?? (transcript ? transcript.map((m) => `${m.role}: ${m.text}`).join("\n") : null);
        const callRow: Record<string, unknown> = {
          store_id: store,
          order_id: o?.id ?? null,
          customer_name: body.customer_name ?? o?.customer_name ?? null,
          phone: body.phone ?? o?.phone ?? "",
          provider: "orzen_call",
          provider_call_sid: body.call_id ? `orzen:${store}:${body.call_id}` : null,
          direction: "outbound",
          call_type: "ai",
          status: callStatus,
          result: next === "confirmed" ? "order_confirmed" : next === "cancelled" ? "order_cancelled" : callStatus === "completed" ? "other" : "unavailable",
          duration_sec: dur,
          note: body.note ?? body.summary ?? null,
          started_at: new Date(Date.now() - dur * 1000).toISOString(),
          ended_at: now,
        };
        if (transcript) callRow.transcript = transcript;
        if (conversation) callRow.conversation_text = conversation;
        // Only https recordings are kept; they are streamed later through a signed, store-scoped link.
        if (body.recording_url && /^https:\/\//i.test(body.recording_url)) callRow.recording_ref = body.recording_url;
        const { error: logErr } = callRow.provider_call_sid
          ? await supabaseAdmin.from("calls").upsert(callRow as never, { onConflict: "provider_call_sid" })
          : await supabaseAdmin.from("calls").insert(callRow as never);
        if (logErr) console.error("[orzen-call] log failed", logErr.message);

        if (o && !decided && o.status === "pending") {
          // Not reached / asked to call later → No Response / On Hold (never Confirmed without explicit consent).
          const follow = mapFollowup(body.status) ?? (callStatus !== "completed" ? "no_response" : null);
          if (follow) {
            await supabaseAdmin.from("orders").update({ followup_status: follow, status_source: "ai_call" } as never)
              .eq("id", o.id).eq("store_id", store).eq("status", "pending");
            return Response.json({ ok: true, logged: !logErr, order_id: o.id, status: follow });
          }
        }
        if (!o || !decided) return Response.json({ ok: true, logged: !logErr, order_id: o?.id ?? null, call_status: callStatus });
        if (o.status !== "pending") return Response.json({ ok: true, logged: !logErr, skipped: true, status: o.status });
        const patch: Record<string, unknown> = { status: next, status_source: "ai_call" };
        if (next === "confirmed") patch.confirmed_at = now;
        await supabaseAdmin.from("orders").update(patch as never).eq("id", o.id).eq("store_id", store).eq("status", "pending");
        return Response.json({ ok: true, logged: !logErr, order_id: o.id, status: next });
      },
    },
  },
});
