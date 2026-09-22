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

        let icon192: { url: string; mime?: string | null } | null = null;
        let icon512: { url: string; mime?: string | null } | null = null;
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
              icon192 = assets?.appIcon192?.url
                ? assets.appIcon192
                : assets?.favicon?.url
                  ? assets.favicon
                  : null;
              icon512 = assets?.appIcon512?.url ? assets.appIcon512 : null;
              if (typeof b?.combo?.themeColor === "string") themeColor = b.combo.themeColor;
            }
          }
        } catch {
          // Branding is optional — a manifest without icons still installs.
        }

        // Manifest icons become the installed app's Home Screen icon. Keep each
        // dedicated App Icon at its real declared size; never substitute a splash.
        const icons = [
          icon192 && {
            src: icon192.url,
            sizes: "192x192",
            type: icon192.mime || "image/png",
            purpose: "any",
          },
          icon512 && {
            src: icon512.url,
            sizes: "512x512",
            type: icon512.mime || "image/png",
            purpose: "any",
          },
        ].filter((icon): icon is NonNullable<typeof icon> => Boolean(icon));


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
