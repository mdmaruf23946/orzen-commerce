# Platform-attributed Marketing Overview (Facebook / Google / TikTok)

## Current state
- Overview now shows store-wide orders/revenue (not attributed) — must be replaced.
- The storefront does not record where visitors come from. Only orders from external landing-page webhooks save `utm` + `fbclid`. There is no visitor/session log.
- So true per-platform numbers need new tracking first. Old orders have no source, so history starts from the day this goes live (shown clearly, never estimated).

## What the merchant will see
Each connected platform's Overview shows ONLY its own data:
- Date filter: Today / Yesterday / 7 Days / 30 Days / Custom, with previous-period comparison.
- Cards: Visitors, Sessions, Customers, Orders, Purchases, Revenue, Conversion rate, Avg. order value.
- Funnel: Visitors → Product Views → Add to Cart → Checkout → Purchase.
- Campaigns table (from `utm_campaign` / ad IDs in the link) with visitors, orders, revenue.
- Top landing pages table with visitors, bounce, orders.
- Empty-state note when no attributed data yet. Store-wide totals are removed.
- Direct / typed-in / unrelated traffic is never counted.

## Attribution rules
```text
Facebook : fbclid, or utm_source in (facebook, fb, meta, instagram, ig), or referrer facebook.com / instagram.com / m.me
Google   : gclid / gbraid / wbraid, or utm_source=google, or referrer google.*
TikTok   : ttclid, or utm_source=tiktok, or referrer tiktok.com
Other    : not shown in any platform Overview
```
Last non-direct click within 30 days wins; a direct return visit keeps the earlier platform. An order belongs to exactly one platform, so numbers never overlap.

## Steps
1. Database: new `marketing_visits` (store, visitor id, session id, platform, campaign, ad/click id, landing path, referrer, timestamps) and `marketing_events` (session, type: page_view/product_view/add_to_cart/checkout/purchase). Add `attribution_platform`, `attribution_campaign`, `attribution_session_id` to `orders`. RLS: insert only via server; read only by store owner/staff of that store.
2. Storefront + store landing pages: small first-party tracker captures click IDs/UTM/referrer on arrival, keeps a 30-day visitor id, logs funnel events through a public endpoint that validates the store and rate-limits by visitor.
3. Order creation (checkout, landing webhook, chat orders keep "none"): stamp the attribution fields. Landing-webhook orders map their existing `utm/fbclid`.
4. Server function `getPlatformOverview(platform, range)` — store-scoped, filters by that single platform.
5. Replace `PlatformOverview` with the new cards, funnel, campaigns and landing-page tables; add Custom date range.
6. Privacy policy: mention first-party visit tracking for marketing measurement.
7. Verify in preview with test visits (`?fbclid=…`, `?utm_source=google`, `?ttclid=…`) and confirm each lands only in its own Overview; then typecheck and deploy to orzen.top with the wrangler procedure (migration applied to production database too).

## Technical notes
- Platform data never read from `stores.marketing`; ORZEN platform Meta tracking stays separate.
- Ad-spend/CPC from Meta/Google/TikTok Ads APIs is not connected; campaign table shows store-side results only and says "Ad spend not available" instead of fake values.
- Tracker respects existing cookie/consent handling; no customer identifiers stored in visit rows.
