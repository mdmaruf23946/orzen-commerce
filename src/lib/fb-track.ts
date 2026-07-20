// Browser-side Facebook Pixel + CAPI dispatcher.
// Installed by the storefront route; components emit events via fbTrack().

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
    __fbInit?: { slug: string; pixelId: string } | null;
  }
}

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

/**
 * Fire one event to the browser Pixel and mirror it via CAPI.
 * `eventId` is optional — one is generated if omitted (browser + server share it).
 */
export function fbTrack(
  event: string,
  params?: FbTrackParams,
  opts?: { eventId?: string; userData?: { email?: string; phone?: string; external_id?: string } },
) {
  if (typeof window === "undefined") return;
  const init = window.__fbInit;
  if (!init) return; // pixel not configured for this store
  const eventId = opts?.eventId ?? uuid();
  try {
    if (typeof window.fbq === "function") {
      window.fbq("track", event, params ?? {}, { eventID: eventId });
    }
  } catch {
    // ignore Pixel errors
  }
  const body = {
    store_slug: init.slug,
    event,
    event_id: eventId,
    event_source_url: typeof location !== "undefined" ? location.href : undefined,
    custom_data: params,
    user_data: {
      ...(opts?.userData ?? readCustomerForTracking(init.slug)),
      fbp: getCookie("_fbp"),
      fbc: getCookie("_fbc"),
    },
  };
  try {
    fetch("/api/public/fb-capi/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore network errors
  }
}

/** Deterministic event id for a Purchase so the browser and the server-fired event dedupe. */
export function purchaseEventId(orderId: string): string {
  return `purchase-${orderId}`;
}
