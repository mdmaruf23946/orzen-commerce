// Browser helper: upload a store-assets file to Cloudflare R2, falling back to old storage.
import { supabase } from "@/integrations/supabase/client";

export async function uploadStoreAsset(
  path: string,
  file: Blob,
  opts: { contentType?: string; upsert?: boolean } = {},
): Promise<{ error: { message: string } | null }> {
  const contentType = opts.contentType || file.type || "application/octet-stream";
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      const res = await fetch(`/api/upload?path=${encodeURIComponent(path)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": contentType },
        body: file,
      });
      if (res.ok) return { error: null };
    }
  } catch {
    /* fall back below */
  }
  const { error } = await supabase.storage
    .from("store-assets")
    .upload(path, file, { upsert: opts.upsert ?? false, contentType });
  return { error: error ? { message: error.message } : null };
}
