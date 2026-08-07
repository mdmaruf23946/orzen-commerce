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
