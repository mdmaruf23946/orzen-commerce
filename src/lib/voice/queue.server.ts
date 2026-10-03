// ePBX order-verification queue + webhook handling. Server-only.
import { createHmac, timingSafeEqual } from "node:crypto";
import { DEFAULT_VOICE_MESSAGES } from "./types";
import { getVoiceProvider, openToken, friendlyVoiceError } from "./service.server";

function key() {
  const k = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!k) throw new Error("missing key");
  return k;
}

export function webhookSig(callId: string) {
  return createHmac("sha256", key()).update(`voice:${callId}`).digest("hex").slice(0, 40);
}

export function signedWebhookUrl(origin: string, callId: string) {
  return `${origin.replace(/\/$/, "")}/api/public/voice/epbx?c=${callId}&k=${webhookSig(callId)}`;
}

export function verifyWebhookSig(callId: string, sig: string) {
  const a = Buffer.from(webhookSig(callId));
  const b = Buffer.from(sig || "");
  return a.length === b.length && timingSafeEqual(a, b);
}

function platformOrigin() {
  return process.env.PLATFORM_ORIGIN || "https://orzen.top";
}

/** Minutes-of-day in Asia/Dhaka (UTC+6, no DST). */
function dhakaMinutes(d = new Date()) {
  return (d.getUTCHours() * 60 + d.getUTCMinutes() + 360) % 1440;
}
const toMin = (s: string) => { const [h, m] = s.split(":").map(Number); return (h || 0) * 60 + (m || 0); };

function minutesUntilOpen(from: string, to: string): number {
  const now = dhakaMinutes(), f = toMin(from), t = toMin(to);
  const open = f <= t ? now >= f && now < t : now >= f || now < t;
  if (open) return 0;
  return (f - now + 1440) % 1440 || 1440;
}

export async function drainVoiceQueue(admin: any, limit = 10) {
  const nowIso = new Date().toISOString();
  const { data: due } = await admin.from("voice_call_queue")
    .select("id,store_id,order_id,attempt").eq("status", "queued").lte("run_at", nowIso)
    .order("run_at").limit(limit);
  let placed = 0, skipped = 0, failed = 0;

  for (const job of due ?? []) {
    // claim
    const { data: claimed } = await admin.from("voice_call_queue")
      .update({ status: "processing" }).eq("id", job.id).eq("status", "queued").select("id");
    if (!claimed?.length) continue;

    const done = (status: string, extra: Record<string, unknown> = {}) =>
      admin.from("voice_call_queue").update({ status, ...extra }).eq("id", job.id);

    const [{ data: order }, { data: conn }, { data: st }] = await Promise.all([
      admin.from("orders").select("id,status,customer_name,phone,payment_method").eq("id", job.order_id).eq("store_id", job.store_id).maybeSingle(),
      admin.from("voice_provider_connections").select("id,encrypted_token,status,default_caller_id,default_extension").eq("store_id", job.store_id).eq("provider", "epbx").maybeSingle(),
      admin.from("voice_automation_settings").select("*").eq("store_id", job.store_id).maybeSingle(),
    ]);

    if (!order || order.status !== "pending" || !st?.auto_call_enabled) { await done("skipped"); skipped++; continue; }
    const creds = conn?.status === "connected" ? openToken(conn.encrypted_token) : null;
    if (!creds) { await done("skipped", { last_error: "not_connected" }); skipped++; continue; }

    if (st.business_hours_only) {
      const wait = minutesUntilOpen(st.hours_from, st.hours_to);
      if (wait > 0) {
        await done("queued", { run_at: new Date(Date.now() + wait * 60000).toISOString() });
        continue;
      }
    }

    const phone = order.phone;
    const { data: call } = await admin.from("calls").insert({
      store_id: job.store_id, order_id: order.id, customer_name: order.customer_name, phone,
      provider: "epbx", connection_id: conn.id, call_type: "auto_verification",
      status: "calling", retry_count: job.attempt, direction: "outbound",
    }).select("id").single();
    if (!call) { await done("failed", { last_error: "call_insert_failed" }); failed++; continue; }

    const msgs = { ...DEFAULT_VOICE_MESSAGES, ...(st.messages ?? {}) } as Record<string, string>;
    if (st.representative_transfer && conn.default_extension) msgs.agent_extension = conn.default_extension;
    try {
      const r = await getVoiceProvider("epbx").makeOrderVerificationCall(creds, {
        to: phone, callerId: conn.default_caller_id ?? undefined, messages: msgs,
        webhookUrl: signedWebhookUrl(platformOrigin(), call.id),
      });
      await admin.from("calls").update({ provider_call_sid: r.provider_call_id }).eq("id", call.id);
      await done("calling", { call_id: call.id, last_error: null });
      placed++;
    } catch (e) {
      const msg = friendlyVoiceError(e);
      await admin.from("calls").update({ status: "failed", ended_at: new Date().toISOString(), note: msg }).eq("id", call.id);
      await scheduleRetryOrFail(admin, job, st, msg, call.id);
      failed++;
    }
  }
  return { placed, skipped, failed };
}

