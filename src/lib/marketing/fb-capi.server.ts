// Facebook Conversion API (server-side) helper. Server-only — do not import from client bundles.
import { createHash } from "node:crypto";

export type FbUserData = {
  email?: string | null;
  phone?: string | null;
  external_id?: string | null;
  client_ip_address?: string | null;
  client_user_agent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
};

export type FbEventInput = {
  event_name: string;
  event_id?: string;
  event_source_url?: string;
  event_time?: number;
  action_source?: "website";
  user_data?: FbUserData;
  custom_data?: Record<string, unknown>;
};

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

function normEmail(v?: string | null): string | undefined {
  if (!v) return;
  const s = String(v).trim().toLowerCase();
  return s ? sha256(s) : undefined;
}
function normPhone(v?: string | null): string | undefined {
  if (!v) return;
  const s = String(v).replace(/\D/g, "");
  return s ? sha256(s) : undefined;
}
function normPlain(v?: string | null): string | undefined {
  if (!v) return;
  const s = String(v).trim();
  return s ? sha256(s) : undefined;
}

function buildUserData(u: FbUserData | undefined): Record<string, unknown> | undefined {
  if (!u) return;
  const out: Record<string, unknown> = {};
  const em = normEmail(u.email);
  const ph = normPhone(u.phone);
  const ex = normPlain(u.external_id);
  if (em) out.em = [em];
  if (ph) out.ph = [ph];
  if (ex) out.external_id = [ex];
  if (u.client_ip_address) out.client_ip_address = u.client_ip_address;
  if (u.client_user_agent) out.client_user_agent = u.client_user_agent;
  if (u.fbp) out.fbp = u.fbp;
  if (u.fbc) out.fbc = u.fbc;
  return Object.keys(out).length ? out : undefined;
}

export type FbCapiResult =
  | { ok: true; events_received: number; fbtrace_id?: string; messages?: string[]; mode: "live" | "test" }
  | { ok: false; error: string; mode: "live" | "test" };

/**
 * Post events to Meta Graph API. Returns a normalized result.
 * `testCode` (optional) sends events to Test Events in Meta Events Manager.
 */
export async function sendFbEvents(opts: {
  pixelId: string;
  accessToken: string;
  events: FbEventInput[];
  testCode?: string | null;
}): Promise<FbCapiResult> {
  if (!opts.pixelId || !opts.accessToken) {
    return { ok: false, error: "Pixel ID or access token missing", mode: "live" };
  }
  const now = Math.floor(Date.now() / 1000);
  const data = opts.events.map((e) => ({
    event_name: e.event_name,
    event_time: e.event_time ?? now,
    event_id: e.event_id,
    event_source_url: e.event_source_url,
    action_source: e.action_source ?? "website",
    user_data: buildUserData(e.user_data) ?? {},
    custom_data: e.custom_data ?? {},
  }));
  const body: Record<string, unknown> = { data };
  const mode: "live" | "test" = opts.testCode ? "test" : "live";
  if (opts.testCode) body.test_event_code = opts.testCode;

  const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(opts.pixelId)}/events?access_token=${encodeURIComponent(opts.accessToken)}`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: `Network error: ${(e as Error).message}`, mode };
  }
  const text = await resp.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 300) }; }
  if (!resp.ok) {
    const msg = json?.error?.message || json?.error_user_msg || text.slice(0, 200) || `HTTP ${resp.status}`;
    return { ok: false, error: msg, mode };
  }
  return {
    ok: true,
    events_received: Number(json.events_received ?? data.length),
    fbtrace_id: json.fbtrace_id,
    messages: Array.isArray(json.messages) ? json.messages : undefined,
    mode,
  };
}

export function extractClientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("cf-connecting-ip") || headers.get("x-real-ip") || null;
}
