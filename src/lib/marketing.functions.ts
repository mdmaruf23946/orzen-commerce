// Marketing settings server functions — Google + TikTok (Facebook lives in admin.functions.ts).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { facebookSchema, googleSchema, tiktokSchema, saveTrackingSetupSchema } from "@/lib/marketing.schema";

const marketingPerformanceInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  compare_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  compare_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const dayStart = (value: string) => `${value}T00:00:00.000Z`;
const dayEnd = (value: string) => `${value}T23:59:59.999Z`;
const amount = (value: unknown) => Number(value ?? 0) || 0;

/** Store results only. No platform attribution is implied because it is not recorded yet. */
export const getMarketingPerformance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => marketingPerformanceInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: store } = await context.supabase
      .from("stores")
      .select("id")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (!store?.id) return null;

    const read = (from: string, to: string) =>
      context.supabase
        .from("orders")
        .select("phone,subtotal,payment_status,status")
        .eq("store_id", store.id)
        .gte("created_at", dayStart(from))
        .lte("created_at", dayEnd(to))
        .limit(20000);
    const [{ data: current }, { data: previous }] = await Promise.all([
      read(data.from, data.to),
      read(data.compare_from, data.compare_to),
    ]);

    const summarize = (rows: any[] | null) => {
      const all = rows ?? [];
      const orders = all.filter((row) => row.status !== "cancelled");
      const purchases = orders.filter((row) =>
        String(row.payment_status ?? "").toLowerCase() === "paid" ||
        ["confirmed", "processing", "shipped", "delivered"].includes(String(row.status ?? "")),
      ).length;
      const revenue = orders.reduce((sum, row) => sum + amount(row.subtotal), 0);
      return {
        customers: new Set(orders.map((row) => String(row.phone ?? "")).filter(Boolean)).size,
        orders: orders.length,
        purchases,
        revenue,
        averageOrderValue: orders.length ? revenue / orders.length : 0,
        purchaseRate: orders.length ? (purchases / orders.length) * 100 : 0,
      };
    };

    return { current: summarize(current), previous: summarize(previous) };
  });

export const updateMarketingGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => googleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { assertPlan } = await import("@/lib/plan-guard");
    await assertPlan(context.supabase, context.userId, "pixel");
    const { saveMarketingNamespace } = await import("@/lib/marketing.server");
    return saveMarketingNamespace(context.supabase, context.userId, "google", data as Record<string, unknown>);
  });

export const updateMarketingTiktok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => tiktokSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { assertPlan } = await import("@/lib/plan-guard");
    await assertPlan(context.supabase, context.userId, "pixel");
    const { saveMarketingNamespace } = await import("@/lib/marketing.server");
    return saveMarketingNamespace(context.supabase, context.userId, "tiktok", data as Record<string, unknown>);
  });

export const getGoogleStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOwnerMarketing } = await import("@/lib/marketing.server");
    const { marketing } = await loadOwnerMarketing(context.supabase, context.userId);
    const g: any = marketing.google ?? {};
    const ga4Id = g.ga4_id || marketing.ga4_id || "";
    const gtmId = g.gtm_id || marketing.gtm_id || "";
    return {
      ga4: {
        configured: !!ga4Id,
        enabled: !!g.ga4_enabled && !!ga4Id,
        server_side: !!g.ga4_api_secret,
        id: ga4Id || null,
      },
      ads: {
        configured: !!g.ads_conversion_id,
        enabled: !!g.ads_enabled && !!g.ads_conversion_id,
        id: g.ads_conversion_id || null,
        label: g.ads_conversion_label || null,
      },
      gtm: { configured: !!gtmId, enabled: !!g.gtm_enabled && !!gtmId, id: gtmId || null },
    };
  });

export const getTiktokStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOwnerMarketing } = await import("@/lib/marketing.server");
    const { marketing } = await loadOwnerMarketing(context.supabase, context.userId);
    const t: any = marketing.tiktok ?? {};
    const pixelId = t.pixel_id || marketing.tiktok_pixel_id || "";
    const eventsApi = !!t.events_api_enabled && !!t.access_token;
    return {
      pixel: { configured: !!pixelId, enabled: !!t.pixel_enabled && !!pixelId, id: pixelId || null },
      events_api: { configured: !!t.access_token, enabled: eventsApi },
      mode: (t.test_event_code ? "test" : eventsApi ? "live" : "off") as "test" | "live" | "off",
      test_event_code: t.test_event_code || null,
    };
  });

export const sendGa4TestEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOwnerMarketing } = await import("@/lib/marketing.server");
    const { marketing } = await loadOwnerMarketing(context.supabase, context.userId);
    const g: any = marketing.google ?? {};
    const id = g.ga4_id || marketing.ga4_id;
    if (!id || !g.ga4_api_secret) {
      return { ok: false as const, error: "Measurement ID and API secret are required.", mode: "debug" as const };
    }
    const { sendGa4Events } = await import("@/lib/ga4-mp.server");
    return sendGa4Events({
      measurementId: id,
      apiSecret: g.ga4_api_secret,
      clientId: `${Math.floor(Math.random() * 1e10)}.${Math.floor(Date.now() / 1000)}`,
      userId: context.userId,
      debug: true,
      events: [{ name: g.ga4_test_event || "test_event", params: { engagement_time_msec: 100, debug_mode: 1 } }],
    });
  });