async function scheduleRetryOrFail(admin: any, job: any, st: any, err: string, callId: string | null) {
  if (job.attempt < (st?.retry_count ?? 0)) {
    await admin.from("voice_call_queue").update({
      status: "queued", attempt: job.attempt + 1, call_id: callId, last_error: err,
      run_at: new Date(Date.now() + (st.retry_delay_minutes ?? 30) * 60000).toISOString(),
    }).eq("id", job.id);
  } else {
    await admin.from("voice_call_queue").update({ status: "failed", call_id: callId, last_error: err }).eq("id", job.id);
  }
}

/** Handle one verified ePBX callback for our call row. */
export async function handleEpbxWebhook(admin: any, callId: string, body: any) {
  const { data: call } = await admin.from("calls")
    .select("id,store_id,order_id,call_type,status,started_at,answered_at").eq("id", callId).maybeSingle();
  if (!call) return { ok: false, reason: "unknown_call" };

  const ev = getVoiceProvider("epbx").parseWebhook(body);
  if (!ev) return { ok: false, reason: "bad_payload" };

  const { error: dupErr } = await admin.from("voice_call_events").insert({
    store_id: call.store_id, provider: "epbx", provider_event_id: ev.event_id, call_id: call.id,
    payload: body ?? {},
  });
  if (dupErr) return { ok: true, duplicate: true };

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  if (ev.dtmf) patch.dtmf = ev.dtmf;
  if (ev.duration_sec != null) patch.duration_sec = ev.duration_sec;
  if (ev.recording_ref) patch.recording_ref = ev.recording_ref;

  let orderStatus: "confirmed" | "cancelled" | null = null;
  let final = false;
  switch (ev.status) {
    case "confirmed": patch.status = "completed"; patch.result = "order_confirmed"; orderStatus = "confirmed"; final = true; break;
    case "cancelled": patch.status = "completed"; patch.result = "order_cancelled"; orderStatus = "cancelled"; final = true; break;
    case "busy": patch.status = "busy"; final = true; break;
    case "no_answer": case "no_response": patch.status = "no_answer"; final = true; break;
    case "answered": patch.status = "answered"; patch.answered_at = call.answered_at ?? now; break;
    case "ringing": patch.status = "ringing"; break;
    case "completed": case "hangup": case "ended": patch.status = "completed"; final = true; break;
    case "failed": patch.status = "failed"; final = true; break;
  }
  if (final) patch.ended_at = now;
  if (Object.keys(patch).length) await admin.from("calls").update(patch).eq("id", call.id);

  if (orderStatus && call.order_id) {
    await admin.from("orders").update({ status: orderStatus })
      .eq("id", call.order_id).eq("store_id", call.store_id).eq("status", "pending");
  }

  if (final && call.call_type === "auto_verification" && call.order_id) {
    const { data: job } = await admin.from("voice_call_queue").select("id,attempt,status")
      .eq("order_id", call.order_id).maybeSingle();
    if (job && job.status === "calling") {
      if (orderStatus || patch.status === "completed") {
        await admin.from("voice_call_queue").update({ status: "done" }).eq("id", job.id);
      } else {
        const { data: st } = await admin.from("voice_automation_settings")
          .select("retry_count,retry_delay_minutes").eq("store_id", call.store_id).maybeSingle();
        await scheduleRetryOrFail(admin, job, st, String(patch.status), call.id);
      }
    }
  }
  return { ok: true };
}
