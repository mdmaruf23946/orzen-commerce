// Records a visitor's advertising-consent choice for the ORZEN main website.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  visitor_id: z.string().min(8).max(64).regex(/^[\w-]+$/),
  choice: z.enum(["accepted", "rejected"]),
  notice_version: z.string().min(1).max(20),
});

export const Route = createFileRoute("/api/public/platform-meta/consent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { guardRequest } = await import("@/lib/rate-limit.server");
        const blocked = await guardRequest("platform_consent", request).catch(() => null);
        if (blocked) return blocked;
        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await (supabaseAdmin as any).from("platform_consent_records").insert({
          ...body,
          country: request.headers.get("cf-ipcountry"),
          user_agent: (request.headers.get("user-agent") ?? "").slice(0, 300),
        });
        return Response.json({ ok: true });
      },
    },
  },
});
