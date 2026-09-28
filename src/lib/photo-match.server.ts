// Shared customer-photo -> product lookup for Messenger and WhatsApp.
// Order: memorised fingerprint (~ms) -> image vector (~0.5-1s). Always store-scoped.
import { getStoreMemory, recallByFingerprint, type MemoryProduct } from "@/lib/catalog-memory.server";
import {
  rankProductImageMatches,
  VECTOR_CANDIDATE_MIN,
  VECTOR_MATCH_MIN_MARGIN,
  VECTOR_MATCH_MIN_SIMILARITY,
} from "@/lib/product-image-embeddings.server";

export type PhotoMatchResult = {
  product: MemoryProduct | null;
  method: "fingerprint" | "vector" | null;
  score: number;
  margin: number;
  candidateIds: string[];
  ms: number;
};

export async function findProductByPhoto(
  sb: any,
  storeId: string,
  bytes: Uint8Array,
  mime: string,
): Promise<PhotoMatchResult> {
  const started = Date.now();
  const memory = await getStoreMemory(sb, storeId);
  const candidates: string[] = [];
  const { fingerprintImage, FINGERPRINT_MATCH_MAX, FINGERPRINT_MIN_MARGIN, FINGERPRINT_CANDIDATE_MAX } =
    await import("@/lib/photo-fingerprint.server");
  const print = memory.fingerprints.size ? fingerprintImage(bytes) : null;
  if (print) {
    const ranked = recallByFingerprint(memory, print, 8);
    const top = ranked[0];
    const margin = top ? (ranked[1]?.distance ?? 128) - top.distance : 0;
    ranked.filter((r) => r.distance <= FINGERPRINT_CANDIDATE_MAX).forEach((r) => candidates.push(r.product.id));
    if (top && top.distance <= FINGERPRINT_MATCH_MAX && margin >= FINGERPRINT_MIN_MARGIN) {
      return { product: top.product, method: "fingerprint", score: 1 - top.distance / 128, margin, candidateIds: candidates, ms: Date.now() - started };
    }
  }
  const ranked = (await rankProductImageMatches(sb, storeId, bytes, mime, 6)).filter((r) => memory.byId.has(r.productId));
  const top = ranked[0];
  const margin = top ? top.similarity - (ranked[1]?.similarity ?? 0) : 0;
  const vectorCandidates = ranked.filter((r) => r.similarity >= VECTOR_CANDIDATE_MIN).map((r) => r.productId);
  const candidateIds = Array.from(new Set([...vectorCandidates, ...candidates])).slice(0, 8);
  console.log(`[photo-match] store=${storeId} vector top=${top?.similarity.toFixed(3) ?? "-"} margin=${margin.toFixed(3)}`);
  if (top && top.similarity >= VECTOR_MATCH_MIN_SIMILARITY && margin >= VECTOR_MATCH_MIN_MARGIN) {
    return { product: memory.byId.get(top.productId)!.product, method: "vector", score: top.similarity, margin, candidateIds, ms: Date.now() - started };
  }
  return { product: null, method: null, score: top?.similarity ?? 0, margin, candidateIds, ms: Date.now() - started };
}
