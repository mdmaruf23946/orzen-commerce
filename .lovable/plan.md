# Landing pages open as their own app, never inside ORZEN

Today the Merchant Panel "Open" button points to `orzen.top/lp/<slug>`. That URL sits inside the ORZEN platform app's install scope, so on a phone with ORZEN installed Android hands the link to the ORZEN app — you see the ORZEN splash, the ORZEN icon, and the page appears "inside" ORZEN (screenshot 2). Storefronts were already fixed this way; landing pages were not.

## What will change

1. **Every published landing page gets its own web address.**
   On publish, the page is automatically registered on its own host (`<page-slug>.orzen.top` through Cloudflare) unless the merchant already attached a subdomain or custom domain from the central Domains page. That attached domain always wins.

2. **"Open" always opens the page's own address in a new browser tab.**
   The Open / preview-open buttons in the Landing Builder, and the page list, use the landing page's public URL (custom domain → attached subdomain → auto subdomain), with `target="_blank"`. Draft preview keeps using the in-panel preview iframe.

3. **The platform refuses to serve landing pages.**
   A request to `orzen.top/lp/<slug>` is redirected (301) to the page's own host, so even an old bookmark or a link inside the installed ORZEN app leaves the ORZEN app. Preview mode (`?preview=true`) is excluded so the builder preview keeps working.

4. **Each landing page is installable as its own app.**
   On the landing page host we serve a per-page web app manifest built from the page's own data: page title as the app name, the "Page icon" uploaded in Settings/SEO as the app/browser icon, page theme colour, and `start_url`/`scope` at `/`. The page also links its own icon and apple-touch-icon.

5. **Install banner on landing pages.**
   A small "Install" banner appears on the landing page when the browser offers it (same lightweight pattern as the platform banner, dismissible, remembered). It never shows the ORZEN name or icon — only the landing page's own name and icon.

6. **Applies to all future pages automatically.**
   All of the above is driven by the page record itself, so every landing page created from now on behaves the same with no extra setup.

## Technical notes

- New `src/lib/landing-public-url.ts` (server) + a client helper: resolve primary hostname from `store_domains` / `landing_page_domains` where `landing_page_id` matches, else `<slug>.<root_domain>`; on ephemeral hosts (localhost, `*.lovable.app`) keep the `/lp/<slug>` path so development is unaffected.
- `publishLandingPage` in `src/lib/landing-builder.functions.ts` calls the existing `setLandingSubdomain` Cloudflare routine when the page has no attached hostname yet, and returns the resolved public URL.
- `src/server.ts`: add a `/lp/<slug>` → landing host 301 next to the existing `/store/<slug>` rule, skipping `?preview=true`.
- New route `src/routes/lp/$slug/manifest[.]webmanifest.ts` mirroring `store/$slug/manifest[.]webmanifest.ts`, plus `src/lib/landing-manifest.server.ts` (icon from `seo.icon`, fallback to hero/product image).
- Root `manifest.webmanifest` handler: when the host resolves to a landing tenant, serve that page's manifest instead of the platform one (same guard that already exists for stores).
- New `LandingBranding` component (mirror of `StoreBranding`) injects the page manifest link, theme-color and icons; `PlatformInstallPrompt` already skips `/lp/` paths.
- Builder UI (`landing-builder.$id.tsx`) and the landing pages list use the resolved public URL for the Open link.
