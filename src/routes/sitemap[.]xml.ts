import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { originFromRequest, slugFromHost, sitemapData, renderSitemap } = await import(
          "@/lib/seo.server"
        );
        const { host, origin } = originFromRequest(request);
        const slug = await slugFromHost(host);

        if (!slug) {
          const xml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            `  <url><loc>${origin}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
            "</urlset>",
          ].join("\n");
          return new Response(xml, {
            headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
          });
        }

        const data = await sitemapData(slug);
        if (!data) return new Response("Not found", { status: 404 });
        const seo = (data.store?.seo ?? {}) as any;
        if (seo.sitemap_enabled === false || seo.noindex === true) {
          return new Response("Not found", { status: 404 });
        }
        const base = (seo.canonical_url || origin).replace(/\/$/, "");
        return new Response(renderSitemap(origin, base, data), {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
