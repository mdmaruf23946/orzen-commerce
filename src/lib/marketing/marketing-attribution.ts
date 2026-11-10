// First-party platform attribution (Facebook / Google / TikTok) for the
// per-platform Marketing Overviews. Browser-only; never throws.
// Direct, typed-in and unrelated traffic is never attributed.

export type AdPlatform = "facebook" | "google" | "tiktok";
export type FunnelEvent = "page_view" | "product_view" | "add_to_cart" | "checkout" | "purchase";

type Attribution = { platform: AdPlatform; campaign: string | null; click_id: string | null; at: number };

const ATTR_KEY = "orzen_mk_attr";
const VISITOR_KEY = "orzen_mk_vid";
const SESSION_KEY = "orzen_mk_sid";
const WINDOW_MS = 30 * 24 * 3600 * 1000;

declare global {
  interface Window {
    __mkSlug?: string;
  }
}

function rid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function detectPlatform(url: URL, referrer: string): Omit<Attribution, "at"> | null {
  const q = url.searchParams;
  const src = (q.get("utm_source") ?? "").toLowerCase();
  const campaign = q.get("utm_campaign") || q.get("campaign_id") || q.get("adset_id") || q.get("ad_id") || null;
  let ref = "";
  try {
    ref = referrer ? new URL(referrer).hostname.toLowerCase() : "";
  } catch {
    ref = "";
  }
  if (ref && typeof location !== "undefined" && ref === location.hostname) ref = "";
  const fb = q.get("fbclid");
  if (fb || ["facebook", "fb", "meta", "instagram", "ig"].includes(src) || /(^|\.)(facebook\.com|instagram\.com|m\.me|fb\.me)$/.test(ref))
    return { platform: "facebook", campaign, click_id: fb };
  const g = q.get("gclid") || q.get("gbraid") || q.get("wbraid");
  if (g || src === "google" || /(^|\.)google\.[a-z.]+$/.test(ref)) return { platform: "google", campaign, click_id: g };
  const tt = q.get("ttclid");
  if (tt || src === "tiktok" || /(^|\.)tiktok\.com$/.test(ref)) return { platform: "tiktok", campaign, click_id: tt };
  return null;
}

function readAttr(): Attribution | null {
  try {
    const a = JSON.parse(localStorage.getItem(ATTR_KEY) ?? "null") as Attribution | null;
    if (!a || Date.now() - a.at > WINDOW_MS) return null;
    return a;
  } catch {
    return null;
  }
}

function visitorId() {
  let v = localStorage.getItem(VISITOR_KEY);
  if (!v) {
    v = rid();
    localStorage.setItem(VISITOR_KEY, v);
  }
  return v;
}

function sessionId(fresh: boolean) {
  let s = sessionStorage.getItem(SESSION_KEY);
  if (!s || fresh) {
    s = rid();
    sessionStorage.setItem(SESSION_KEY, s);
  }
  return s;
}

function send(body: unknown) {
  try {
    fetch("/api/public/marketing/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Call on every storefront/landing page view. */
export function recordPageView(slug: string) {
  if (typeof window === "undefined" || !slug) return;
  try {
    window.__mkSlug = slug;
    const hit = detectPlatform(new URL(location.href), document.referrer);
    let fresh = false;
    if (hit) {
      const prev = readAttr();
      fresh = !prev || prev.platform !== hit.platform || prev.campaign !== hit.campaign || !!hit.click_id;
      localStorage.setItem(ATTR_KEY, JSON.stringify({ ...hit, at: Date.now() }));
    }
    const attr = readAttr();
    if (!attr) return;
    send({
      store_slug: slug,
      visitor_id: visitorId(),
      session_id: sessionId(fresh),
      platform: attr.platform,
      campaign: attr.campaign,
      click_id: attr.click_id,
      path: location.pathname,
      referrer: document.referrer?.slice(0, 500) || null,
      event: "page_view",
    });
  } catch {
    /* ignore */
  }
}

const MAP: Record<string, FunnelEvent> = {
  ViewContent: "product_view",
  AddToCart: "add_to_cart",
  InitiateCheckout: "checkout",
  Purchase: "purchase",
};

/** Mirrors storefront tracking events into the attributed funnel. */
export function recordFunnelEvent(event: string, params: Record<string, any> | undefined, eventId?: string, slug?: string) {
  if (typeof window === "undefined") return;
  const type = MAP[event];
  const s = slug || window.__mkSlug;
  if (!type || !s) return;
  try {
    const attr = readAttr();
    if (!attr) return;
    let orderId: string | null = params?.order_id ?? null;
    if (!orderId && eventId?.startsWith("purchase-")) orderId = eventId.slice(9);
    if (orderId && !/^[0-9a-f-]{36}$/i.test(orderId)) orderId = null;
    send({
      store_slug: s,
      visitor_id: visitorId(),
      session_id: sessionId(false),
      platform: attr.platform,
      campaign: attr.campaign,
      click_id: attr.click_id,
      path: location.pathname,
      event: type,
      order_id: type === "purchase" ? orderId : null,
      value: type === "purchase" ? Number(params?.value ?? 0) || null : null,
    });
  } catch {
    /* ignore */
  }
}
