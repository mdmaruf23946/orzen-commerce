// Marketing settings server functions — Google + TikTok (Facebook lives in admin.functions.ts).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { facebookSchema, googleSchema, tiktokSchema, saveTrackingSetupSchema } from "@/lib/marketing.schema";

const marketingPerformanceInput = z.object({
  platform: z.enum(["facebook", "google", "tiktok"]),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  compare_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  compare_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const dayStart = (value: string) => `${value}T00:00:00.000+06:00`;
const dayEnd = (value: string) => `${value}T23:59:59.999+06:00`;
const amount = (value: unknown) => Number(value ?? 0) || 0;

/** Strictly one platform's attributed data — never store-wide, never merged. */
export const getMarketingPerformance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => marketingPerformanceInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: store } = await context.supabase
      .from("stores").select("id").eq("owner_user_id", context.userId).maybeSingle();
    if (!store?.id) return null;
    const sb = context.supabase as any;
    const platform = data.platform;

    const load = async (from: string, to: string) => {
      const [v, e, o] = await Promise.all([
        sb.from("marketing_visits").select("visitor_id,session_id,campaign,landing_path")
          .eq("store_id", store.id).eq("platform", platform)
          .gte("created_at", dayStart(from)).lte("created_at", dayEnd(to)).limit(50000),
        sb.from("marketing_events").select("session_id,event_type")
          .eq("store_id", store.id).eq("platform", platform)
          .gte("created_at", dayStart(from)).lte("created_at", dayEnd(to)).limit(100000),
        sb.from("orders").select("phone,subtotal,payment_status,status,attribution_campaign,attribution_session_id")
          .eq("store_id", store.id).eq("attribution_platform", platform)
          .gte("created_at", dayStart(from)).lte("created_at", dayEnd(to)).limit(20000),
      ]);
      return { visits: (v.data ?? []) as any[], events: (e.data ?? []) as any[], orders: ((o.data ?? []) as any[]).filter((r) => r.status !== "cancelled") };
    };

    const summarize = ({ visits, events, orders }: Awaited<ReturnType<typeof load>>) => {
      const visitors = new Set(visits.map((r) => r.visitor_id)).size;
      const sessions = visits.length;
      const purchases = orders.filter((r) =>
        String(r.payment_status ?? "").toLowerCase() === "paid" ||
        ["confirmed", "processing", "shipped", "delivered"].includes(String(r.status ?? ""))).length;
      const revenue = orders.reduce((s, r) => s + amount(r.subtotal), 0);
      const sess = (t: string) => new Set(events.filter((x) => x.event_type === t).map((x) => x.session_id)).size;
      return {
        visitors, sessions,
        pageViews: events.filter((x) => x.event_type === "page_view").length,
        customers: new Set(orders.map((r) => String(r.phone ?? "")).filter(Boolean)).size,
        orders: orders.length, purchases, revenue,
        averageOrderValue: orders.length ? revenue / orders.length : 0,
        conversionRate: sessions ? (orders.length / sessions) * 100 : 0,
        funnel: { visitors, productViews: sess("product_view"), addToCart: sess("add_to_cart"), checkout: sess("checkout"), purchase: orders.length },
      };
    };

    const [cur, prev] = await Promise.all([load(data.from, data.to), load(data.compare_from, data.compare_to)]);

    const camp = new Map<string, { name: string; visitors: Set<string>; orders: number; revenue: number }>();
    const c = (k: string | null) => {
      const name = k || "(no campaign)";
      if (!camp.has(name)) camp.set(name, { name, visitors: new Set(), orders: 0, revenue: 0 });
      return camp.get(name)!;
    };
    cur.visits.forEach((v) => c(v.campaign).visitors.add(v.visitor_id));
    cur.orders.forEach((o) => { const x = c(o.attribution_campaign); x.orders++; x.revenue += amount(o.subtotal); });

    const views = new Map<string, number>();
    cur.events.forEach((e) => e.event_type === "page_view" && views.set(e.session_id, (views.get(e.session_id) ?? 0) + 1));
    const ordered = new Set(cur.orders.map((o) => o.attribution_session_id).filter(Boolean));
    const lp = new Map<string, { path: string; sessions: number; bounces: number; orders: number }>();
    cur.visits.forEach((v) => {
      const path = v.landing_path || "/";
      const x = lp.get(path) ?? { path, sessions: 0, bounces: 0, orders: 0 };
      x.sessions++;
      if ((views.get(v.session_id) ?? 0) <= 1) x.bounces++;
      if (ordered.has(v.session_id)) x.orders++;
      lp.set(path, x);
    });

    return {
      platform,
      current: summarize(cur),
      previous: summarize(prev),
      campaigns: [...camp.values()].map((x) => ({ name: x.name, visitors: x.visitors.size, orders: x.orders, revenue: x.revenue }))
        .sort((a, b) => b.revenue - a.revenue || b.visitors - a.visitors).slice(0, 20),
      landingPages: [...lp.values()].map((x) => ({ path: x.path, sessions: x.sessions, bounceRate: x.sessions ? (x.bounces / x.sessions) * 100 : 0, orders: x.orders }))
        .sort((a, b) => b.sessions - a.sessions).slice(0, 20),
    };
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
