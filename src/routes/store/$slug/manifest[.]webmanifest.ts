import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/** Per-store web app manifest (path-based storefront URL). */
export const Route = createFileRoute("/store/$slug/manifest.webmanifest")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { originFromRequest, slugFromHost } = await import("@/lib/seo.server");
        const { storeManifestResponse } = await import("@/lib/store-manifest.server");
        const { origin, host } = originFromRequest(request);
        const hostSlug = await slugFromHost(host);
        // On a store's own domain the app should install at the domain root.
        const startPath = hostSlug === params.slug ? "/" : `/store/${params.slug}/`;
        return storeManifestResponse(params.slug, origin, startPath);
      },
    },
  },
});
