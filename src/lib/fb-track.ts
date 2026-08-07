// Browser-side multi-platform tracking dispatcher (Meta Pixel + CAPI, GA4, Google Ads, TikTok).
// Installed by the storefront route; components emit events via track()/fbTrack().

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    ttq?: any;
    __fbInit?: { slug: string; pixelId: string } | null;
    __trackInit?: TrackInit | null;
  }
}

export type TrackInit = {
  slug: string;
  fbPixel?: boolean;
  ga4?: boolean;
  ga4Server?: boolean;
  ads?: { id: string; label?: string; purchase: boolean } | null;
  tiktokPixel?: boolean;
  tiktokServer?: boolean;
};

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Stable GA4 client id shared across the session. */
function ga4ClientId(): string {
  const gaCookie = getCookie("_ga");
  if (gaCookie) {
    const parts = gaCookie.split(".");
    if (parts.length >= 4) return `${parts[2]}.${parts[3]}`;
  }
  try {
    const key = "orzen:ga4cid";
    let v = localStorage.getItem(key);
    if (!v) {
      v = `${Math.floor(Math.random() * 1e10)}.${Math.floor(Date.now() / 1000)}`;
      localStorage.setItem(key, v);
    }
    return v;
  } catch {
    return `${Math.floor(Math.random() * 1e10)}.${Math.floor(Date.now() / 1000)}`;
  }
}

export function readCustomerForTracking(slug: string): {
  email?: string;
  phone?: string;
  external_id?: string;
} {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`storefront:customer:${slug}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      email: parsed?.email ?? undefined,
      phone: parsed?.phone ?? undefined,
      external_id: parsed?.id ?? undefined,
    };
  } catch {
    return {};
  }
}

export type FbTrackParams = Record<string, unknown>;

const GA4_NAMES: Record<string, string> = {
  PageView: "page_view",
  ViewContent: "view_item",
  Search: "search",
  AddToCart: "add_to_cart",
  InitiateCheckout: "begin_checkout",
  AddPaymentInfo: "add_payment_info",
  Purchase: "purchase",
  CompleteRegistration: "sign_up",
};

const TT_NAMES: Record<string, string> = {
  PageView: "Pageview",
  ViewContent: "ViewContent",
  Search: "Search",
  AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout",
  AddPaymentInfo: "AddPaymentInfo",
  Purchase: "CompletePayment",
  CompleteRegistration: "CompleteRegistration",
};

function post(url: string, body: unknown) {
  try {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore network errors
  }
}

/**
 * Fire one event to every enabled platform. Browser and server events share
 * one `event_id` so Meta / TikTok deduplicate automatically.
 */
export function track(
  event: string,
  params?: FbTrackParams,
  opts?: { eventId?: string; userData?: { email?: string; phone?: string; external_id?: string } },
) {
  if (typeof window === "undefined") return;
  const init = window.__trackInit;
  const fbInit = window.__fbInit;
  if (!init && !fbInit) return;
  const slug = init?.slug ?? fbInit?.slug ?? "";
  const eventId = opts?.eventId ?? uuid();
  const user = opts?.userData ?? readCustomerForTracking(slug);
  const p = params ?? {};

  // --- Meta ---
  if (fbInit) {
    try {
      if (typeof window.fbq === "function") window.fbq("track", event, p, { eventID: eventId });
    } catch {
      /* ignore */
    }
    post("/api/public/fb-capi/track", {
      store_slug: slug,
      event,
      event_id: eventId,
      event_source_url: typeof location !== "undefined" ? location.href : undefined,
      custom_data: p,
      user_data: { ...user, fbp: getCookie("_fbp"), fbc: getCookie("_fbc") },
    });
  }

  if (!init) return;

  // --- Google ---
  const gaName = GA4_NAMES[event] ?? event;
  if (init.ga4 && typeof window.gtag === "function") {
    try {
      window.gtag("event", gaName, { ...p, event_id: eventId });
    } catch {
      /* ignore */
    }
  }
  if (init.ga4Server) {
    post("/api/public/ga4/track", {
      store_slug: slug,
      event: gaName,
      event_id: eventId,
      client_id: ga4ClientId(),
      user_id: user.external_id ?? null,
      event_source_url: typeof location !== "undefined" ? location.href : undefined,
      custom_data: p,
    });
  }
  if (init.ads?.purchase && event === "Purchase" && typeof window.gtag === "function") {
    try {
      window.gtag("event", "conversion", {
        send_to: init.ads.label ? `${init.ads.id}/${init.ads.label}` : init.ads.id,
        value: (p as any).value ?? 0,
        currency: (p as any).currency ?? "BDT",
        transaction_id: (p as any).transaction_id ?? (p as any).order_id ?? eventId,
      });
    } catch {
      /* ignore */
    }
  }

  // --- TikTok ---
  const ttName = TT_NAMES[event] ?? event;
  if (init.tiktokPixel && window.ttq) {
    try {
      window.ttq.track(ttName, p, { event_id: eventId });
    } catch {
      /* ignore */
    }
  }
  if (init.tiktokServer) {
    post("/api/public/tiktok/track", {
      store_slug: slug,
      event: ttName,
      event_id: eventId,
      event_source_url: typeof location !== "undefined" ? location.href : undefined,
      custom_data: p,
      user_data: { ...user, ttp: getCookie("_ttp") },
    });
  }
}

/** Backwards-compatible alias — existing call sites keep working. */
export const fbTrack = track;

/** Deterministic event id for a Purchase so the browser and the server-fired event dedupe. */
export function purchaseEventId(orderId: string): string {
  return `purchase-${orderId}`;
}
