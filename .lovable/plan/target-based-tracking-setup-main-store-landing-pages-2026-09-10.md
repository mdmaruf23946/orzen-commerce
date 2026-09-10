# Target-based Tracking Setup (Main Store + Landing Pages)

Turn the single tracking configuration into one setup per target per platform, without removing any existing Facebook, Google or TikTok functionality.

## New "Tracking Setup" section

Sits at the top of the Marketing page, above the existing Facebook / Google / TikTok tabs.

```text
Tracking Setup
Target:    [ Main Store            v ]     <- landing pages listed only if any exist
Platform:  [ Facebook ][ Google ][ TikTok ]
--- fields change with platform ---
Status:    ( Active / Inactive )
[ Save Tracking Setup ]
```

Fields per platform:
- Facebook: Pixel ID, Conversions API Access Token, Test Event Code
- Google: Google Tag ID / GA4 Measurement ID
- TikTok: Pixel ID, Access Token

Compact, single-column, mobile-friendly cards matching the current Merchant Panel style. Each platform saves on its own; switching target or platform loads that setup's saved values and shows a small status chip (Active / Inactive / Not configured).

The Target dropdown lists "Main Store" plus every landing page actually created for that store. With no landing pages, only Main Store shows.

## Behaviour

- Main Store → Facebook + Google + TikTok, and each landing page → Facebook + Google + TikTok, all live at once.
- Saving the Main Store setup keeps the existing advanced tabs in sync (same Pixel ID, CAPI token, GA4 ID, TikTok credentials), so nothing merchants already configured is lost or duplicated.
- A landing page with no setup of its own falls back to the Main Store setup, so today's behaviour is unchanged until someone configures the page separately.
- Inactive means the pixel does not load and no server-side events are sent for that target/platform.

## Technical notes

- Storage stays in `stores.marketing` (jsonb). New `targets` object: `targets.main` and `targets["<landing_page_id>"]`, each holding `{ facebook: {...}, google: {...}, tiktok: {...} }` with an `active` flag. Existing `fb_*`, `google.*`, `tiktok.*` keys stay authoritative for Main Store and are mirrored on save, so the storefront scripts, CAPI/GA4/TikTok bridges and test buttons keep working untouched.
- New client-safe schema `trackingTargetSchema` in `src/lib/marketing.schema.ts`; new server fns `getTrackingSetup` / `saveTrackingSetup` (target + platform scoped merge) in `src/lib/marketing.functions.ts`, reusing `saveMarketingNamespace` semantics in `src/lib/marketing.server.ts`. Landing page options come from the existing `listLandingPages`.
- New UI: `src/components/admin/marketing/TrackingSetup.tsx`, rendered by `src/routes/_authenticated/admin/marketing.tsx` above the existing tabs. Existing `FacebookTab`, `GoogleTab`, `TiktokTab` unchanged.
- Landing page pixels: `src/routes/lp.$slug.tsx` gains the same script-injection block used by the storefront, resolving the page's own target config with Main Store fallback; public bridges `api/public/fb-capi/track`, `api/public/ga4/track`, `api/public/tiktok/track` accept an optional `landing_page_id` and pick that target's credentials.
- Plan gating (`pixel` feature) and existing validation rules stay as they are. No database migration required.
