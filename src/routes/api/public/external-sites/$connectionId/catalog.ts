import { createFileRoute } from "@tanstack/react-router";
import { syncCatalog } from "@/lib/external-sites.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-api-key, authorization, x-signature, x-timestamp",
};

// Connected websites push their categories/products/contact info here
// (API key or HMAC signature required).
export const Route = createFileRoute("/api/public/external-sites/$connectionId/catalog")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request, params }) => {
        const { guardRequest } = await import("@/lib/rate-limit.server");
        const blocked = await guardRequest("landing_order", request, CORS);
        if (blocked) return blocked;
        if (!/^[0-9a-f-]{36}$/i.test(params.connectionId)) {
          return Response.json({ ok: false, error: "Connection not found" }, { status: 404, headers: CORS });
        }
        const raw = await request.text();
        const r = await syncCatalog(params.connectionId, raw, request.headers);
        return Response.json(r.body, { status: r.status, headers: CORS });
      },
    },
  },
});
