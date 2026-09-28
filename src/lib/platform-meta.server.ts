// ORZEN main-website Meta Pixel + Conversions API (server side).
// Completely separate from merchant store tracking: reads ONLY the
// `platform_meta_tracking` singleton, never `stores.marketing`.
// Every event is logged in `platform_meta_events` with a unique
// (event_name, event_id) so retries/webhook repeats never send twice.
import { sendFbEvents, extractClientIp, type FbUserData } from "@/lib/fb-capi.server";

export const PLATFORM_EVENTS = [
  "PageView",
  "ViewContent",
  "CompleteRegistration",
  "Lead",
  "StartTrial",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Subscribe",
  "Purchase",
  "WalletTopup",
] as const;
export type PlatformEventName = (typeof PLATFORM_EVENTS)[number];

/** Events the browser may report. Paid conversions are server-only. */
export const BROWSER_EVENTS = new Set<string>(["PageView", "ViewContent", "InitiateCheckout"]);

export const CONSENT_NOTICE_VERSION = "2026-09-28";

// EU/EEA + UK + Switzerland: advertising cookies need explicit consent.
const CONSENT_COUNTRIES = new Set(
  "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH".split(" "),
);

export type PlatformConfig = {
  enabled: boolean;
  pixel_enabled: boolean;
  capi_enabled: boolean;
  pixel_id: string | null;
  token: string | null;
  test_event_code: string | null;
  send_user_data: boolean;
  events: Record<string, boolean>;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function loadPlatformConfig(): Promise<PlatformConfig | null> {
  const sb = await admin();
  const { data } = await sb.from("platform_meta_tracking").select("*").eq("id", 1).maybeSingle();
  if (!data) return null;
  let token: string | null = null;
  if (data.capi_token_enc) {
    try {
      const { decryptJSON } = await import("@/lib/crypto/credentials.server");
      token = (decryptJSON<{ token: string }>(data.capi_token_enc)?.token ?? null) || null;
    } catch {
      token = null;
    }
  }
  return {
    enabled: !!data.enabled,
    pixel_enabled: data.pixel_enabled !== false,
    capi_enabled: data.capi_enabled !== false,
    pixel_id: data.pixel_id || null,
    token,
    test_event_code: data.test_event_code || null,
    send_user_data: data.send_user_data !== false,
    events: (data.events ?? {}) as Record<string, boolean>,
  };
}

export function eventEnabled(cfg: PlatformConfig, name: string) {
  return cfg.events[name] !== false;
}

function readCookie(headers: Headers, name: string) {
  const raw = headers.get("cookie") ?? "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

/** Visitor context taken from the live browser request (cookies, IP, UA, consent). */
export type VisitorCtx = {
  consent_ok: boolean;
  ip: string | null;
  ua: string | null;
  fbp: string | null;
  fbc: string | null;
  url: string | null;
};

export function visitorFromHeaders(headers: Headers, url?: string | null): VisitorCtx {
  const country = (headers.get("cf-ipcountry") || "").toUpperCase();
  const needsConsent = !country || country === "XX" || country === "T1" || CONSENT_COUNTRIES.has(country);
  const consent = readCookie(headers, "orzen_consent");
  return {
    consent_ok: needsConsent ? consent === "accepted" : consent !== "rejected",
    ip: extractClientIp(headers),
    ua: headers.get("user-agent"),
    fbp: readCookie(headers, "_fbp"),
    fbc: readCookie(headers, "_fbc"),
    url: url ?? headers.get("referer"),
  };
}

export type SendOpts = {
  event_name: PlatformEventName;
  event_id: string;
  source?: "server" | "browser";
  visitor: VisitorCtx | null;
  user?: { id?: string | null; email?: string | null; phone?: string | null } | null;
  custom_data?: Record<string, unknown>;
  value?: number | null;
  /** Force Meta Test Events (admin test button). */
  testCode?: string | null;
};

export type SendResult = { status: "sent" | "failed" | "skipped" | "duplicate"; reason?: string };

/** Send one event. Never throws — tracking must not break business flows. */
export async function sendPlatformEvent(opts: SendOpts): Promise<SendResult> {
  try {
    const cfg = await loadPlatformConfig();
    if (!cfg || !cfg.enabled || !cfg.capi_enabled) return { status: "skipped", reason: "disabled" };
    if (!cfg.pixel_id || !cfg.token) return { status: "skipped", reason: "not_configured" };
    if (!eventEnabled(cfg, opts.event_name)) return { status: "skipped", reason: "event_off" };
    if (!opts.visitor?.consent_ok) return { status: "skipped", reason: "no_consent" };

    const sb = await admin();
    const testCode = opts.testCode ?? cfg.test_event_code;
    // Claim the (event_name, event_id) slot. Existing sent row → duplicate.
    const { data: existing } = await sb
      .from("platform_meta_events")
      .select("id,status,attempts")
      .eq("event_name", opts.event_name)
      .eq("event_id", opts.event_id)
      .maybeSingle();
    if (existing?.status === "sent") return { status: "duplicate" };
    let rowId = existing?.id as string | undefined;
    if (!rowId) {
      const { data: ins, error } = await sb
        .from("platform_meta_events")
        .insert({
          event_name: opts.event_name,
          event_id: opts.event_id,
          source: opts.source ?? "server",
          status: "pending",
          test_mode: !!testCode,
          user_id: opts.user?.id ?? null,
          value: opts.value ?? null,
        })
        .select("id")
        .single();
      if (error) return { status: "duplicate" }; // lost a race with a parallel send
      rowId = ins.id;
    }

    const v = opts.visitor;
    const user_data: FbUserData = {
      client_ip_address: v.ip,
      client_user_agent: v.ua,
      fbp: v.fbp,
      fbc: v.fbc,
      external_id: opts.user?.id ?? null,
      ...(cfg.send_user_data ? { email: opts.user?.email ?? null, phone: opts.user?.phone ?? null } : {}),
    };
    const custom_data = { ...(opts.custom_data ?? {}) } as Record<string, unknown>;
    if (opts.value != null) {
      custom_data.value = Number(opts.value);
      custom_data.currency = "BDT";
    }
    const event = {
      event_name: opts.event_name,
      event_id: opts.event_id,
      event_source_url: v.url ?? undefined,
      user_data,
      custom_data,
    };

    let res = await sendFbEvents({ pixelId: cfg.pixel_id, accessToken: cfg.token, events: [event], testCode });
    let attempts = Number(existing?.attempts ?? 0) + 1;
    if (!res.ok && /network|timeout|5\d\d|temporar/i.test(res.error)) {
      await new Promise((r) => setTimeout(r, 800));
      res = await sendFbEvents({ pixelId: cfg.pixel_id, accessToken: cfg.token, events: [event], testCode });
      attempts += 1;
    }
    await sb
      .from("platform_meta_events")
      .update({
        status: res.ok ? "sent" : "failed",
        attempts,
        test_mode: !!testCode,
        error: res.ok ? null : res.error.slice(0, 500),
        response: res.ok ? { events_received: res.events_received, fbtrace_id: res.fbtrace_id } : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId);
    return res.ok ? { status: "sent" } : { status: "failed", reason: res.error };
  } catch (e) {
    console.error("[platform-meta] send failed", (e as Error).message);
    return { status: "failed", reason: (e as Error).message };
  }
}

/**
 * Remember the paying visitor's context for an invoice so a later payment
 * webhook (which has no browser) can still send a matched, consent-checked
 * Purchase. Stored as a `ctx` log row keyed by invoice id.
 */
export async function rememberCheckoutVisitor(invoiceId: string, visitor: VisitorCtx) {
  try {
    const sb = await admin();
    await sb.from("platform_meta_events").upsert(
      { event_name: "ctx", event_id: invoiceId, source: "server", status: "skipped", response: visitor },
      { onConflict: "event_name,event_id" },
    );
  } catch {
    /* never block checkout */
  }
}

export async function checkoutVisitor(invoiceId: string): Promise<VisitorCtx | null> {
  const sb = await admin();
  const { data } = await sb
    .from("platform_meta_events")
    .select("response")
    .eq("event_name", "ctx")
    .eq("event_id", invoiceId)
    .maybeSingle();
  return (data?.response as VisitorCtx) ?? null;
}

/**
 * Paid conversion — call ONLY after the payment is verified. Idempotent per
 * invoice (event ids `purchase_<id>` / `subscribe_<id>`).
 */
export async function trackVerifiedPayment(opts: {
  invoiceId: string;
  userId: string | null;
  amount: number;
  purpose: "subscription" | "wallet_topup";
  visitor?: VisitorCtx | null;
  planName?: string | null;
}) {
  try {
    const visitor = opts.visitor ?? (await checkoutVisitor(opts.invoiceId));
    if (!visitor) return;
    let email: string | null = null;
    if (opts.userId) {
      const sb = await admin();
      const { data } = await sb.auth.admin.getUserById(opts.userId);
      email = data?.user?.email ?? null;
    }
    const user = { id: opts.userId, email };
    const custom = { content_type: "product", content_name: opts.planName ?? opts.purpose, order_id: opts.invoiceId };
    await sendPlatformEvent({
      event_name: "Purchase",
      event_id: `purchase_${opts.invoiceId}`,
      visitor,
      user,
      value: opts.amount,
      custom_data: custom,
    });
    await sendPlatformEvent({
      event_name: opts.purpose === "wallet_topup" ? "WalletTopup" : "Subscribe",
      event_id: `${opts.purpose === "wallet_topup" ? "topup" : "subscribe"}_${opts.invoiceId}`,
      visitor,
      user,
      value: opts.amount,
      custom_data: custom,
    });
  } catch (e) {
    console.error("[platform-meta] payment tracking failed", (e as Error).message);
  }
}
