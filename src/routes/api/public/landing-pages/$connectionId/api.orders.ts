import { createFileRoute } from "@tanstack/react-router";
import { intakeLandingPageOrder } from "@/lib/landing-pages.server";

export const Route = createFileRoute("/api/public/landing-pages/$connectionId/api/orders")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "content-type, authorization",
          },
        }),
      POST: async ({ request, params }) => {
        const { guardRequest } = await import("@/lib/rate-limit.server");
        const blocked = await guardRequest("landing_order", request, {
          "Access-Control-Allow-Origin": "*",
        });
        if (blocked) return blocked;
        const rawBody = await request.text();
        const result = await intakeLandingPageOrder({
          connectionId: params.connectionId,
          rawBody,
          method: "api",
          ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for"),
          ua: request.headers.get("user-agent"),
          auth: { apiKey: request.headers.get("authorization") },
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
