// Server-only helpers for the AI Voice Call Center.
// ElevenLabs owns the live phone leg (audio, barge-in, turn-taking); we only
// provision agents/numbers, trigger outbound calls and consume webhooks.
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { encryptJSON, decryptJSON, credentialsPreview } from "@/lib/crypto/credentials.server";

const EL_BASE = "https://api.elevenlabs.io/v1";
const TWILIO_BASE = "https://api.twilio.com/2010-04-01/Accounts";

export type ElevenLabsCreds = { api_key: string; webhook_secret?: string };
export type TwilioCreds = { account_sid: string; auth_token: string };

export function encryptCreds(creds: Record<string, string>) {
  return { enc: encryptJSON(creds), preview: credentialsPreview(creds) };
}

export function readCreds<T = Record<string, string>>(stored?: string | null): T | null {
  if (!stored) return null;
  try {
    return decryptJSON<T>(stored);
  } catch {
    return null;
  }
}

export function newToolSecret(): string {
  return randomBytes(24).toString("hex");
}

/* ------------------------------- ElevenLabs ------------------------------ */

async function el<T = any>(
  creds: ElevenLabsCreds,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${EL_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "xi-api-key": creds.api_key,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`ElevenLabs request failed [${res.status}]: ${text.slice(0, 400)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export async function elVerify(creds: ElevenLabsCreds): Promise<{ ok: true }> {
  await el(creds, "/user");
  return { ok: true };
}

export async function elListVoices(creds: ElevenLabsCreds) {
  const data = await el<{ voices?: any[] }>(creds, "/voices");
  return (data.voices ?? []).map((v) => ({
    voice_id: String(v.voice_id),
    name: String(v.name ?? "Voice"),
    preview_url: v.preview_url ? String(v.preview_url) : null,
    gender: String(v.labels?.gender ?? "female"),
    accent: v.labels?.accent ? String(v.labels.accent) : null,
    description: v.labels?.description ? String(v.labels.description) : null,
  }));
}

export type AgentSpec = {
  name: string;
  prompt: string;
  firstMessage: string;
  voiceId: string | null;
  language: string;
  maxDurationSec: number;
  silenceTimeoutSec: number;
  toolWebhookUrl?: string | null;
  toolSecret?: string | null;
  tools?: string[];
};

function agentBody(spec: AgentSpec) {
  const body: any = {
    name: spec.name,
    conversation_config: {
      agent: {
        prompt: { prompt: spec.prompt },
        first_message: spec.firstMessage,
        language: spec.language || "en",
      },
      turn: { turn_timeout: spec.silenceTimeoutSec },
      conversation: { max_duration_seconds: spec.maxDurationSec },
    },
  };
  if (spec.voiceId) body.conversation_config.tts = { voice_id: spec.voiceId };
  return body;
}

export async function elCreateAgent(creds: ElevenLabsCreds, spec: AgentSpec): Promise<string> {
  const res = await el<{ agent_id?: string }>(creds, "/convai/agents/create", {
    method: "POST",
    body: agentBody(spec),
  });
  if (!res.agent_id) throw new Error("ElevenLabs did not return an agent id.");
  return res.agent_id;
}

export async function elUpdateAgent(creds: ElevenLabsCreds, agentId: string, spec: AgentSpec) {
  await el(creds, `/convai/agents/${encodeURIComponent(agentId)}`, {
    method: "PATCH",
    body: agentBody(spec),
  });
}

export async function elDeleteAgent(creds: ElevenLabsCreds, agentId: string) {
  try {
    await el(creds, `/convai/agents/${encodeURIComponent(agentId)}`, { method: "DELETE" });
  } catch {
    /* best effort */
  }
}

/** Import an existing Twilio number into ElevenLabs so an agent can own it. */
export async function elImportNumber(
  creds: ElevenLabsCreds,
  twilio: TwilioCreds,
  opts: { phoneNumber: string; label: string },
): Promise<string> {
  const res = await el<{ phone_number_id?: string }>(creds, "/convai/phone-numbers", {
    method: "POST",
    body: {
      provider: "twilio",
      phone_number: opts.phoneNumber,
      label: opts.label,
      sid: twilio.account_sid,
      token: twilio.auth_token,
    },
  });
  if (!res.phone_number_id) throw new Error("ElevenLabs did not return a phone number id.");
  return res.phone_number_id;
}

export async function elAssignNumber(creds: ElevenLabsCreds, phoneId: string, agentId: string | null) {
  await el(creds, `/convai/phone-numbers/${encodeURIComponent(phoneId)}`, {
    method: "PATCH",
    body: { agent_id: agentId },
  });
}

export async function elReleaseNumber(creds: ElevenLabsCreds, phoneId: string) {
  try {
    await el(creds, `/convai/phone-numbers/${encodeURIComponent(phoneId)}`, { method: "DELETE" });
  } catch {
    /* best effort */
  }
}

export async function elOutboundCall(
  creds: ElevenLabsCreds,
  opts: {
    agentId: string;
    agentPhoneNumberId: string;
    toNumber: string;
    dynamicVariables: Record<string, string>;
    firstMessage?: string;
  },
): Promise<{ conversationId: string | null; callSid: string | null }> {
  const res = await el<{ conversation_id?: string; callSid?: string; call_sid?: string }>(
    creds,
    "/convai/twilio/outbound-call",
    {
      method: "POST",
      body: {
        agent_id: opts.agentId,
        agent_phone_number_id: opts.agentPhoneNumberId,
        to_number: opts.toNumber,
        conversation_initiation_client_data: {
          dynamic_variables: opts.dynamicVariables,
          ...(opts.firstMessage
            ? { conversation_config_override: { agent: { first_message: opts.firstMessage } } }
            : {}),
        },
      },
    },
  );
  return {
    conversationId: res.conversation_id ?? null,
    callSid: (res.callSid ?? res.call_sid) ?? null,
  };
}

/** ElevenLabs post-call webhook signature: `t=<ts>,v0=<hmac sha256>`. */
export function verifyElevenLabsSignature(secret: string, rawBody: string, header: string | null): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  ) as Record<string, string>;
  const ts = parts["t"];
  const sig = parts["v0"];
  if (!ts || !sig) return false;
  const expected = createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/* --------------------------------- Twilio -------------------------------- */

function basic(c: TwilioCreds) {
  return "Basic " + Buffer.from(`${c.account_sid}:${c.auth_token}`).toString("base64");
}

export async function twilioVerify(creds: TwilioCreds): Promise<void> {
  const res = await fetch(`${TWILIO_BASE}/${encodeURIComponent(creds.account_sid)}.json`, {
    headers: { Authorization: basic(creds) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Unable to connect to Twilio [${res.status}]: ${body.slice(0, 300)}`);
  }
}

