import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/**
 * Platform (orzen.top) web app manifest.
 *
 * Scope isolation: this manifest is only served on platform hosts. On a store
 * subdomain / custom domain the request 404s, so a storefront can never install
 * the platform app — stores ship their own manifest from <StoreBranding />.
 */
export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { originFromRequest, hostTargetFromHost } = await import("@/lib/seo.server");
        const { host, origin } = originFromRequest(request);
        const target = await hostTargetFromHost(host);
        if (target?.kind === "store") {
          // Store domain: serve that store's own installable manifest.
          const { storeManifestResponse } = await import("@/lib/store-manifest.server");
          return storeManifestResponse(target.slug, origin, "/");
        }
        if (target?.kind === "landing") {
          // Landing-page domain: serve that page's own installable manifest.
          const { landingManifestResponse } = await import("@/lib/landing-manifest.server");
          return landingManifestResponse(target.slug, origin, "/");
        }

        let icon192: string | null = null;
        let icon512: string | null = null;
        let splash: string | null = null;
        let themeColor = "#0f172a";
        try {
          const url = process.env["SUPABASE_URL"];
          const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
          if (url && key) {
            const res = await fetch(`${url}/rest/v1/rpc/get_platform_branding`, {
              method: "POST",
              headers: { "content-type": "application/json", apikey: key },
              body: "{}",
            });
            if (res.ok) {
              const b = (await res.json()) as any;
              const assets = b?.assets ?? {};
              icon192 = assets?.appIcon192?.url ?? assets?.favicon?.url ?? null;
              icon512 = assets?.appIcon512?.url ?? assets?.primaryLogo?.url ?? icon192;
              splash = assets?.launchSplashLogo?.url ?? null;
              if (typeof b?.combo?.themeColor === "string") themeColor = b.combo.themeColor;
            }
          }
        } catch {
          // Branding is optional — a manifest without icons still installs.
        }

        // Chrome renders its own native launch screen before website code starts.
        // Use the dedicated launch upload for every native splash candidate and do
        // not render another website overlay, otherwise Android shows two screens.
        const nativeLaunchIcon = splash ?? icon512 ?? icon192;
        const icons = nativeLaunchIcon
          ? [
              { src: nativeLaunchIcon, sizes: "192x192", purpose: "any" },
              // A transparent splash must not be declared maskable: Android fills
              // the transparent safe-zone with a rounded black app-icon plate.
              { src: nativeLaunchIcon, sizes: "512x512", purpose: "any" },
            ]
          : [];


        const manifest = {
          id: "/",
          name: "ORZEN - Smart Commerce",
          short_name: "ORZEN",
          description:
            "Launch, run, and grow your online store with ORZEN — stores, AI sales agents, couriers, payments and analytics in one platform.",
          start_url: "/",
          scope: "/",
          display: "standalone",
          orientation: "portrait",
          background_color: "#ffffff",
          theme_color: themeColor,
          categories: ["business", "shopping", "productivity"],
          icons,
        };

        return new Response(JSON.stringify(manifest), {
          headers: {
            "Content-Type": "application/manifest+json; charset=utf-8",
            "Cache-Control": "no-cache, max-age=0, must-revalidate",
          },
        });
      },
    },
  },
});
