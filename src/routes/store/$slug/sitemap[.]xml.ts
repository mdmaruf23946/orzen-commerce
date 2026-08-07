import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/store/$slug/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { originFromRequest, sitemapData, renderSitemap } = await import("@/lib/seo.server");
        const { origin } = originFromRequest(request);
        const data = await sitemapData(params.slug);
        if (!data) return new Response("Not found", { status: 404 });
        const seo = (data.store?.seo ?? {}) as any;
        if (seo.sitemap_enabled === false || seo.noindex === true) {
          return new Response("Not found", { status: 404 });
        }
        const base = (seo.canonical_url || `${origin}/store/${params.slug}`).replace(/\/$/, "");
        return new Response(renderSitemap(origin, base, data), {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
