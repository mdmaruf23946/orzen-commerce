/**
 * Visual product lookup for Messenger/WhatsApp photos.
 *
 * Each product's main photo is turned once into (a) a 128-bit fingerprint and
 * (b) a 768-dim image vector from Google's multimodal embedding model, using
 * the owner's saved Gemini keys. A customer photo is embedded (~0.5s) and
 * compared only against the same store's vectors (HNSW index).
 */
export const IMAGE_EMBEDDING_MODEL = "gemini-embedding-2";
export const IMAGE_EMBEDDING_DIM = 768;

// Initial gate; recalibrated against live catalogue photos.
export const VECTOR_MATCH_MIN_SIMILARITY = 0.86;
export const VECTOR_MATCH_MIN_MARGIN = 0.05;
export const VECTOR_CANDIDATE_MIN = 0.6;

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

// Keys that hit quota/invalid are skipped for a while inside this isolate.
const keyCooldown = new Map<string, number>();
let keyCache: { keys: string[]; at: number } | null = null;

async function geminiKeys(sb: Sb): Promise<string[]> {
  if (keyCache && Date.now() - keyCache.at < 60_000) return keyCache.keys;
  const { data } = await sb.from("ai_global_settings").select("gemini_api_keys").eq("id", 1).maybeSingle();
  const { normalizeGeminiKeys } = await import("./gemini-keys.server");
  const keys = normalizeGeminiKeys((data as any)?.gemini_api_keys)
    .filter((k) => k.enabled && k.provider === "gemini" && k.key)
    .map((k) => k.key);
  keyCache = { keys, at: Date.now() };
  return keys;
}

