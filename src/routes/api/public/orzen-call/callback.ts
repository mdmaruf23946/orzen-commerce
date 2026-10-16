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
  address: z.string().max(500).optional(),
  area: z.string().max(120).optional(),
  delivery_charge: z.coerce.number().min(0).max(100000).optional(),
  items: z.array(z.object({
    product_id: z.string().uuid().optional(),
    sku: z.string().max(80).optional(),
    name: z.string().max(200).optional(),
    qty: z.coerce.number().int().min(1).max(100).default(1),
  })).max(20).optional(),

});

function mapFollowup(s: string | undefined): "no_response" | "on_hold" | null {
  const v = (s ?? "").toLowerCase().replace(/[\s-]/g, "_");
  if (["no_response", "no_answer", "unanswered", "not_answered", "busy", "missed", "unreachable", "switched_off"].includes(v)) return "no_response";
  if (["on_hold", "hold", "call_later", "callback", "later", "postponed"].includes(v)) return "on_hold";
  return null;
}

function mapStatus(s: string | undefined): "confirmed" | "cancelled" | "pending" | null {
  const v = (s ?? "").toLowerCase().trim().replace(/[\s-]/g, "_");
  if (["confirmed", "confirm", "verified", "yes", "order_confirmed", "কনফার্মড", "কনফার্ম", "নিশ্চিত"].includes(v)) return "confirmed";
  if (["cancelled", "canceled", "cancel", "rejected", "no", "order_cancelled", "বাতিল"].includes(v)) return "cancelled";
  if (["pending", "পেন্ডিং"].includes(v)) return "pending";
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
        const key = url.searchParams.get("k") || request.headers.get("x-orzen-secret") || "";
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
          .select("encrypted_token,status,account_info")
          .eq("store_id", store)
          .eq("provider", "orzen_call")
          .maybeSingle();
        const token = (conn as any)?.encrypted_token as string | undefined;
        const { timingSafeEqual } = await import("node:crypto");
        const ok = !!token && (conn as any).status === "connected" && token.length === key.length &&
          timingSafeEqual(Buffer.from(token), Buffer.from(key));
        if (!ok) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

        const now = new Date().toISOString();
        const event = (body.event ?? "").toLowerCase();
        // Merchant's call-outcome mapping (Orzen Call settings).
        const om = ((conn as any)?.account_info?.outcome_map ?? {}) as Record<string, string>;
        const applyOutcome = async (o: { id: string; status: string }, next: "confirmed" | "cancelled") => {
          if (next === "cancelled" && om.cancel === "on_hold") {
            if (o.status !== "pending") return { error: null, status: o.status };
            const { error } = await supabaseAdmin.from("orders").update({ followup_status: "on_hold", status_source: "ai_call" } as never).eq("id", o.id).eq("store_id", store);
            return { error, status: "on_hold" };
          }
          const patch: Record<string, unknown> = { status: next, status_source: "ai_call" };
          if (next === "confirmed") patch.confirmed_at = now;
          const { error } = await supabaseAdmin.from("orders").update(patch as never).eq("id", o.id).eq("store_id", store);
          if (!error && next === "confirmed" && om.confirm === "processing") {
            const r2 = await supabaseAdmin.from("orders").update({ status: "processing", status_source: "ai_call" } as never).eq("id", o.id).eq("store_id", store);
            return { error: r2.error, status: "processing" };
          }
          return { error, status: next };
        };
        const mapNoAnswer = (f: "no_response" | "on_hold" | null) =>
          f === "no_response" ? (om.no_answer === "none" ? null : om.no_answer === "on_hold" ? "on_hold" : "no_response") : f;
        const findOrder = async () => {
          const sel = "id,status,customer_name,phone";
          if (body.order_id || body.invoice_no) {
            let q = supabaseAdmin.from("orders").select(sel).eq("store_id", store);
            q = body.order_id ? q.eq("id", body.order_id) : q.eq("invoice_no", body.invoice_no!);
            const { data } = await q.maybeSingle();
            if (data) return data as any;
          }
          // Fallback: latest order of this phone (prefer pending).
          const digits = (body.phone ?? "").replace(/\D/g, "");
          if (digits.length >= 10) {
            const { data: rows } = await supabaseAdmin.from("orders").select(sel).eq("store_id", store)
              .ilike("phone", `%${digits.slice(-10)}`).order("created_at", { ascending: false }).limit(5);
            if (rows?.length) return ((rows as any[]).find((r) => r.status === "pending") ?? rows[0]) as any;
          }
          return null;
        };

        // (1) New order placed over the phone by the AI agent.
        if (event === "order.created" || event === "order.new") {
          const name = (body.customer_name ?? "").trim();
          const phone = (body.phone ?? "").replace(/[^\d+]/g, "");
          const address = (body.address ?? "").trim();
          const items = body.items ?? [];
          if (!name || phone.length < 10 || address.length < 3 || !items.length)
            return Response.json({ ok: false, error: "customer_name, phone, address and items are required" }, { status: 400 });
          // Resolve each item to a store product (id, sku, or name).
          const resolved: { product_id: string; name: string; price: number; qty: number }[] = [];
          for (const it of items) {
            let q = supabaseAdmin.from("products").select("id,name,price,status").eq("store_id", store);
            if (it.product_id) q = q.eq("id", it.product_id);
            else if (it.sku) q = q.eq("sku", it.sku);
            else if (it.name) q = q.ilike("name", `%${it.name.replace(/[%_]/g, "")}%`);
            else return Response.json({ ok: false, error: "item needs product_id, sku or name" }, { status: 400 });
            const { data: rows } = await q.limit(1);
            const p = (rows ?? [])[0] as any;
            if (!p) return Response.json({ ok: false, error: `product not found: ${it.product_id ?? it.sku ?? it.name}` }, { status: 404 });
            const price = Number(p.price) || 0;
            resolved.push({ product_id: p.id, name: p.name, price, qty: it.qty });
          }
          const itemsTotal = resolved.reduce((a, r) => a + r.price * r.qty, 0);
          const delivery = Number(body.delivery_charge ?? 0) || 0;
          const idem = `orzen-call:${body.call_id ?? `${phone}:${resolved.map((r) => `${r.product_id}x${r.qty}`).join(",")}`}`.padEnd(16, "0");
          const { data: r, error } = await supabaseAdmin.rpc("create_chat_order" as any, {
            _store_id: store,
            _idem_key: idem,
            _order: {
              customer_name: name, phone, address, area: body.area ?? "",
              payment_method: "cod", subtotal: itemsTotal + delivery, delivery_amount: delivery,
              discount_amount: 0, notes: ["Phone order (AI call)", body.note].filter(Boolean).join(" • "),
            },
            _items: resolved,
          } as any);
          if (error) {
            const out = /out_of_stock/.test(error.message);
            return Response.json({ ok: false, error: out ? "out of stock" : "could not create order" }, { status: out ? 409 : 500 });
          }
          const res = r as any;
          if (!res.existing) {
            await supabaseAdmin.from("orders").update({ source: "phone_call", status_source: "ai_call" } as never).eq("id", res.id);
            if (body.call_id) {
              await supabaseAdmin.from("calls").update({ order_id: res.id } as never)
                .eq("provider_call_sid", `orzen:${store}:${body.call_id}`);
            }
          }
          return Response.json({ ok: true, order_id: res.id, invoice_no: res.invoice_no, total: itemsTotal + delivery, duplicate: !!res.existing });
        }

        // (2) Order status change only — no call record.

        if (event === "order.status_changed") {
          const st = body.status ?? body.call_status;
          const follow = mapNoAnswer(mapFollowup(st));
          if (mapFollowup(st) && !follow) return Response.json({ ok: true, skipped: true });
          if (follow) {
            const o = await findOrder();
            if (!o) return Response.json({ ok: false, error: "order not found" }, { status: 404 });
            if (o.status !== "pending") return Response.json({ ok: true, order_id: o.id, skipped: true, status: o.status });
            await supabaseAdmin.from("orders").update({ followup_status: follow, status_source: "ai_call" } as never).eq("id", o.id).eq("store_id", store).eq("status", "pending");
            return Response.json({ ok: true, order_id: o.id, status: follow });
          }
          const next = mapStatus(st);
          if (!next) return Response.json({ ok: false, error: "invalid status" }, { status: 400 });
          const o = await findOrder();
          if (!o) return Response.json({ ok: false, error: "order not found" }, { status: 404 });
          if (o.status === next) return Response.json({ ok: true, order_id: o.id, status: next, unchanged: true });
          if (next === "pending") {
            const { error } = await supabaseAdmin.from("orders").update({ status: "pending", status_source: "ai_call" } as never).eq("id", o.id).eq("store_id", store);
            if (error) return Response.json({ ok: false, error: "update failed" }, { status: 500 });
            return Response.json({ ok: true, order_id: o.id, status: next });
          }
          const res = await applyOutcome(o, next);
          if (res.error) return Response.json({ ok: false, error: "update failed" }, { status: 500 });
          // Status-only change: no call happened, so no call record is created.
          return Response.json({ ok: true, order_id: o.id, status: res.status });
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
        const { data: saved, error: logErr } = callRow.provider_call_sid
          ? await supabaseAdmin.from("calls").upsert(callRow as never, { onConflict: "provider_call_sid" }).select("id").maybeSingle()
          : await supabaseAdmin.from("calls").insert(callRow as never).select("id").maybeSingle();
        if (logErr) console.error("[orzen-call] log failed", logErr.message);
        // Keep a permanent private copy so the recording survives even if the provider deletes it.
        if (saved && callRow.recording_ref) {
          try {
            const res = await fetch(String(callRow.recording_ref), { headers: { "User-Agent": "ORZEN-Recording/1.0" } });
            if (res.ok) {
              const buf = await res.arrayBuffer();
              if (buf.byteLength > 0 && buf.byteLength <= 50 * 1024 * 1024) {
                const path = `${store}/${(saved as any).id}.mp3`;
                const { error: upErr } = await supabaseAdmin.storage.from("call-recordings")
                  .upload(path, buf, { contentType: res.headers.get("content-type") || "audio/mpeg", upsert: true });
                if (!upErr) await supabaseAdmin.from("calls").update({ recording_ref: `storage:${path}` } as never).eq("id", (saved as any).id);
              }
            }
          } catch (e) { console.error("[orzen-call] archive failed", (e as Error).message); }
        }

        if (o && !decided && o.status === "pending") {
          // Not reached / asked to call later → No Response / On Hold (never Confirmed without explicit consent).
          const follow = mapNoAnswer(mapFollowup(body.status) ?? (callStatus !== "completed" ? "no_response" : null));
          if (follow) {
            await supabaseAdmin.from("orders").update({ followup_status: follow, status_source: "ai_call" } as never)
              .eq("id", o.id).eq("store_id", store).eq("status", "pending");
            return Response.json({ ok: true, logged: !logErr, order_id: o.id, status: follow });
          }
        }
        if (!o || !decided) return Response.json({ ok: true, logged: !logErr, order_id: o?.id ?? null, call_status: callStatus });
        if (o.status !== "pending") return Response.json({ ok: true, logged: !logErr, skipped: true, status: o.status });
        const res = await applyOutcome(o, next as "confirmed" | "cancelled");
        return Response.json({ ok: true, logged: !logErr, order_id: o.id, status: res.status });
      },
    },
  },
});
