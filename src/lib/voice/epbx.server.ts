// ePBX adapter — https://epbx.bd/docs/api (REST v1, Bearer token, 120 req/min).
import { VoiceProviderError, type VoiceCreds, type VoiceProvider } from "./types";

const BASE = "https://epbx.bd/api/v1";

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
    res = await fetch(BASE + path, {
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
      body: { extension: o.extension, phone_number: normPhone(o.to), ...(o.callerId ? { caller_id: o.callerId } : {}) },
    });
    return { provider_call_id: callIdOf(j) };
  },
  async makeOrderVerificationCall(creds, o) {
    const m = o.messages;
    const text = [m.greeting, m.confirm, m.cancel].filter(Boolean).join(" ");
    const j = await call(creds, "/calls/verify", {
      method: "POST",
      body: {
        phone_number: normPhone(o.to),
        webhook_url: o.webhookUrl,
        ...(text ? { custom_text: text } : {}),
        ...(m.confirm_text ? { confirm_text: m.confirm_text } : {}),
        ...(m.cancel_text ? { cancel_text: m.cancel_text } : {}),
        ...(m.agent_extension ? { agent_extension: m.agent_extension } : {}),
      },
    });
    return { provider_call_id: callIdOf(j) };
  },
  parseWebhook(body) {
    if (!body || !body.call_id) return null;
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
      recording_ref: typeof (body.recording_url ?? body.recording) === "string" && /^https:\/\//.test(body.recording_url ?? body.recording) ? String(body.recording_url ?? body.recording) : undefined,
    };
  },
};
