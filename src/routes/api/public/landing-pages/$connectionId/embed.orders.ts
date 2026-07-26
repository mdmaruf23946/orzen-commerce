import { createFileRoute } from "@tanstack/react-router";
import { intakeLandingPageOrder } from "@/lib/landing-pages.server";

export const Route = createFileRoute("/api/public/landing-pages/$connectionId/embed/orders")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "content-type",
          },
        }),
      POST: async ({ request, params }) => {
        let rawBody = await request.text();
        // Accept both JSON and form-encoded submissions from embed forms.
        const ct = request.headers.get("content-type") ?? "";
        if (ct.includes("application/x-www-form-urlencoded")) {
          const obj: Record<string, string> = {};
          new URLSearchParams(rawBody).forEach((v, k) => (obj[k] = v));
          rawBody = JSON.stringify(obj);
        }
        const result = await intakeLandingPageOrder({
          connectionId: params.connectionId,
          rawBody,
          method: "embed",
          ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for"),
          ua: request.headers.get("user-agent"),
          auth: { origin: request.headers.get("origin") },
        });
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
