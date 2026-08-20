// Public order intake for builder landing pages.
// Pricing always comes from the product row server-side, never from the body.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({ landing_page_id: z.string().uuid() }).passthrough();

export const Route = createFileRoute("/api/public/lp/order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });
        }
        const { landing_page_id, ...rest } = parsed.data;
        const { createLandingPageOrder } = await import("@/lib/landing-builder.server");
        const result = await createLandingPageOrder(landing_page_id, rest);
        return Response.json(result.body, { status: result.status });
      },
    },
  },
});
