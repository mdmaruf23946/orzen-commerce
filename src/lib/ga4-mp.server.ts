// Google Analytics 4 Measurement Protocol (server-side). Server-only.

export type Ga4Event = { name: string; params?: Record<string, unknown> };

export type Ga4Result =
  | { ok: true; mode: "live" | "debug"; validation?: string[] }
  | { ok: false; error: string; mode: "live" | "debug" };

const LIVE = "https://www.google-analytics.com/mp/collect";
const DEBUG = "https://www.google-analytics.com/debug/mp/collect";

/** GA4 event names must be snake_case alphanumerics. */
export function ga4EventName(event: string): string {
  const map: Record<string, string> = {
    PageView: "page_view",
    ViewContent: "view_item",
    Search: "search",
    AddToCart: "add_to_cart",
    InitiateCheckout: "begin_checkout",
    AddPaymentInfo: "add_payment_info",
    Purchase: "purchase",
    CompleteRegistration: "sign_up",
  };
  if (map[event]) return map[event]!;
  return event
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .toLowerCase()
    .slice(0, 40);
}

export async function sendGa4Events(opts: {
  measurementId: string;
  apiSecret: string;
  clientId: string;
  events: Ga4Event[];
  userId?: string | null;
  debug?: boolean;
}): Promise<Ga4Result> {
  const mode: "live" | "debug" = opts.debug ? "debug" : "live";
  if (!opts.measurementId || !opts.apiSecret) {
    return { ok: false, error: "Measurement ID or API secret missing", mode };
  }
  const url = `${opts.debug ? DEBUG : LIVE}?measurement_id=${encodeURIComponent(opts.measurementId)}&api_secret=${encodeURIComponent(opts.apiSecret)}`;
  const body: Record<string, unknown> = {
    client_id: opts.clientId,
    non_personalized_ads: false,
    events: opts.events.slice(0, 25).map((e) => ({
      name: ga4EventName(e.name),
      params: e.params ?? {},
    })),
  };
  if (opts.userId) body.user_id = String(opts.userId).slice(0, 256);

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: `Network error: ${(e as Error).message}`, mode };
  }
  const text = await resp.text();
  if (!resp.ok) {
    return { ok: false, error: text.slice(0, 300) || `HTTP ${resp.status}`, mode };
  }
  if (opts.debug) {
    try {
      const json = JSON.parse(text || "{}");
      const msgs: string[] = (json.validationMessages ?? []).map((v: any) => v.description ?? JSON.stringify(v));
      if (msgs.length) return { ok: false, error: msgs.join(" · "), mode };
      return { ok: true, mode, validation: [] };
    } catch {
      return { ok: true, mode };
    }
  }
  return { ok: true, mode };
}

/** Lightweight reachability check for a GTM container id. */
export async function verifyGtmContainerId(containerId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`, {
      method: "GET",
    });
    if (!r.ok) return { ok: false, error: `Container not reachable (HTTP ${r.status})` };
    const body = await r.text();
    if (body.length < 200 || /Google Tag Manager container not found/i.test(body)) {
      return { ok: false, error: "Container ID not found on Google's servers" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
