// ePBX order-verification queue + webhook handling. Server-only.
import { createHmac, timingSafeEqual } from "node:crypto";
import { DEFAULT_VOICE_MESSAGES, DEFAULT_TTS_TEMPLATE, fillTemplate } from "./types";
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

export function recordingSig(callId: string, exp: number) {
  return createHmac("sha256", key()).update(`rec:${callId}:${exp}`).digest("hex").slice(0, 40);
}

/** Short-lived (2h) playable URL for a call recording; the audio is fetched server-side with the store's ePBX token. */
export function signedRecordingPath(callId: string) {
  const exp = Math.floor(Date.now() / 1000) + 7200;
  return `/api/public/voice/recording?c=${callId}&e=${exp}&k=${recordingSig(callId, exp)}`;
}

export function verifyRecordingSig(callId: string, exp: number, sig: string) {
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const a = Buffer.from(recordingSig(callId, exp));
  const b = Buffer.from(sig || "");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Signed (2h) URL to stream a provider call-log (CDR) recording for one store. */
export function signedCdrRecordingPath(storeId: string, cdrId: string) {
  const exp = Math.floor(Date.now() / 1000) + 7200;
  const k = createHmac("sha256", key()).update(`cdr:${storeId}:${cdrId}:${exp}`).digest("hex").slice(0, 40);
  return `/api/public/voice/cdr-recording?s=${storeId}&id=${encodeURIComponent(cdrId)}&e=${exp}&k=${k}`;
}

export function verifyCdrRecordingSig(storeId: string, cdrId: string, exp: number, sig: string) {
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const a = Buffer.from(createHmac("sha256", key()).update(`cdr:${storeId}:${cdrId}:${exp}`).digest("hex").slice(0, 40));
  const b = Buffer.from(sig || "");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyWebhookSig(callId: string, sig: string) {
  const a = Buffer.from(webhookSig(callId));
  const b = Buffer.from(sig || "");
  return a.length === b.length && timingSafeEqual(a, b);
}

function audioSig(path: string) {
  return createHmac("sha256", key()).update(`audio:${path}`).digest("hex").slice(0, 32);
}
/** Public, signed URL ePBX can fetch for an uploaded MP3 ("storage:<path>"); plain https links pass through. */
export function resolveAudioUrl(v: string | null | undefined) {
  if (!v) return undefined;
  if (v.startsWith("storage:")) {
    const path = v.slice(8);
    return `${platformOrigin()}/api/public/voice/audio?p=${encodeURIComponent(path)}&k=${audioSig(path)}`;
  }
  return /^https:\/\//i.test(v) ? v : undefined;
}
export function verifyAudioSig(path: string, sig: string) {
  const a = Buffer.from(audioSig(path));
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
      admin.from("orders").select("id,status,customer_name,phone,payment_method,invoice_no,subtotal,stores(name)").eq("id", job.order_id).eq("store_id", job.store_id).maybeSingle(),
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
    if (st.press2_action === "forward" && conn.default_extension) msgs.agent_extension = conn.default_extension;
    const vars = {
      customer_name: order.customer_name ?? "", store_name: (order as any).stores?.name ?? "",
      amount: String(Math.round(Number(order.subtotal ?? 0))), order_id: order.invoice_no ?? "",
    };
    msgs.custom_text = fillTemplate(st.tts_template || DEFAULT_TTS_TEMPLATE, vars);
    if (st.confirm_text) msgs.confirm_text = fillTemplate(st.confirm_text, vars);
    if (st.cancel_text) msgs.cancel_text = fillTemplate(st.cancel_text, vars);
    try {
      const r = await getVoiceProvider("epbx").makeOrderVerificationCall(creds, {
        to: phone, callerId: conn.default_caller_id ?? undefined, messages: msgs, vars,
        audio: { main: resolveAudioUrl(st.main_audio_url), confirm: resolveAudioUrl(st.confirm_audio_url), cancel: resolveAudioUrl(st.cancel_audio_url) },
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
    store_id: call.store_id, provider: "epbx", provider_event_id: `${call.id}:${ev.event_id}`, call_id: call.id,
    payload: body ?? {},
  });
  if (dupErr) return { ok: true, duplicate: true };

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  if (ev.dtmf) patch.dtmf = ev.dtmf;
  if (ev.duration_sec != null) patch.duration_sec = ev.duration_sec;
  if (ev.recording_ref) patch.recording_ref = ev.recording_ref;

  const { data: st } = await admin.from("voice_automation_settings")
    .select("retry_count,retry_delay_minutes,press2_action,sms_on_confirm,retry_on_no_answer,retry_on_no_keypress")
    .eq("store_id", call.store_id).maybeSingle();
  const isAuto = call.call_type === "auto_verification";
  const press2Forward = st?.press2_action === "forward";

  let orderStatus: "confirmed" | "cancelled" | null = null;
  let verification: "verified" | "cancelled" | "needs_agent" | "unanswered" | null = null;
  let retryable = false;
  let final = false;
  switch (ev.status) {
    case "confirmed": patch.status = "completed"; patch.result = "order_confirmed"; orderStatus = "confirmed"; verification = "verified"; final = true; break;
    case "cancelled":
      patch.status = "completed"; final = true;
      if (isAuto && press2Forward) { patch.result = "transferred"; verification = "needs_agent"; }
      else { patch.result = "order_cancelled"; orderStatus = "cancelled"; verification = "cancelled"; }
      break;
    case "busy": patch.status = "busy"; final = true; verification = "unanswered"; retryable = st?.retry_on_no_answer !== false; break;
    case "no_answer": patch.status = "no_answer"; final = true; verification = "unanswered"; retryable = st?.retry_on_no_answer !== false; break;
    case "no_response": patch.status = "no_answer"; patch.result = "no_keypress"; final = true; verification = "unanswered"; retryable = st?.retry_on_no_keypress !== false; break;
    case "answered": patch.status = "answered"; patch.answered_at = call.answered_at ?? now; break;
    case "ringing": patch.status = "ringing"; break;
    case "completed": case "hangup": case "ended":
      patch.status = "completed"; final = true;
      if (isAuto && !ev.dtmf) { verification = "unanswered"; retryable = st?.retry_on_no_keypress !== false; }
      break;
    case "failed": patch.status = "failed"; final = true; verification = "unanswered"; retryable = st?.retry_on_no_answer !== false; break;
  }
  if (final) patch.ended_at = now;
  if (Object.keys(patch).length) await admin.from("calls").update(patch).eq("id", call.id);

  if (call.order_id && isAuto && verification) {
    // Only while the order is still pending — a manual decision always wins.
    const upd: Record<string, unknown> = { voice_verification: verification };
    if (orderStatus) upd.status = orderStatus;
    const { data: changed } = await admin.from("orders").update(upd)
      .eq("id", call.order_id).eq("store_id", call.store_id).eq("status", "pending").select("id,phone,invoice_no,customer_name");
    const note =
      verification === "verified" ? "কাস্টমার ফোনে ১ চেপে অর্ডার নিশ্চিত করেছেন (AI Verified)" :
      verification === "cancelled" ? "কাস্টমার ফোনে ২ চেপে অর্ডার বাতিল করেছেন" :
      verification === "needs_agent" ? "কাস্টমার ২ চেপেছেন — কল এজেন্টের কাছে পাঠানো হয়েছে (Needs agent)" :
      `অটো কল: ${patch.status === "busy" ? "ব্যস্ত" : patch.result === "no_keypress" || patch.status === "completed" ? "কিছু চাপেননি" : "ফোন ধরেননি"}`;
    if (changed?.length) {
      await admin.from("order_timeline").insert({
        order_id: call.order_id, store_id: call.store_id, stage: orderStatus ?? "placed", note,
      }).then(() => null, () => null);
      if (verification === "verified" && st?.sms_on_confirm) {
        await sendConfirmSms(admin, call.store_id, changed[0]).catch(() => null);
      }
    }
  } else if (orderStatus && call.order_id) {
    await admin.from("orders").update({ status: orderStatus })
      .eq("id", call.order_id).eq("store_id", call.store_id).eq("status", "pending");
  }

  if (final && isAuto && call.order_id) {
    const { data: job } = await admin.from("voice_call_queue").select("id,attempt,status")
      .eq("order_id", call.order_id).maybeSingle();
    if (job && job.status === "calling") {
      if (!retryable) {
        await admin.from("voice_call_queue").update({ status: "done" }).eq("id", job.id);
      } else {
        await scheduleRetryOrFail(admin, job, st, String(patch.result ?? patch.status), call.id);
      }
    }
  }
  return { ok: true };
}

/** Optional confirmation SMS through the store's own SMS settings. Never throws. */
async function sendConfirmSms(admin: any, storeId: string, order: any) {
  try {
    const { loadSettings, readSecret } = await import("@/lib/notify-settings.server");
    const [{ data: row }, settings] = await Promise.all([
      admin.from("stores").select("name").eq("id", storeId).maybeSingle(),
      loadSettings(admin, storeId),
    ]);
    const sms: any = (settings as any)?.sms;
    if (!sms?.enabled || !sms.sender_id || !order?.phone) return;
    const apiKey = readSecret(sms.api_key_enc);
    if (!apiKey) return;
    const { sendSms } = await import("@/lib/notify/sms.server");
    await sendSms({ apiKey, senderId: sms.sender_id, to: order.phone,
      text: `${row?.name ?? ""}: আপনার অর্ডার ${order.invoice_no ?? ""} নিশ্চিত করা হয়েছে। ধন্যবাদ।` });
  } catch { /* ignore */ }
}
