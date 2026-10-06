// ePBX adapter — https://epbx.bd/docs/api (REST v1, Bearer token, 120 req/min).
import { VoiceProviderError, type VoiceCdrRow, type VoiceCreds, type VoiceProvider } from "./types";

export const EPBX_DEFAULT_BASE = "https://epbx.bd/api/v1";
const baseOf = (c?: VoiceCreds) => (c?.base_url || EPBX_DEFAULT_BASE).replace(/\/+$/, "");

function normPhone(p: string): string {
  let d = (p || "").replace(/\D/g, "");
  if (d.startsWith("880")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("1")) d = "0" + d;
  if (!/^01\d{9}$/.test(d)) throw new VoiceProviderError("invalid_phone", "The customer phone number is not valid.");
  return d;
}

async function call(creds: VoiceCreds, path: string, init: { method?: string; body?: unknown } = {}) {
  let res: Response;
  try {
    res = await fetch(baseOf(creds) + path, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${creds.api_token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new VoiceProviderError("unavailable", "ePBX is not reachable right now. Please try again later.");
  }
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  if (res.status === 401 || res.status === 403) throw new VoiceProviderError("invalid_token", "Invalid ePBX API token.");
  if (res.status === 429) throw new VoiceProviderError("rate_limited", "ePBX rate limit reached.");
  if (res.status === 402) throw new VoiceProviderError("insufficient_balance", "Insufficient ePBX balance.");
  const msg = String(json?.message ?? json?.error ?? "").toLowerCase();
  if (!res.ok || json?.status === "error" || json?.success === false) {
    if (msg.includes("balance")) throw new VoiceProviderError("insufficient_balance", "Insufficient ePBX balance.");
    if (msg.includes("phone") || msg.includes("number")) throw new VoiceProviderError("invalid_phone", "The customer phone number is not valid.");
    if (msg.includes("token") || msg.includes("unauth")) throw new VoiceProviderError("invalid_token", "Invalid ePBX API token.");
    console.error("[epbx]", path, res.status, text.slice(0, 200));
    throw new VoiceProviderError("failed", "ePBX could not complete the request. Please try again.");
  }
  if (!json) throw new VoiceProviderError("failed", "ePBX returned an unexpected response.");
  return json;
}

function callIdOf(j: any): string {
  const id = j?.call_id ?? j?.data?.call_id ?? j?.uniqueid ?? j?.data?.uniqueid ?? j?.id ?? j?.data?.id;
  if (!id) throw new VoiceProviderError("failed", "ePBX accepted the call but returned no call id.");
  return String(id);
}

export const epbxProvider: VoiceProvider = {
  id: "epbx",
  label: "ePBX",
  ready: true,
  // Per https://epbx.bd/docs/api: no endpoints for listing numbers, extensions, IVR or WebRTC/SIP credentials.
  capabilities: {
    click_to_call: true, order_verification: true, call_history: true, recordings: true,
    numbers_list: false, extensions_list: false, ivr: false, webrtc: false,
  },
  async getOverview(creds) {
    const g = await call(creds, "/balance/global");
    let ip: any = null;
    try { ip = await call(creds, "/balance/ip"); } catch { /* trunk optional */ }
    return {
      tenant: g.tenant ?? undefined,
      balance: g.balance == null ? null : Number(g.balance),
      currency: g.currency ?? "BDT",
      trunk_number: ip?.trunk ? String(ip.trunk) : null,
      trunk_balance: ip?.balance == null ? null : Number(ip.balance),
    };
  },
  async getCallHistory(creds, f) {
    const q = new URLSearchParams({ page: String(f.page), per_page: String(f.per_page) });
    for (const k of ["start_date", "end_date", "phone_number", "extension", "disposition"] as const) {
      if (f[k]) q.set(k, String(f[k]));
    }
    const j = await call(creds, `/calls/history?${q}`);
    const isExt = (v: string) => /^\d{2,6}$/.test(v);
    const rows: VoiceCdrRow[] = (Array.isArray(j.data) ? j.data : []).map((r: any) => {
      const src = String(r.source ?? ""), dst = String(r.destination ?? "");
      return {
        id: String(r.call_id ?? r.uniqueid ?? ""),
        date: String(r.date ?? ""),
        source: src, destination: dst, caller_id: String(r.caller_id ?? ""),
        direction: isExt(src) && isExt(dst) ? "internal" : isExt(src) ? "outgoing" : "incoming",
        disposition: String(r.disposition ?? "").toUpperCase(),
        duration_sec: Number(r.duration_seconds ?? 0) || 0,
        billable_sec: Number(r.billable_seconds ?? 0) || 0,
        has_recording: !!r.has_recording,
      };
    }).filter((r: VoiceCdrRow) => r.id);
    const p = j.pagination ?? {};
    return { rows, page: Number(p.current_page ?? f.page), last_page: Number(p.last_page ?? 1), total: Number(p.total ?? rows.length) };
  },
  recordingUrl(id, creds) {
    return `${baseOf(creds)}/calls/recordings/${encodeURIComponent(id)}`;
  },
  async testConnection(creds) {
    const j = await call(creds, "/balance/global");
    if (typeof j.balance === "undefined") throw new VoiceProviderError("invalid_token", "Invalid ePBX API token.");
    return { balance: Number(j.balance), currency: j.currency ?? "BDT", name: j.tenant ?? undefined };
  },
  async getBalance(creds) {
    const j = await call(creds, "/balance/global");
    return j.balance == null ? null : Number(j.balance);
  },
  async getNumbers(creds) {
    try {
      const j = await call(creds, "/balance/ip");
      return j.trunk ? [{ number: String(j.trunk), label: "SIP trunk", verified: true }] : [];
    } catch { return []; }
  },
  async makeCall(creds, o) {
    if (!o.extension) throw new VoiceProviderError("failed", "Set an agent extension first (e.g. 101).");
    const j = await call(creds, "/calls/originate", {
      method: "POST",
      body: {
        extension: o.extension,
        phone_number: normPhone(o.to),
        ...(o.callerId ? { caller_id: o.callerId } : {}),
        ...(o.webhookUrl ? { webhook_url: o.webhookUrl } : {}),
      },
    });
    return { provider_call_id: callIdOf(j) };
  },
  async makeOrderVerificationCall(creds, o) {
    const m = o.messages;
    const text = m.custom_text || [m.greeting, m.confirm, m.cancel].filter(Boolean).join(" ");
    const v = o.vars ?? {};
    const a = o.audio ?? {};
    const j = await call(creds, "/calls/verify", {
      method: "POST",
      body: {
        phone_number: normPhone(o.to),
        webhook_url: o.webhookUrl,
        ...(text ? { custom_text: text } : {}),
        ...(m.confirm_text ? { confirm_text: m.confirm_text } : {}),
        ...(m.cancel_text ? { cancel_text: m.cancel_text } : {}),
        ...(m.agent_extension ? { agent_extension: m.agent_extension } : {}),
        ...(o.callerId ? { caller_id: o.callerId } : {}),
        ...(v.customer_name ? { customer_name: v.customer_name } : {}),
        ...(v.amount ? { amount: v.amount } : {}),
        ...(v.store_name ? { store_name: v.store_name } : {}),
        ...(a.main ? { custom_audio_url: a.main } : {}),
        ...(a.confirm ? { confirm_audio_url: a.confirm } : {}),
        ...(a.cancel ? { cancel_audio_url: a.cancel } : {}),
      },
    });
    return { provider_call_id: callIdOf(j) };
  },
  parseWebhook(body) {
    if (!body || typeof body !== "object") return null;
    if (body.data && typeof body.data === "object") body = { ...body.data, ...body };
    if (!body.call_id) body = { ...body, call_id: body.uniqueid ?? body.id ?? "cb" };
    const recRaw = [body.recording_url, body.recording, body.recordingfile, body.record_url, body.recording_file]
      .find((v) => typeof v === "string" && v.trim().length > 0) as string | undefined;
    let recording: string | undefined;
    if (recRaw) {
      const r = recRaw.trim();
      if (/^https:\/\//i.test(r)) recording = r;
      else if (/^\/?[\w\-./]+$/.test(r) && !r.includes("..")) recording = `https://epbx.bd/${r.replace(/^\//, "")}`;
    }
    const raw = String(body.status ?? "").toLowerCase().replace(/\s+/g, "_");
    const status =
      raw === "confirmed" ? "confirmed" :
      raw === "rejected" ? "cancelled" :
      raw === "busy" ? "busy" :
      raw === "noanswer" || raw === "no_answer" ? "no_answer" :
      raw === "no_response" ? "no_response" : raw || undefined;
    return {
      event_id: `${body.call_id}:${raw}:${body.timestamp ?? ""}`,
      provider_call_id: String(body.call_id),
      status,
      dtmf: body.digit_pressed != null ? String(body.digit_pressed) : (body.dtmf != null ? String(body.dtmf) : undefined),
      duration_sec: Number.isFinite(Number(body.duration ?? body.billsec)) ? Math.round(Number(body.duration ?? body.billsec)) : undefined,
      recording_ref: recording,
    };
  },
};
