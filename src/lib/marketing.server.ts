import { myStoreRow } from "@/lib/store-access";
// Server-only helpers for the Marketing settings module.
export async function loadOwnerMarketing(supabase: any, userId: string) {
  const data = await myStoreRow(supabase, userId, "id, slug, marketing", "marketing");
  return {
    store: data as { id: string; slug: string; marketing: any } | null,
    marketing: (data as any)?.marketing ?? {},
  };
}

/** Merge a patch into one namespace of stores.marketing without touching siblings. */
export async function saveMarketingNamespace(
  supabase: any,
  userId: string,
  namespace: string | null,
  patch: Record<string, unknown>,
) {
  const { marketing } = await loadOwnerMarketing(supabase, userId);
  const next = namespace
    ? { ...marketing, [namespace]: { ...(marketing?.[namespace] ?? {}), ...patch } }
    : { ...marketing, ...patch };
  const { error } = await supabase.from("stores").update({ marketing: next }).eq("owner_user_id", userId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/** Mirror a Main-Store tracking setup onto the legacy top-level marketing keys. */
function mirrorMainTarget(marketing: any, platform: string, cfg: any) {
  const next = { ...marketing };
  if (platform === "facebook") {
    next.fb_pixel_id = cfg.pixel_id ?? "";
    next.fb_pixel_enabled = !!cfg.active && !!cfg.pixel_id;
    next.fb_capi_token = cfg.capi_token ?? "";
    next.fb_capi_enabled = !!cfg.active && !!cfg.capi_token;
    next.fb_test_event_code = cfg.test_event_code ?? "";
    next.enabled = { ...(marketing.enabled ?? {}), fb_pixel: !!cfg.active };
  } else if (platform === "google") {
    const id = String(cfg.tag_id ?? "").trim();
    const isAds = /^AW-/i.test(id);
    const google = { ...(marketing.google ?? {}) };
    if (isAds) {
      google.ads_enabled = !!cfg.active;
      google.ads_conversion_id = id;
    } else {
      google.ga4_enabled = !!cfg.active && !!id;
      google.ga4_id = id;
      next.ga4_id = id;
    }
    next.google = google;
    next.enabled = { ...(marketing.enabled ?? {}), ga4: !!cfg.active };
  } else if (platform === "tiktok") {
    const tiktok = { ...(marketing.tiktok ?? {}) };
    tiktok.pixel_id = cfg.pixel_id ?? "";
    tiktok.pixel_enabled = !!cfg.active && !!cfg.pixel_id;
    tiktok.access_token = cfg.access_token ?? "";
    tiktok.events_api_enabled = !!cfg.active && !!cfg.access_token;
    next.tiktok = tiktok;
    next.tiktok_pixel_id = cfg.pixel_id ?? "";
    next.enabled = { ...(marketing.enabled ?? {}), tiktok: !!cfg.active };
  }
  return next;
}

/** Save one platform setup for one target ("main" or a landing page id). */
export async function saveTrackingTarget(
  supabase: any,
  userId: string,
  target: string,
  platform: string,
  cfg: Record<string, unknown>,
) {
  const { marketing } = await loadOwnerMarketing(supabase, userId);
  const targets = { ...(marketing?.targets ?? {}) };
  targets[target] = { ...(targets[target] ?? {}), [platform]: cfg };
  let next: any = { ...marketing, targets };
  if (target === "main") next = { ...mirrorMainTarget(next, platform, cfg), targets };
  const { error } = await supabase.from("stores").update({ marketing: next }).eq("owner_user_id", userId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/** Read the stored setups, deriving the Main Store setup from legacy keys when absent. */
export function readTrackingTargets(marketing: any) {
  const m = marketing ?? {};
  const targets = { ...(m.targets ?? {}) };
  const g = m.google ?? {};
  const tt = m.tiktok ?? {};
  const legacyMain = {
    facebook: {
      active: !!m.fb_pixel_id && m.fb_pixel_enabled !== false,
      pixel_id: m.fb_pixel_id ?? "",
      capi_token: m.fb_capi_token ?? "",
      test_event_code: m.fb_test_event_code ?? "",
    },
    google: {
      active: !!(g.ga4_enabled && (g.ga4_id || m.ga4_id)) || !!(g.ads_enabled && g.ads_conversion_id),
      tag_id: g.ga4_id || m.ga4_id || g.ads_conversion_id || "",
    },
    tiktok: {
      active: !!(tt.pixel_enabled && tt.pixel_id),
      pixel_id: tt.pixel_id || m.tiktok_pixel_id || "",
      access_token: tt.access_token ?? "",
    },
  };
  const main = targets.main ?? {};
  targets.main = {
    facebook: main.facebook ?? legacyMain.facebook,
    google: main.google ?? legacyMain.google,
    tiktok: main.tiktok ?? legacyMain.tiktok,
  };
  return targets as Record<string, Record<string, any>>;
}
