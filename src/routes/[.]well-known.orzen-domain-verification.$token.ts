// HTTP challenge endpoint for custom domain verification.
// A merchant whose DNS provider cannot host TXT records can instead point the
// domain at us and we confirm ownership by serving back their token here.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/.well-known/orzen-domain-verification/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = (params.token ?? "").trim();
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!token || !url || !key) return new Response("Not found", { status: 404 });

        const sb = createClient<Database>(url, key, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data } = await sb.rpc("domain_token_exists", { _token: token });

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
