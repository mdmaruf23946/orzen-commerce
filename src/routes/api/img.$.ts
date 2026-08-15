// Image proxy: streams PUBLIC image assets from the private store-assets bucket.
// Path: /api/img/{folder}/{file}
//
// SECURITY: this endpoint is unauthenticated, so it must never be usable as a
// generic file server. Paid digital deliverables and any other private files are
// explicitly out of reach: only image extensions are served, and private folders
// (digital/, private/, invoices/, returns/...) are always rejected. Paid files are
// delivered exclusively through entitlement-checked signed URLs (digital.server.ts).
//
// It reads storage with the PUBLISHABLE key, backed by a storage policy that only
// exposes non-private image objects. That keeps the endpoint working on self-hosted
// deployments (e.g. Cloudflare Pages) where the service role key is not available.
// When a service role key IS present it is used instead (single round trip).
import { createFileRoute } from "@tanstack/react-router";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif", "svg", "ico", "bmp"]);
const BLOCKED_SEGMENTS = new Set([
  "digital",
  "private",
  "downloads",
  "deliverables",
  "invoices",
  "secure",
  "returns",
]);

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

const BASE_HEADERS: Record<string, string> = {
  "content-disposition": "inline",
  "x-content-type-options": "nosniff",
  "cache-control": "public, max-age=86400, immutable",
  // Images are public assets: allow storefronts on custom domains and crawlers
  // (Meta, Google) to fetch them cross-origin.
  "access-control-allow-origin": "*",
  "cross-origin-resource-policy": "cross-origin",
  vary: "origin",
};

/** Fetch the object with the publishable key (works without the service role key). */
async function fetchWithPublishableKey(path: string): Promise<Blob | null> {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;

  const headers: Record<string, string> = { apikey: key };
  // Legacy anon keys are JWTs and must also be sent as a bearer token.
  // New sb_publishable_ keys are opaque and must NOT be.
  if (!key.startsWith("sb_")) headers["Authorization"] = `Bearer ${key}`;

  const res = await fetch(
    `${url.replace(/\/$/, "")}/storage/v1/object/store-assets/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
    { headers },
  );
  if (!res.ok) return null;
  return await res.blob();
}

async function fetchWithServiceRole(path: string): Promise<Blob | null> {
  if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.storage.from("store-assets").download(path);
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/img/$")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, HEAD, OPTIONS",
            "access-control-allow-headers": "Content-Type",
            "access-control-max-age": "86400",
          },
        }),

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

        const data = (await fetchWithServiceRole(path)) ?? (await fetchWithPublishableKey(path));
        if (!data) return new Response("Not found", { status: 404 });

        // Only stream back real images, never arbitrary binaries with an image name.
        const actualType = data.type || "";
        if (actualType && !actualType.startsWith("image/")) {
          return new Response("Forbidden", { status: 403 });
        }

        const buf = await data.arrayBuffer();
        return new Response(buf, {
          headers: {
            ...BASE_HEADERS,
            "content-type": actualType || CONTENT_TYPES[ext] || "application/octet-stream",
          },
        });
      },
    },
  },
});
