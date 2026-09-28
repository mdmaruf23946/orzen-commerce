// Browser → server bridge for ORZEN main-website events (CAPI mirror of the
// pixel, same event_id for deduplication). Merchant hosts and store paths are
// rejected so main-site data never mixes with merchant tracking.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  event: z.string().min(1).max(40),
  event_id: z.string().min(6).max(120).regex(/^[\w.:-]+$/),
  url: z.string().max(2000),
  custom_data: z.record(z.string(), z.union([z.string().max(200), z.number()])).optional(),
});

export function isPlatformHost(host: string) {
  const h = host.toLowerCase().split(":")[0]!;
  return (
    h === "orzen.top" ||
    h === "www.orzen.top" ||
    h === "localhost" ||
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovableproject.com")
  );
}

export const Route = createFileRoute("/api/public/platform-meta/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { guardRequest } = await import("@/lib/rate-limit.server");
        const blocked = await guardRequest("platform_meta", request).catch(() => null);
        if (blocked) return blocked;
        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const { BROWSER_EVENTS, sendPlatformEvent, visitorFromHeaders } = await import("@/lib/platform-meta.server");
        if (!BROWSER_EVENTS.has(body.event)) return Response.json({ ok: false }, { status: 400 });
        let page: URL;
        try {
          page = new URL(body.url);
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const reqHost = new URL(request.url).host;
        if (!isPlatformHost(reqHost) || page.host !== reqHost || page.pathname.startsWith("/store/")) {
          return Response.json({ ok: false, skipped: "not_platform" });
        }
        const r = await sendPlatformEvent({
          event_name: body.event as any,
          event_id: body.event_id,
          source: "browser",
          visitor: visitorFromHeaders(request.headers, body.url),
          custom_data: body.custom_data,
        });
        return Response.json({ ok: true, status: r.status });
      },
    },
  },
});
