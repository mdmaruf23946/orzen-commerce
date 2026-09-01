import { createFileRoute } from "@tanstack/react-router";

/** Per-landing-page web app manifest (public: served on the page's own host). */
export const Route = createFileRoute("/api/public/lp-manifest/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { originFromRequest } = await import("@/lib/seo.server");
        const { landingManifestResponse } = await import("@/lib/landing-manifest.server");
        const { origin } = originFromRequest(request);
        const url = new URL(request.url);
        // On the page's own host the app installs at the root; on the platform
        // host (preview) it installs scoped to /lp/<slug>/.
        const startPath = url.searchParams.get("root") === "1" ? "/" : `/lp/${params.slug}/`;
        return landingManifestResponse(params.slug, origin, startPath);
      },
    },
  },
});