/** Image -> 768-dim vector on the owner's Gemini keys (tries each key once). */
export async function embedImageBytes(sb: Sb, bytes: Uint8Array, mime: string): Promise<number[]> {
  const keys = (await geminiKeys(sb)).filter((k) => (keyCooldown.get(k) ?? 0) < Date.now());
  if (!keys.length) throw new Error("No working Gemini key for image search");
  const body = JSON.stringify({
    content: { parts: [{ inline_data: { mime_type: mime, data: toBase64(bytes) } }] },
    outputDimensionality: IMAGE_EMBEDDING_DIM,
  });
  let lastError = "";
  for (const key of keys) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_EMBEDDING_MODEL}:embedContent?key=${encodeURIComponent(key)}`,
      { method: "POST", headers: { "content-type": "application/json" }, body },
    ).catch(() => null);
    if (res?.ok) {
      const json = (await res.json()) as { embedding?: { values?: number[] } };
      const v = json.embedding?.values;
      if (!Array.isArray(v) || v.length !== IMAGE_EMBEDDING_DIM) throw new Error("Embedding response was empty");
      const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
      return v.map((x) => x / norm);
    }
    const status = res?.status ?? 0;
    lastError = `HTTP ${status}: ${res ? (await res.text().catch(() => "")).slice(0, 160) : "network"}`;
    if (status === 400 && !/api key/i.test(lastError)) throw new Error(lastError); // bad image, not the key
    keyCooldown.set(key, Date.now() + (status === 429 ? 10 * 60_000 : 60 * 60_000));
  }
  throw new Error(lastError || "Embedding failed");
}

export type RankedImageMatch = { productId: string; similarity: number };

/** Nearest same-store catalogue photos by vector similarity. */
export async function rankProductImageMatches(
  sb: Sb,
  storeId: string,
  bytes: Uint8Array,
  mime: string,
  limit = 8,
): Promise<RankedImageMatch[]> {
  let vector: number[];
  try {
    vector = await embedImageBytes(sb, bytes, mime);
  } catch (e) {
    console.log(`[photo-vector] embed failed store=${storeId}: ${e instanceof Error ? e.message : e}`);
    return [];
  }
  const { data, error } = await sb.rpc("match_product_image_embeddings", {
    _store_id: storeId,
    _embedding: `[${vector.join(",")}]`,
    _limit: Math.min(Math.max(limit, 1), 20),
  });
  if (error || !Array.isArray(data)) return [];
  return data.map((row: any) => ({ productId: String(row.product_id), similarity: Number(row.similarity) || 0 }));
}

async function loadImageBytes(sb: Sb, image: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const storagePath = /^https?:\/\//i.test(image) ? null : image.replace(/^\/?(api\/img\/)?/, "");
  if (storagePath && (sb as any).storage) {
    // Our own image proxy cannot be fetched from inside the Worker (522).
    const bucket = (sb as any).storage.from("store-assets");
    let r = await bucket.download(storagePath, {
      transform: { width: 512, height: 512, resize: "contain", quality: 80, format: "origin" },
    });
    if (!r?.data) r = await bucket.download(storagePath);
    if (r?.error || !r?.data) throw new Error(`Storage download failed: ${r?.error?.message ?? "empty"}`);
    const bytes = new Uint8Array(await r.data.arrayBuffer());
    const ext = storagePath.split(".").pop()?.toLowerCase() ?? "jpg";
    const mime = r.data.type?.startsWith("image/") ? r.data.type : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return { bytes, mime };
  }
  const res = await fetch(absoluteImageUrl(image)!, { headers: { Accept: "image/*" } });
  if (!res.ok) throw new Error(`Image HTTP ${res.status}`);
  return {
    mime: (res.headers.get("content-type") ?? "image/jpeg").split(";")[0]!.trim(),
    bytes: new Uint8Array(await res.arrayBuffer()),
  };
}

/**
 * Fingerprint + embed products whose main photo is new/changed or not yet
 * vectorised. Bounded per call and idempotent.
 */
export async function syncProductImageEmbeddings(
  sb: Sb,
  opts: { storeId?: string; productId?: string; limit?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 40);
  let done = 0;
  let failed = 0;
  let embedDown = false;
  for (let from = 0; done + failed < limit; from += 500) {
    let query = sb
      .from("products")
      .select("id,store_id,primary_image_url,gallery")
      .eq("status", "active")
      .order("id", { ascending: true })
      .range(from, from + 499);
    if (opts.storeId) query = query.eq("store_id", opts.storeId);
    if (opts.productId) query = query.eq("id", opts.productId);
    const { data: products, error } = await query;
    if (error) throw new Error(error.message);
    const page = (products ?? []) as Array<{ id: string; store_id: string; primary_image_url: string | null; gallery: unknown }>;
    if (!page.length) break;
    const { data: existing } = await sb
      .from("product_image_embeddings")
      .select("product_id,image_url,phash,embedded_url,last_error")
      .in("product_id", page.map((p) => p.id));
    const rows = new Map<string, any>((existing ?? []).map((r: any) => [String(r.product_id), r]));
    for (const product of page) {
      if (done + failed >= limit) break;
      const image = primaryImage(product);
      if (!image) continue;
      const row = rows.get(product.id);
      const sameImage = row && row.image_url === image;
      const printOk = sameImage && (row.phash || String(row.last_error ?? "").startsWith("FP:"));
      const vectorOk = sameImage && (row.embedded_url === image || embedDown);
      if (printOk && vectorOk) continue;
      try {
        const { bytes, mime } = await loadImageBytes(sb, image);
        if (!mime.startsWith("image/")) throw new Error(`FP: Not an image (${mime})`);
        if (!bytes.byteLength || bytes.byteLength > 8_000_000) throw new Error("FP: Image size unsupported");
        const patch: Record<string, unknown> = {
          product_id: product.id,
          store_id: product.store_id,
          image_url: image,
          model: `phash-v1+${IMAGE_EMBEDDING_MODEL}`,
          last_error: null,
          updated_at: new Date().toISOString(),
        };
        if (!printOk) {
          const { fingerprintImage } = await import("@/lib/photo-fingerprint.server");
          patch["phash"] = fingerprintImage(bytes);
        }
        if (!vectorOk) {
          try {
            const v = await embedImageBytes(sb, bytes, mime);
            patch["embedding"] = `[${v.join(",")}]`;
            patch["embedded_url"] = image;
          } catch (e) {
            const msg = e instanceof Error ? e.message : "embed failed";
            if (/No working Gemini key|HTTP 429|HTTP 5/.test(msg)) embedDown = true;
            patch["last_error"] = `VEC: ${msg}`.slice(0, 300);
            if (/HTTP 400/.test(msg)) patch["embedded_url"] = image; // unreadable image: don't retry forever
          }
        }
        await sb.from("product_image_embeddings").upsert(patch);
        done += 1;
      } catch (cause) {
        await sb.from("product_image_embeddings").upsert({
          product_id: product.id,
          store_id: product.store_id,
          image_url: image,
          phash: null,
          embedded_url: image,
          last_error: `FP: ${(cause instanceof Error ? cause.message : "failed").replace(/^FP: /, "")}`.slice(0, 300),
          updated_at: new Date().toISOString(),
        });
        failed += 1;
      }
    }
    if (page.length < 500 || opts.productId) break;
  }
  return { embedded: done, failed };
}
