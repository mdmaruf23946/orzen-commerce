import { z } from "zod";
import { authStore, json, unauthorized } from "@/lib/call-sync.server";

const Body = z.object({
  status: z.string().trim().min(1).max(40),
  note: z.string().max(2000).optional(),
  summary: z.string().max(4000).optional(),
});

function normalize(s: string) {
  const v = s.toLowerCase().replace(/[\s-]/g, "_");
  if (["confirmed", "confirm", "verified"].includes(v)) return { status: "confirmed" as const };
  if (["cancelled", "canceled", "cancel", "rejected"].includes(v)) return { status: "cancelled" as const };
  if (["processing"].includes(v)) return { status: "processing" as const };
  if (["on_hold", "hold", "call_later", "callback"].includes(v)) return { followup: "on_hold" as const };
  if (["no_response", "no_answer", "unreachable", "busy", "missed"].includes(v)) return { followup: "no_response" as const };
  return null;
}

/** Shared by PATCH /orders/:id and POST /orders/:id/status. */
export async function updateOrderStatus(request: Request, id: string) {
  const auth = await authStore(request);
  if (!auth) return unauthorized();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: "invalid order id" }, 400);
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await request.json()); } catch { return json({ ok: false, error: "invalid body" }, 400); }
  const target = normalize(body.status);
  if (!target) return json({ ok: false, error: "unsupported status" }, 400);

  const { storeId, supabaseAdmin } = auth;
  const { data: order } = await supabaseAdmin.from("orders").select("id,status").eq("id", id).eq("store_id", storeId).maybeSingle();
  if (!order) return json({ ok: false, error: "order not found" }, 404);

  const now = new Date().toISOString();
  let patch: Record<string, unknown>;
  if ("followup" in target) {
    if ((order as any).status !== "pending") return json({ ok: false, error: "follow-up status only allowed on pending orders" }, 409);
    patch = { followup_status: target.followup, status_source: "ai_call" };
  } else {
    if ((order as any).status === target.status) return json({ ok: true, order_id: id, status: target.status, updated_at: now, unchanged: true });
    patch = { status: target.status, status_source: "ai_call", ...(target.status === "confirmed" ? { confirmed_at: now } : {}) };
  }
  const { error } = await supabaseAdmin.from("orders").update(patch as never).eq("id", id).eq("store_id", storeId);
  if (error) return json({ ok: false, error: "status change not allowed for this order" }, 409);

  const text = [body.summary, body.note].filter(Boolean).join("\n").slice(0, 4000);
  if (text) {
    await supabaseAdmin.from("order_timeline").insert({
      order_id: id, store_id: storeId,
      stage: (target as any).status === "cancelled" ? "cancelled" : (target as any).status === "confirmed" ? "confirmed" : "placed",
      note: `Orzen Call: ${text}`,
    } as never);
  }
  return json({ ok: true, order_id: id, status: (target as any).status ?? (target as any).followup, updated_at: now });
}
