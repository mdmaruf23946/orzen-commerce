// Authenticated upload of store-assets files into Cloudflare R2 (served back via /api/img).
// Returns 403/503 so the browser can fall back to the old storage upload.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { assetFolderStoreId, isSafeAssetPath } from "@/lib/storage/upload-auth";

const MAX = 25 * 1024 * 1024;

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const path = new URL(request.url).searchParams.get("path") || "";
        const type = request.headers.get("content-type") || "application/octet-stream";
        if (!token) return new Response("unauthorized", { status: 401 });
        if (!isSafeAssetPath(path)) return new Response("bad path", { status: 400 });
        const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!url || !key) return new Response("not configured", { status: 503 });
        const sb = createClient(url, key, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: u } = await sb.auth.getUser(token);
        if (!u?.user) return new Response("unauthorized", { status: 401 });
        const storeId = assetFolderStoreId(path);
        let allowed = false;
        if (storeId) {
          const { data } = await sb.rpc("has_store_access" as any, { _store_id: storeId } as any);
          allowed = data === true;
          if (!allowed) {
            const { data: s } = await sb.from("stores").select("id").eq("id", storeId).eq("owner_id", u.user.id).maybeSingle();
            allowed = !!s;
          }
        } else {
          const { data } = await sb.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "owner").maybeSingle();
          allowed = !!data;
        }
        if (!allowed) return new Response("forbidden", { status: 403 });
        const body = await request.arrayBuffer();
        if (!body.byteLength || body.byteLength > MAX) return new Response("bad size", { status: 413 });
        const { r2Put } = await import("@/lib/r2.server");
        const ok = await r2Put(`store-assets/${path}`, body, type);
        if (!ok) return new Response("r2 failed", { status: 503 });
        return Response.json({ path });
      },
    },
  },
});
