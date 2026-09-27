/**
 * Fast visual product lookup for Messenger photos.
 *
 * Each product's main photo is turned into an image embedding once and stored
 * per store. A customer photo is embedded (~0.5s) and compared only against the
 * same store's embeddings, so an identical/near-identical product photo is
 * answered in about a second without the multi-step AI inspection.
 */
export const IMAGE_EMBEDDING_MODEL = "google/gemini-embedding-2";

// Calibrated on live catalogue data: the same product photo (cropped, Messenger
// re-encoded, low contrast) scores ~0.90-0.95, unrelated products stay < 0.70.
const FAST_MATCH_MIN_SIMILARITY = 0.86;
const FAST_MATCH_MIN_MARGIN = 0.12;

type Sb = { from: (t: string) => any; rpc: (fn: string, args: any) => any };

function publicOrigin() {
  return (process.env["PUBLIC_SITE_ORIGIN"] || "https://orzen.top").replace(/\/$/, "");
}

function absoluteImageUrl(value: string | null | undefined) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/api/img/")) return `${publicOrigin()}${value}`;
  return `${publicOrigin()}/api/img/${value.replace(/^\/+/, "")}`;
}

function primaryImage(product: { primary_image_url?: string | null; gallery?: unknown }) {
  if (product.primary_image_url) return product.primary_image_url;
  const gallery = Array.isArray(product.gallery) ? product.gallery : [];
  const first = gallery.find((g) => typeof g === "string" && g);
  return (first as string | undefined) ?? null;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * The photo index needs a multimodal embedding endpoint. The store's own
 * provider keys do not offer one, so this stays disabled and photo matching
 * falls back to visual verification.
 */
export async function embedImageBytes(bytes: Uint8Array, mime: string): Promise<number[]> {
  const key = "";
  if (!key) throw new Error("Image embedding is not available");
  const body = JSON.stringify({
    model: IMAGE_EMBEDDING_MODEL,
    input: [{ content: [{ type: "image_url", image_url: { url: `data:${mime};base64,${toBase64(bytes)}` } }] }],
    encoding_format: "float",
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body,
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
      const vector = json.data?.[0]?.embedding;
      if (!Array.isArray(vector) || !vector.length) throw new Error("Embedding response was empty");
      return vector;
    }
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      await new Promise((r) => setTimeout(r, 600));
      continue;
    }
    throw new Error(`Embedding failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }
  throw new Error("Embedding failed");
}

export type RankedImageMatch = { productId: string; similarity: number };

/**
 * Returns the nearest same-store catalogue photos from the pre-built index.
 * The caller may use the confidence gate below for an instant answer, or pass
 * these few candidates to visual verification instead of scanning the store.
 */
export async function rankProductImageMatches(
  sb: Sb,
  storeId: string,
  bytes: Uint8Array,
  mime: string,
  limit = 8,
): Promise<RankedImageMatch[]> {
  const { count } = await sb
    .from("product_image_embeddings")
    .select("product_id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .not("embedding", "is", null);
  if (!count) return [];
  let vector: number[];
  try {
    vector = await embedImageBytes(bytes, mime);
  } catch {
    return [];
  }
  const { data, error } = await sb.rpc("match_product_image_embeddings", {
    _store_id: storeId,
    _embedding: `[${vector.join(",")}]`,
    _limit: Math.min(Math.max(limit, 1), 20),
  });
  if (error || !Array.isArray(data)) return [];
  return data.map((row: any) => ({
    productId: String(row.product_id),
    similarity: Number(row.similarity) || 0,
  }));
}

/** Returns the best same-store product when the photo is an unambiguous match. */
export async function findFastImageMatch(
  sb: Sb,
  storeId: string,
  bytes: Uint8Array,
  mime: string,
): Promise<{ productId: string; similarity: number; margin: number } | null> {
  const ranked = await rankProductImageMatches(sb, storeId, bytes, mime, 3);
  const top = ranked[0];
  if (!top) return null;
  const second = ranked[1]?.similarity ?? 0;
  const margin = top.similarity - second;
  if (top.similarity < FAST_MATCH_MIN_SIMILARITY || margin < FAST_MATCH_MIN_MARGIN) return null;
  return { productId: top.productId, similarity: top.similarity, margin };
}

/**
 * Embed products whose main photo has no (or an outdated) fingerprint.
 * Bounded per call and idempotent: finished products are skipped next time.
 */
export async function syncProductImageEmbeddings(
  sb: Sb,
  opts: { storeId?: string; limit?: number; retryFailed?: Set<string> } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 40);
  let done = 0;
  let failed = 0;
  for (let from = 0; done + failed < limit; from += 500) {
    let query = sb
      .from("products")
      .select("id,store_id,primary_image_url,gallery")
      .eq("status", "active")
      .order("id", { ascending: true })
      .range(from, from + 499);
    if (opts.storeId) query = query.eq("store_id", opts.storeId);
    const { data: products, error } = await query;
    if (error) throw new Error(error.message);
    const page = (products ?? []) as Array<{ id: string; store_id: string; primary_image_url: string | null; gallery: unknown }>;
    if (!page.length) break;
    const { data: existing } = await sb
      .from("product_image_embeddings")
      .select("product_id,image_url,phash,last_error")
      .in("product_id", page.map((p) => p.id));
    // A product is "memorised" once its current photo has a fingerprint (or a
    // recorded fingerprint failure for that same photo).
    const known = new Map((existing ?? [])
      .filter((row: any) => row.phash || String(row.last_error ?? "").startsWith("FP:"))
      .map((row: any) => [String(row.product_id), String(row.image_url)]));
    for (const product of page) {
      if (done + failed >= limit) break;
      const image = primaryImage(product);
      if (!image || (known.get(product.id) === image && !opts.retryFailed?.has(product.id))) continue;
      try {
        let bytes: Uint8Array;
        let mime: string;
        const storagePath = /^https?:\/\//i.test(image) ? null : image.replace(/^\/?(api\/img\/)?/, "");
        if (storagePath && (sb as any).storage) {
          // Our own image proxy cannot be fetched from inside the Worker (522),
          // so store-hosted photos are read straight from storage.
          const { data: blob, error: dlError } = await (sb as any).storage.from("store-assets").download(storagePath, {
            transform: { width: 256, height: 256, resize: "contain", quality: 80, format: "origin" },
          }).then((r: any) => (r?.data ? r : (sb as any).storage.from("store-assets").download(storagePath)));
          if (dlError || !blob) throw new Error(`Storage download failed: ${dlError?.message ?? "empty"}`);
          bytes = new Uint8Array(await blob.arrayBuffer());
          const ext = storagePath.split(".").pop()?.toLowerCase() ?? "jpg";
          mime = blob.type?.startsWith("image/") ? blob.type : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
        } else {
          const res = await fetch(absoluteImageUrl(image)!, { headers: { Accept: "image/*" } });
          if (!res.ok) throw new Error(`Image HTTP ${res.status}`);
          mime = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0]!.trim();
          bytes = new Uint8Array(await res.arrayBuffer());
        }
        if (!mime.startsWith("image/")) throw new Error(`Not an image (${mime})`);
        if (!bytes.byteLength || bytes.byteLength > 8_000_000) throw new Error("Image size unsupported");
        const { fingerprintImage } = await import("@/lib/photo-fingerprint.server");
        const phash = fingerprintImage(bytes);
        if (!phash) throw new Error(`Unsupported photo format (${mime})`);
        await sb.from("product_image_embeddings").upsert({
          product_id: product.id,
          store_id: product.store_id,
          image_url: image,
          phash,
          model: "phash-v1",
          last_error: null,
          updated_at: new Date().toISOString(),
        });
        done += 1;
      } catch (cause) {
        // Record the failure against this image so it is not retried every run;
        // a new image URL on the product triggers a fresh attempt.
        await sb.from("product_image_embeddings").upsert({
          product_id: product.id,
          store_id: product.store_id,
          image_url: image,
          phash: null,
          model: "phash-v1",
          last_error: `FP: ${(cause instanceof Error ? cause.message : "Fingerprint failed")}`.slice(0, 300),
          updated_at: new Date().toISOString(),
        });
        failed += 1;
      }
    }
    if (page.length < 500) break;
  }
  return { embedded: done, failed };
}
