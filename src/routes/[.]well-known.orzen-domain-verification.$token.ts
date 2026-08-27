// HTTP challenge endpoint for custom domain verification.
// A merchant whose DNS provider cannot host TXT records can instead point the
// domain at us and we confirm ownership by serving back their token here.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/.well-known/orzen-domain-verification/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = (params.token ?? "").trim();
        if (!token) return new Response("Not found", { status: 404 });

        // The lookup helper is server-only (not callable by anon/authenticated).
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin.rpc("domain_token_exists", { _token: token });

        if (!data) return new Response("Not found", { status: 404 });
        return new Response(token, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
