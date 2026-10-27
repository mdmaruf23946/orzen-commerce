// Server functions for ORZEN main-website Meta tracking.
// Owner-only admin functions + public pixel config + signed-in account conversions.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (!data) throw new Error("Forbidden");
}

/** Public: just what the browser pixel needs. Never the token. */
export const getPlatformPixelPublic = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { loadPlatformConfig } = await import("./platform-meta.server");
    const cfg = await loadPlatformConfig();
    if (!cfg || !cfg.enabled || !cfg.pixel_enabled || !cfg.pixel_id) return { active: false as const };
    return { active: true as const, pixel_id: cfg.pixel_id, events: cfg.events };
  } catch {
    return { active: false as const };
  }
});

export const getPlatformTracking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await (context.supabase as any)
      .from("platform_meta_tracking")
      .select("enabled,pixel_enabled,capi_enabled,pixel_id,test_event_code,send_user_data,events,updated_at,capi_token_enc")
      .eq("id", 1)
      .maybeSingle();
    const { capi_token_enc, ...rest } = (data ?? {}) as any;
    const { data: log } = await (context.supabase as any)
      .from("platform_meta_events")
      .select("event_name,event_id,source,status,attempts,test_mode,value,error,created_at")
      .neq("event_name", "ctx")
      .order("created_at", { ascending: false })
      .limit(20);
    return { ...rest, has_token: !!capi_token_enc, log: log ?? [] };
  });

export const savePlatformTracking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        enabled: z.boolean(),
        pixel_enabled: z.boolean(),
        capi_enabled: z.boolean(),
        pixel_id: z.string().trim().regex(/^\d{0,20}$/, "Pixel ID must be digits"),
        capi_token: z.string().trim().max(1000).optional(),
        clear_token: z.boolean().optional(),
        test_event_code: z.string().trim().max(40),
        send_user_data: z.boolean(),
        events: z.record(z.string(), z.boolean()),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const patch: Record<string, unknown> = {
      enabled: data.enabled,
      pixel_enabled: data.pixel_enabled,
      capi_enabled: data.capi_enabled,
      pixel_id: data.pixel_id || null,
      test_event_code: data.test_event_code || null,
      send_user_data: data.send_user_data,
      events: data.events,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    };
    if (data.clear_token) patch.capi_token_enc = null;
    else if (data.capi_token) {
      const { encryptJSON } = await import("@/lib/crypto/credentials.server");
      patch.capi_token_enc = encryptJSON({ token: data.capi_token });
    }
    const { error } = await (context.supabase as any).from("platform_meta_tracking").update(patch).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendPlatformTestEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { loadPlatformConfig, sendPlatformEvent, visitorFromHeaders } = await import("./platform-meta.server");
    const cfg = await loadPlatformConfig();
    if (!cfg?.pixel_id || !cfg.token) return { ok: false, message: "Pixel ID ও CAPI token দুটোই সেভ করুন।" };
    if (!cfg.enabled || !cfg.capi_enabled) return { ok: false, message: "Tracking ও CAPI চালু করে সেভ করুন।" };
    const visitor = { ...visitorFromHeaders(getRequest().headers), consent_ok: true };
    const r = await sendPlatformEvent({
      event_name: "PageView",
      event_id: `test_${Date.now()}`,
      visitor,
      user: { id: context.userId },
      testCode: cfg.test_event_code || "TEST_ORZEN",
    });
    return r.status === "sent"
      ? { ok: true, message: "Meta test event পেয়েছে। Events Manager → Test Events-এ দেখুন।" }
      : { ok: false, message: `পাঠানো যায়নি: ${r.reason ?? r.status}` };
  });

/**
 * Signed-in account conversions (signup / store created / trial). Event ids are
 * derived from the user/store so repeats (login again, retries) never double
 * count; the browser fires the same ids for deduplication.
 */
export const trackAccountConversions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().max(2000).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    try {
      const { sendPlatformEvent, visitorFromHeaders } = await import("./platform-meta.server");
      const visitor = visitorFromHeaders(getRequest().headers, data.url);
      const { data: u } = await context.supabase.auth.getUser();
      const user = { id: context.userId, email: u?.user?.email ?? null };
      const { data: store } = await (context.supabase as any)
        .from("stores")
        .select("id,subscription_status,created_at")
        .eq("owner_user_id", context.userId)
        .maybeSingle();
      // Only count accounts created recently, so old merchants signing in are not "new".
      const createdAt = new Date(u?.user?.created_at ?? 0).getTime();
      const fresh = Date.now() - createdAt < 7 * 86400_000;
      const out: { event: string; id: string }[] = [];
      if (fresh) out.push({ event: "CompleteRegistration", id: `reg_${context.userId}` });
      if (store && Date.now() - new Date(store.created_at).getTime() < 7 * 86400_000) {
        out.push({ event: "Lead", id: `store_${store.id}` });
        if (store.subscription_status === "trialing") out.push({ event: "StartTrial", id: `trial_${store.id}` });
      }
      // Return only events sent for the first time now. Already-sent ids must not be
      // re-fired by the browser pixel: Meta deduplicates only within 48h, so repeats
      // on later logins inflated Registration/Trial counts in Ads Manager.
      const fresh_sent: { event: string; id: string }[] = [];
      for (const e of out) {
        const r = await sendPlatformEvent({ event_name: e.event as any, event_id: e.id, visitor, user });
        if (r.status === "sent") fresh_sent.push(e);
      }
      return { events: fresh_sent };
    } catch {
      return { events: [] };
    }
  });
