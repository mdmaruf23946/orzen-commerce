// Image proxy: streams PUBLIC image assets from the private store-assets bucket.
// Path: /api/img/{folder}/{file}
//
// SECURITY: this endpoint is unauthenticated and uses the service role, so it must
// never be usable as a generic file server. Paid digital deliverables and any other
// private files are explicitly out of reach: only image extensions are served, and
// private folders (digital/, private/, invoices/...) are always rejected. Paid files
// are delivered exclusively through entitlement-checked signed URLs (digital.server.ts).
import { createFileRoute } from "@tanstack/react-router";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif", "svg", "ico", "bmp"]);
const BLOCKED_SEGMENTS = new Set(["digital", "private", "downloads", "deliverables", "invoices", "secure"]);

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  bmp: "image/bmp",
};

export const Route = createFileRoute("/api/img/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat ?? "";
        if (!path || path.includes("..") || path.includes("\\") || path.startsWith("/")) {
          return new Response("Bad path", { status: 400 });
        }

        const segments = path.split("/").filter(Boolean);
        if (segments.some((s) => BLOCKED_SEGMENTS.has(s.toLowerCase()))) {
          return new Response("Forbidden", { status: 403 });
        }

        const ext = (segments[segments.length - 1] ?? "").split(".").pop()?.toLowerCase() ?? "";
        if (!IMAGE_EXT.has(ext)) {
          return new Response("Forbidden", { status: 403 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("store-assets").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });

        // Only stream back real images, never arbitrary binaries with an image name.
        const actualType = data.type || "";
        if (actualType && !actualType.startsWith("image/")) {
          return new Response("Forbidden", { status: 403 });
        }

        const buf = await data.arrayBuffer();
        return new Response(buf, {
          headers: {
            "content-type": actualType || CONTENT_TYPES[ext] || "application/octet-stream",
            "content-disposition": "inline",
            "x-content-type-options": "nosniff",
            "cache-control": "public, max-age=86400, immutable",
          },
        });
      },
    },
  },
});

