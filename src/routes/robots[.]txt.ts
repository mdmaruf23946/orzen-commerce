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
          // Platform site: advertise the host that actually served the request
          // (published Lovable URL or orzen.top); never an ephemeral preview host.
          const { PLATFORM_ORIGIN } = await import("@/lib/seo");
          const platBase =
            host.endsWith(".lovable.app") && !host.includes("id-preview--")
              ? origin
              : PLATFORM_ORIGIN;
          return new Response(`User-agent: GPTBot\nUser-agent: OAI-SearchBot\nUser-agent: ChatGPT-User\nUser-agent: PerplexityBot\nUser-agent: ClaudeBot\nUser-agent: Google-Extended\nAllow: /\nDisallow: /admin\nDisallow: /owner\nDisallow: /auth\nDisallow: /api/\nDisallow: /_serverFn/\n\nUser-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /owner\nDisallow: /auth\nDisallow: /api/\nDisallow: /_serverFn/\nDisallow: /reset-password\nDisallow: /account-recovery\nDisallow: /employee-login\n\nSitemap: ${platBase}/sitemap.xml\n`, {
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
