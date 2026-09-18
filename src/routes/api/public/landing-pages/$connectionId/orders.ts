import { createFileRoute } from "@tanstack/react-router";
import { intakeLandingPageOrder } from "@/lib/landing-pages.server";

export const Route = createFileRoute("/api/public/landing-pages/$connectionId/orders")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "content-type, x-signature, x-timestamp",
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
          method: "webhook",
          ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for"),
          ua: request.headers.get("user-agent"),
          auth: {
            signature: request.headers.get("x-signature"),
            timestamp: request.headers.get("x-timestamp"),
          },
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
