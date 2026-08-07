// TikTok Events API v1.3 (server-side). Server-only.
import { createHash } from "node:crypto";

const ENDPOINT = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

export type TtUserData = {
  email?: string | null;
  phone?: string | null;
  external_id?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  ttp?: string | null;
};

export type TtEventInput = {
  event: string;
  event_id?: string;
  event_time?: number;
  page_url?: string;
  referrer?: string;
  user_data?: TtUserData;
  properties?: Record<string, unknown>;
};

export type TtMatching = { email?: boolean; phone?: boolean; external_id?: boolean };

export type TtResult =
  | { ok: true; mode: "live" | "test"; message?: string }
  | { ok: false; error: string; mode: "live" | "test" };

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/** Map common storefront event names to TikTok standard events. */
export function ttEventName(event: string): string {
  const map: Record<string, string> = {
    PageView: "Pageview",
    ViewContent: "ViewContent",
    Search: "Search",
    AddToCart: "AddToCart",
    InitiateCheckout: "InitiateCheckout",
    AddPaymentInfo: "AddPaymentInfo",
    Purchase: "CompletePayment",
    CompleteRegistration: "CompleteRegistration",
  };
  return map[event] ?? event;
}

function buildUser(u: TtUserData | undefined, match: TtMatching): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!u) return out;
  if (match.email !== false && u.email) out.email = sha256(u.email.trim().toLowerCase());
  if (match.phone !== false && u.phone) {
    const digits = u.phone.replace(/\D/g, "");
    if (digits) out.phone = sha256(digits);
  }
  if (match.external_id !== false && u.external_id) out.external_id = sha256(String(u.external_id).trim());
  if (u.ip) out.ip = u.ip;
  if (u.user_agent) out.user_agent = u.user_agent;
  if (u.ttp) out.ttp = u.ttp;
  return out;
}

export async function sendTiktokEvents(opts: {
  pixelCode: string;
  accessToken: string;
  events: TtEventInput[];
  testEventCode?: string | null;
  matching?: TtMatching;
}): Promise<TtResult> {
  const mode: "live" | "test" = opts.testEventCode ? "test" : "live";
  if (!opts.pixelCode || !opts.accessToken) {
    return { ok: false, error: "Pixel ID or access token missing", mode };
  }
  const now = Math.floor(Date.now() / 1000);
  const match = opts.matching ?? {};
  const body: Record<string, unknown> = {
    event_source: "web",
    event_source_id: opts.pixelCode,
    data: opts.events.map((e) => ({
      event: ttEventName(e.event),
      event_time: e.event_time ?? now,
      event_id: e.event_id,
      user: buildUser(e.user_data, match),
      page: { url: e.page_url, referrer: e.referrer },
      properties: e.properties ?? {},
    })),
  };
  if (opts.testEventCode) body.test_event_code = opts.testEventCode;

  let resp: Response;
  try {
    resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": opts.accessToken,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: `Network error: ${(e as Error).message}`, mode };
  }
  const text = await resp.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  if (!resp.ok) {
    return { ok: false, error: json?.message || text.slice(0, 300) || `HTTP ${resp.status}`, mode };
  }
  if (typeof json.code === "number" && json.code !== 0) {
    return { ok: false, error: json.message || `TikTok error code ${json.code}`, mode };
  }
  return { ok: true, mode, message: json.message };
}

export function extractIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("cf-connecting-ip") || headers.get("x-real-ip") || null;
}
