import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { originFromRequest, slugFromHost, storeBySlug } = await import("@/lib/seo.server");
        const { buildRobotsTxt } = await import("@/lib/seo");
        const { host, origin } = originFromRequest(request);
        const slug = await slugFromHost(host);

        if (!slug) {
          return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`, {
            headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" },
          });
        }

        const store = await storeBySlug(slug);
        const seo = (store?.seo ?? {}) as any;
        const body = buildRobotsTxt({
          origin: (seo.canonical_url || origin).replace(/\/$/, ""),
          noindex: seo.noindex === true,
          sitemapEnabled: seo.sitemap_enabled !== false,
          extra: seo.robots_extra ?? null,
        });
        return new Response(body, {
          headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
