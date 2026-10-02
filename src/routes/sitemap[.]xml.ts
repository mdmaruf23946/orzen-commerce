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
          // Platform site: emit the host that actually served the request
          // (published Lovable URL or orzen.top); never an ephemeral preview host.
          const { PLATFORM_ORIGIN } = await import("@/lib/seo");
          const platBase =
            host.endsWith(".lovable.app") && !host.includes("id-preview--")
              ? origin
              : PLATFORM_ORIGIN;
          const paths: Array<[string, string]> = [
            ["/", "1.0"],
            ["/about", "0.6"],
            ["/contact", "0.6"],
            ["/privacy-policy", "0.3"],
            ["/terms", "0.3"],
            ["/refund-policy", "0.3"],
            ["/shipping-policy", "0.3"],
            ["/data-deletion", "0.3"],
          ];
          const xml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            ...paths.map(
              ([p, priority]) =>
                `  <url><loc>${platBase}${p === "/" ? "/" : p}</loc><changefreq>weekly</changefreq><priority>${priority}</priority></url>`,
            ),
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
