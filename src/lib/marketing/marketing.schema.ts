// Client-safe schemas + defaults for the Marketing settings page.
import { z } from "zod";

export const googleSchema = z.object({
  ga4_enabled: z.boolean().optional(),
  ga4_id: z.string().trim().max(40).optional().nullable(),
  ga4_api_secret: z.string().trim().max(200).optional().nullable(),
  ga4_test_event: z.string().trim().max(60).optional().nullable(),
  ads_enabled: z.boolean().optional(),
  ads_conversion_id: z.string().trim().max(40).optional().nullable(),
  ads_conversion_label: z.string().trim().max(60).optional().nullable(),
  ads_purchase_tracking: z.boolean().optional(),
  gtm_enabled: z.boolean().optional(),
  gtm_id: z.string().trim().max(40).optional().nullable(),
});

export const tiktokSchema = z.object({
  pixel_enabled: z.boolean().optional(),
  pixel_id: z.string().trim().max(60).optional().nullable(),
  events_api_enabled: z.boolean().optional(),
  access_token: z.string().trim().max(400).optional().nullable(),
  test_event_code: z.string().trim().max(60).optional().nullable(),
  match_enabled: z.boolean().optional(),
  match_email: z.boolean().optional(),
  match_phone: z.boolean().optional(),
  match_external_id: z.boolean().optional(),
});

export type GoogleConfig = z.infer<typeof googleSchema>;
export type TiktokConfig = z.infer<typeof tiktokSchema>;

export const googleDefaults: Required<{ [K in keyof GoogleConfig]: NonNullable<GoogleConfig[K]> }> = {
  ga4_enabled: false,
  ga4_id: "",
  ga4_api_secret: "",
  ga4_test_event: "test_event",
  ads_enabled: false,
  ads_conversion_id: "",
  ads_conversion_label: "",
  ads_purchase_tracking: true,
  gtm_enabled: false,
  gtm_id: "",
};

export const tiktokDefaults: Required<{ [K in keyof TiktokConfig]: NonNullable<TiktokConfig[K]> }> = {
  pixel_enabled: false,
  pixel_id: "",
  events_api_enabled: false,
  access_token: "",
  test_event_code: "",
  match_enabled: true,
  match_email: true,
  match_phone: true,
  match_external_id: true,
};

export const GA4_ID_RE = /^G-[A-Z0-9]{4,15}$/i;
export const ADS_ID_RE = /^AW-\d{6,15}$/i;
export const GTM_ID_RE = /^GTM-[A-Z0-9]{4,10}$/i;
export const TT_PIXEL_RE = /^[A-Z0-9]{10,30}$/i;

export type PlatformStatus = "connected" | "test" | "not_configured" | "error";

export const facebookSchema = z
  .object({
    fb_pixel_id: z.string().trim().max(60).optional().nullable(),
    fb_pixel_enabled: z.boolean().optional(),
    fb_capi_token: z.string().trim().max(300).optional().nullable(),
    fb_capi_enabled: z.boolean().optional(),
    fb_test_event_code: z.string().trim().max(40).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.fb_pixel_id && !/^\d{15,17}$/.test(v.fb_pixel_id)) {
      ctx.addIssue({ code: "custom", path: ["fb_pixel_id"], message: "Facebook Pixel ID must be 15–17 digits" });
    }
    if (v.fb_capi_enabled && (!v.fb_capi_token || v.fb_capi_token.length < 40)) {
      ctx.addIssue({ code: "custom", path: ["fb_capi_token"], message: "CAPI access token looks too short" });
    }
    if (v.fb_test_event_code && !/^[A-Za-z0-9_-]{4,40}$/.test(v.fb_test_event_code)) {
      ctx.addIssue({ code: "custom", path: ["fb_test_event_code"], message: "Invalid test event code" });
    }
  });

export type FacebookConfig = z.infer<typeof facebookSchema>;

export const facebookDefaults = {
  fb_pixel_id: "",
  fb_pixel_enabled: true,
  fb_capi_token: "",
  fb_capi_enabled: false,
  fb_test_event_code: "",
};

// ---------------------------------------------------------------------------
// Target-based tracking setup (Main Store + individual Landing Pages)
// ---------------------------------------------------------------------------

export const TRACKING_PLATFORMS = ["facebook", "google", "tiktok"] as const;
export type TrackingPlatform = (typeof TRACKING_PLATFORMS)[number];

/** "main" or a landing page uuid. */
export const trackingTargetKey = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((v) => v === "main" || /^[0-9a-f-]{36}$/i.test(v), "Invalid target");

export const trackingFacebookSchema = z.object({
  active: z.boolean().optional(),
  pixel_id: z.string().trim().max(60).optional().nullable(),
  capi_token: z.string().trim().max(400).optional().nullable(),
  test_event_code: z.string().trim().max(60).optional().nullable(),
});

export const trackingGoogleSchema = z.object({
  active: z.boolean().optional(),
  tag_id: z.string().trim().max(60).optional().nullable(),
});

export const trackingTiktokSchema = z.object({
  active: z.boolean().optional(),
  pixel_id: z.string().trim().max(60).optional().nullable(),
  access_token: z.string().trim().max(400).optional().nullable(),
});

export const saveTrackingSetupSchema = z.discriminatedUnion("platform", [
  z.object({ target: trackingTargetKey, platform: z.literal("facebook"), config: trackingFacebookSchema }),
  z.object({ target: trackingTargetKey, platform: z.literal("google"), config: trackingGoogleSchema }),
  z.object({ target: trackingTargetKey, platform: z.literal("tiktok"), config: trackingTiktokSchema }),
]);

export type TrackingFacebook = z.infer<typeof trackingFacebookSchema>;
export type TrackingGoogle = z.infer<typeof trackingGoogleSchema>;
export type TrackingTiktok = z.infer<typeof trackingTiktokSchema>;

export const trackingDefaults = {
  facebook: { active: false, pixel_id: "", capi_token: "", test_event_code: "" },
  google: { active: false, tag_id: "" },
  tiktok: { active: false, pixel_id: "", access_token: "" },
} as const;

export const GOOGLE_TAG_RE = /^(G-[A-Z0-9]{4,15}|AW-\d{6,15}|GT-[A-Z0-9]{4,15})$/i;
