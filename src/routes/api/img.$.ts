// Image proxy: streams files from the private store-assets bucket.
// Path: /api/img/{folder}/{file}
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/img/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat ?? "";
        if (!path || path.includes("..")) {
          return new Response("Bad path", { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("store-assets").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        const buf = await data.arrayBuffer();
        return new Response(buf, {
          headers: {
            "content-type": data.type || "application/octet-stream",
            "cache-control": "public, max-age=86400, immutable",
          },
        });
      },
    },
  },
});