export async function twilioListNumbers(creds: TwilioCreds) {
  const res = await fetch(
    `${TWILIO_BASE}/${encodeURIComponent(creds.account_sid)}/IncomingPhoneNumbers.json?PageSize=100`,
    { headers: { Authorization: basic(creds) } },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Twilio request failed [${res.status}]: ${text.slice(0, 300)}`);
  const json = JSON.parse(text) as { incoming_phone_numbers?: any[] };
  return (json.incoming_phone_numbers ?? []).map((n) => ({
    sid: String(n.sid),
    phone_number: String(n.phone_number),
    friendly_name: String(n.friendly_name ?? n.phone_number),
    country: String(n.iso_country ?? "US"),
  }));
}

/* ---------------------------- prompt building ---------------------------- */

export const BASE_TEMPLATE_PROMPT = `You are a professional e-commerce phone assistant for {{store_name}}.

Rules you must always follow:
- Speak naturally, like a real human agent on a phone call. Keep answers short.
- Never invent business information. Use only the verified details given to you
  or returned by your tools.
- Never change prices, offer discounts or promise anything that is not confirmed
  by the store data.
- If you do not know something, say so and offer to have the store contact them.
- Confirm important details (name, address, quantity) by repeating them back.
- Order status questions ("where is my order?"): call track_order with caller_phone
  set to the caller's number FIRST — do not ask for the number. Only if no order is
  found on the caller's number, say so and ask which number they ordered with,
  then call track_order with that phone.`;

export function buildStorePrompt(opts: {
  base: string;
  toneInstructions?: string | null;
  personality?: string | null;
  behavior: Record<string, any>;
  business: Record<string, boolean>;
  storeContext: string;
}): string {
  const off = Object.entries(opts.business)
    .filter(([, v]) => v === false)
    .map(([k]) => k.replace(/_/g, " "));
  return [
    opts.base,
    opts.personality ? `Personality: ${opts.personality}` : "",
    opts.toneInstructions ? `Tone: ${opts.toneInstructions}` : "",
    opts.behavior?.interruptions
      ? "If the customer starts speaking while you are talking, stop immediately and listen."
      : "",
    opts.behavior?.max_response_chars
      ? `Keep every spoken reply under about ${opts.behavior.max_response_chars} characters.`
      : "",
    off.length ? `Do not handle these topics; offer a callback instead: ${off.join(", ")}.` : "",
    "",
    "Verified store information:",
    opts.storeContext,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Build the verified, store-scoped knowledge block for an agent. */
export async function buildStoreContext(sb: any, storeId: string): Promise<string> {
  const [{ data: store }, { data: products }, { data: zones }, { data: ret }] = await Promise.all([
    sb.from("stores").select("name,description,phone,email,address,currency").eq("id", storeId).maybeSingle(),
    sb
      .from("products")
      .select("name,price,stock,status")
      .eq("store_id", storeId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(40),
    sb.from("delivery_zones").select("name,charge,eta").eq("store_id", storeId).eq("is_active", true),
    sb
      .from("store_return_settings")
      .select("enabled,eligibility_days,exchange_window_days,policy_note")
      .eq("store_id", storeId)
      .maybeSingle(),
  ]);

  const lines: string[] = [];
  if (store) {
    lines.push(`Store name: ${store.name}`);
    if (store.description) lines.push(`About: ${String(store.description).slice(0, 400)}`);
    if (store.phone) lines.push(`Store phone: ${store.phone}`);
    if (store.address) lines.push(`Address: ${store.address}`);
    lines.push(`Currency: ${store.currency ?? "BDT"}`);
  }
  if (products?.length) {
    lines.push("", "Products (name — price — stock):");
    for (const p of products) lines.push(`- ${p.name} — ${p.price} — ${p.stock}`);
  }
  if (zones?.length) {
    lines.push("", "Delivery charges:");
    for (const z of zones) lines.push(`- ${z.name}: ${z.charge}${z.eta ? ` (${z.eta})` : ""}`);
  }
  if (ret) {
    lines.push(
      "",
      `Returns: ${ret.enabled ? "accepted" : "not accepted"}${
        ret.eligibility_days ? `, within ${ret.eligibility_days} days` : ""
      }${ret.exchange_window_days ? `, exchange within ${ret.exchange_window_days} days` : ""}.`,
    );
    if (ret.policy_note) lines.push(String(ret.policy_note).slice(0, 400));
  }
  return lines.join("\n");
}

/** Dynamic per-call variables handed to the agent before an outbound call. */
export async function buildOrderVariables(
  sb: any,
  storeId: string,
  orderId: string | null,
): Promise<Record<string, string>> {
  const { data: store } = await sb.from("stores").select("name,currency").eq("id", storeId).maybeSingle();
  const vars: Record<string, string> = {
    store_name: String(store?.name ?? "our store"),
    currency: String(store?.currency ?? "BDT"),
  };
  if (!orderId) return vars;

  const { data: order } = await sb
    .from("orders")
    .select("id,invoice_no,customer_name,phone,address,area,payment_method,subtotal,delivery_amount,discount_amount,status")
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!order) return vars;

  const { data: items } = await sb
    .from("order_items")
    .select("name_snapshot,price_snapshot,qty")
    .eq("order_id", orderId);

  const total =
    Number(order.subtotal ?? 0) + Number(order.delivery_amount ?? 0) - Number(order.discount_amount ?? 0);

  Object.assign(vars, {
    order_id: String(order.invoice_no ?? order.id.slice(0, 8).toUpperCase()),
    order_uuid: String(order.id),
    customer_name: String(order.customer_name ?? "there"),
    customer_phone: String(order.phone ?? ""),
    delivery_address: [order.address, order.area].filter(Boolean).join(", "),
    payment_method: String(order.payment_method ?? "cod"),
    delivery_charge: String(order.delivery_amount ?? 0),
    total_amount: String(total),
    order_status: String(order.status ?? "pending"),
    products: (items ?? [])
      .map((i: any) => `${i.name_snapshot} x${i.qty} @ ${i.price_snapshot}`)
      .join("; "),
  });
  return vars;
}

export function withinCallingHours(rules: any, now = new Date()): boolean {
  const hour = now.getUTCHours() + 6; // store timezone default: Asia/Dhaka
  const h = ((hour % 24) + 24) % 24;
  const day = new Date(now.getTime() + 6 * 3600_000).getUTCDay();
  if (!rules?.weekend_calling && (day === 5 || day === 6)) return false;
  const start = Number(rules?.call_start_hour ?? 9);
  const end = Number(rules?.call_end_hour ?? 21);
  return h >= start && h < end;
}