export const sendGoogleAdsTestConversion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOwnerMarketing } = await import("@/lib/marketing.server");
    const { marketing } = await loadOwnerMarketing(context.supabase, context.userId);
    const g: any = marketing.google ?? {};
    if (!g.ads_conversion_id || !g.ads_conversion_label) {
      return { ok: false as const, error: "Conversion ID and label are required." };
    }
    if (!/^AW-\d{6,15}$/i.test(g.ads_conversion_id)) {
      return { ok: false as const, error: "Conversion ID must look like AW-123456789." };
    }
    // Google Ads conversions are browser-side (gtag). Validate the tag is reachable.
    const r = await fetch(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(g.ads_conversion_id)}`);
    if (!r.ok) return { ok: false as const, error: `Conversion tag not reachable (HTTP ${r.status}).` };
    const body = await r.text();
    if (body.length < 200) return { ok: false as const, error: "Conversion ID not recognised by Google." };
    return {
      ok: true as const,
      message: `Tag ${g.ads_conversion_id} is live. A test conversion (${g.ads_conversion_label}) will fire from the storefront on the next purchase.`,
    };
  });

export const verifyGtmInstallation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOwnerMarketing } = await import("@/lib/marketing.server");
    const { marketing } = await loadOwnerMarketing(context.supabase, context.userId);
    const g: any = marketing.google ?? {};
    const id = g.gtm_id || marketing.gtm_id;
    if (!id) return { ok: false as const, error: "Container ID is required." };
    const { verifyGtmContainerId } = await import("@/lib/ga4-mp.server");
    const res = await verifyGtmContainerId(id);
    return res.ok ? { ok: true as const, message: `Container ${id} verified.` } : { ok: false as const, error: res.error ?? "Verification failed" };
  });

export const sendTiktokTestEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOwnerMarketing } = await import("@/lib/marketing.server");
    const { marketing, store } = await loadOwnerMarketing(context.supabase, context.userId);
    const t: any = marketing.tiktok ?? {};
    const pixelId = t.pixel_id || marketing.tiktok_pixel_id;
    if (!pixelId || !t.access_token) {
      return { ok: false as const, error: "Pixel ID and access token are required.", mode: "test" as const };
    }
    const { sendTiktokEvents } = await import("@/lib/tiktok-events.server");
    return sendTiktokEvents({
      pixelCode: pixelId,
      accessToken: t.access_token,
      testEventCode: t.test_event_code || null,
      matching: { email: t.match_email, phone: t.match_phone, external_id: t.match_external_id },
      events: [
        {
          event: "ViewContent",
          event_id: `test-${Date.now()}`,
          page_url: `https://orzen.top/store/${store?.slug ?? ""}`,
          user_data: { external_id: context.userId },
        },
      ],
    });
  });

export const updateMarketingFacebook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => facebookSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { assertPlan } = await import("@/lib/plan-guard");
    await assertPlan(context.supabase, context.userId, "pixel");
    const { saveMarketingNamespace } = await import("@/lib/marketing.server");
    return saveMarketingNamespace(context.supabase, context.userId, null, data as Record<string, unknown>);
  });

// ---------------------------------------------------------------------------
// Target-based tracking setup (Main Store + Landing Pages)
// ---------------------------------------------------------------------------

export const getTrackingSetups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOwnerMarketing, readTrackingTargets } = await import("@/lib/marketing.server");
    const { marketing, store } = await loadOwnerMarketing(context.supabase, context.userId);
    let pages: { id: string; title: string; slug: string }[] = [];
    if (store?.id) {
      const { data } = await context.supabase
        .from("landing_pages")
        .select("id,title,slug")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false });
      pages = (data ?? []) as any;
    }
    return { targets: readTrackingTargets(marketing), pages };
  });

export const saveTrackingSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => saveTrackingSetupSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { assertPlan } = await import("@/lib/plan-guard");
    await assertPlan(context.supabase, context.userId, "pixel");
    const { saveTrackingTarget } = await import("@/lib/marketing.server");
    return saveTrackingTarget(
      context.supabase,
      context.userId,
      data.target,
      data.platform,
      data.config as Record<string, unknown>,
    );
  });

/** Public, browser-safe pixel IDs for one landing page (no server tokens). */
export const getLandingTracking = createServerFn({ method: "GET" })
  .inputValidator((d: { landing_page_id: string }) =>
    z.object({ landing_page_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: page } = await supabaseAdmin
      .from("landing_pages")
      .select("id, store_id")
      .eq("id", data.landing_page_id)
      .maybeSingle();
    if (!page) return null;
    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("slug, marketing")
      .eq("id", (page as any).store_id)
      .maybeSingle();
    if (!store) return null;
    const { readTrackingTargets } = await import("@/lib/marketing.server");
    const targets = readTrackingTargets((store as any).marketing);
    const t = targets[data.landing_page_id] ?? targets.main ?? {};
    const fb: any = t.facebook ?? {};
    const g: any = t.google ?? {};
    const tt: any = t.tiktok ?? {};
    return {
      store_slug: (store as any).slug as string,
      fb_pixel_id: fb.active && fb.pixel_id ? String(fb.pixel_id) : null,
      fb_server: !!(fb.active && fb.capi_token),
      google_tag_id: g.active && g.tag_id ? String(g.tag_id) : null,
      google_server: !!(g.active && g.tag_id && ((store as any).marketing?.google?.ga4_api_secret)),
      tiktok_pixel_id: tt.active && tt.pixel_id ? String(tt.pixel_id) : null,
      tiktok_server: !!(tt.active && tt.access_token),
    };
  });
