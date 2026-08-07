# Marketing Settings — Tabbed Redesign (Facebook | Google | TikTok)

One Marketing page, three tabs under the header. Each platform keeps its own settings, status badge, test action, and Save button — saving one never touches the others.

## Page layout

```text
Marketing
Tracking & analytics for your storefront
[ Facebook ] [ Google ] [ TikTok ]     <- pill tabs (scrollable on mobile)
------------------------------------------------
 platform cards ...
 [ Save Changes ]  [ Test / Send Test Event ]
```

Mobile-first: single-column cards, full-width inputs, sticky-free layout, 44px touch targets, consistent with the existing Store Admin cards.

## Facebook tab

Unchanged functionality — Pixel ID, Pixel on/off, Conversions API token, Test Event Code, status badge (Live / Test Mode / Not configured), Send Test Event, auto-tracked events note. Moved into the tab with its own Save button.

## Google tab

**Google Analytics 4** — enable toggle, Measurement ID (G-XXXXXXX), API Secret (Measurement Protocol, masked), Test Event name, Send Test Event, status badge.

**Google Ads** — enable toggle, Conversion ID (AW-XXXXXXX), Conversion Label, purchase conversion tracking toggle (sends dynamic value, currency and transaction ID from the real order), Test Conversion button.

**Google Tag Manager** — enable toggle, Container ID (GTM-XXXXX), installation status, Verify Installation button (checks the container ID resolves on Google's servers).

Status badges: Connected / Test Mode / Not Configured / Error.

## TikTok tab

**TikTok Pixel** — enable toggle, Pixel ID, connection status.

**Events API** — enable toggle, Access Token (masked), Test Event Code, Send Test Event, server-side tracking.

**Advanced Matching** — master toggle plus email / phone / external ID sub-toggles (hashed before sending).

Deduplication: browser and server events share one generated `event_id`, same mechanism already used for Meta.

## Automatic events

The existing storefront event points (PageView, ViewContent, Search, AddToCart, InitiateCheckout, AddPaymentInfo, Purchase, CompleteRegistration) will fan out to all enabled platforms instead of Facebook only, reusing current product/order data. No new event types are invented.

## Technical notes

- `stores.marketing` (jsonb) keeps holding config; keys are namespaced: existing `fb_*` untouched, new `google: {...}` and `tiktok: {...}` objects. Three server fns — `updateMarketingFacebook`, `updateMarketingGoogle`, `updateMarketingTiktok` — each merge only their own sub-object so saves stay independent.
- Status/test server fns per platform: `getGoogleStatus` / `sendGa4TestEvent` / `sendGoogleAdsTestConversion` / `verifyGtmContainer`, and `getTiktokStatus` / `sendTiktokTestEvent`, mirroring the existing `getFacebookStatus` / `sendFbTestEvent` shape.
- New server helpers `src/lib/ga4-mp.server.ts` (Measurement Protocol `/mp/collect`) and `src/lib/tiktok-events.server.ts` (Events API v1.3 `/event/track/`, SHA-256 hashed matching fields).
- New public bridge routes `api/public/ga4/track` and `api/public/tiktok/track`, same pattern and validation as the existing `api/public/fb-capi/track`.
- `src/lib/fb-track.ts` becomes a generic `track(event, params, opts)` dispatcher: fires `fbq`, `gtag`, and `ttq` for whichever pixels are initialised, then mirrors server-side to enabled platforms with the shared `event_id`. Existing `fbTrack` call sites keep working via a thin alias.
- `TrackingScripts` in `src/routes/store/$slug/route.tsx` gains the Google Ads `AW-` config and initialises `window.__trackInit` with the enabled-platform map.
- UI split into `src/components/admin/marketing/{FacebookTab,GoogleTab,TiktokTab,ui}.tsx`; the route file just renders the tab shell. No DB migration needed.
