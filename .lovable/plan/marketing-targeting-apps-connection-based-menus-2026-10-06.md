# Marketing & Targeting Apps — connection-based menus

Same pattern as Call & SMS Apps: one hub page always visible, and each platform gets its own sidebar menu only while it is connected.

## Sidebar (Marketing & Sales)

```text
MARKETING & SALES
├── Marketing & Targeting Apps      (always)
├── Facebook Marketing              (only when connected)
├── Google Marketing                (only when connected)
└── TikTok Marketing                (only when connected)
```

- Facebook: Overview, Integration, Tracking & Pixel, Conversions API, Events, Audiences, Attribution, Settings
- Google: Overview, Integration, Google Ads, Conversion Tracking, Audiences, Settings
- TikTok: Overview, Integration, Pixel, Events, Conversion Tracking, Settings
- Every sub-menu gets its own matching icon.

## What "connected" means
- Facebook: Pixel ID saved and turned on.
- Google: GA4 / Google Ads / GTM ID saved and turned on.
- TikTok: Pixel ID saved and turned on.
Turning it off or clearing the ID = disconnected, so the menu disappears and the card in the hub shows "Connect" again.

## Hub page — Marketing & Targeting Apps
Three cards (Facebook, Google, TikTok) with Connected / Not connected badge and a "Connect / Setup" or "Manage" button. The existing Main Store / Landing Page tracking setup stays on this page.

## Platform workspaces
- Existing settings are moved, not rewritten: Facebook Pixel, CAPI token, test events; Google GA4, Ads conversion, GTM; TikTok Pixel, Events API, advanced matching. Each saves only its own platform.
- Overview: status, IDs, last test result.
- Events: the automatic events list (PageView, AddToCart, Purchase…) for that platform.
- Audiences / Attribution: no real data source exists yet, so these show an honest "Not available yet" note instead of fake numbers.
- Old link `/admin/marketing` redirects to the hub, so nothing breaks.

## Technical details
- New `src/lib/marketing-platforms.ts` registry (id, name, path, sections with icons, setupSection) + `useMarketingConnections()` deriving connection from `stores.marketing` via existing `getMyStore` query.
- Routes: `admin/marketing.apps.tsx` (hub), `admin/marketing.facebook.tsx`, `marketing.google.tsx`, `marketing.tiktok.tsx` using `?tab=` search param like the ePBX workspace; `admin/marketing.tsx` becomes a redirect/layout.
- Split current `FacebookTab/GoogleTab/TiktokTab` into section components; reuse existing server functions — no database change.
- `admin/route.tsx`: Marketing & Sales group builds platform items dynamically from the registry, same as `providerItems` for Call & SMS. Record rule in `AGENTS.md`.
- Preview check, then live deploy to orzen.top only when asked (wrangler script).
