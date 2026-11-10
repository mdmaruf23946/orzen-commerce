// Photo → catalogue matching for Messenger (extracted from messenger-webhook.server.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { routedVisionText } from "@/lib/agents/ai-provider.server";
import { getStoreMemory, recallByText } from "@/lib/agents/catalog-memory.server";
import { ImageProcessingError, type ImageAnalysis, type VisualMatch, type ProductRow } from "@/lib/integrations/messenger-types";
import { productImages, productIdentityText } from "@/lib/integrations/messenger-product-helpers";

export function imageFailure(code: string, detail: string, retryable: boolean): never {
  throw new ImageProcessingError(code, detail, retryable);
}

export async function visuallyMatchProduct(
  sb: SupabaseClient<Database>,
  storeId: string,
  analysis: ImageAnalysis,
  imageCandidateIds: string[] = [],
): Promise<VisualMatch | null> {
  if (!analysis.is_product || analysis.recognition_status !== "clear") return null;
  const query = [
    analysis.product_type,
    analysis.product_subtype,
    analysis.category,
    analysis.brand,
    analysis.model_number,
    analysis.description,
    ...analysis.visible_text,
    ...analysis.functions,
    ...analysis.connectors,
    ...analysis.keywords,
  ].filter(Boolean).join(" ");
  // Candidates come straight out of the memorised catalogue — instant, and
  // already free of blacklisted / out-of-stock / imageless products.
  const memory = await getStoreMemory(sb as any, storeId);
  const categoryNames = memory.categoryNames;
  // Speed: only products the memory genuinely associates with this photo are
  // worth a vision comparison. The older helper padded the list with best
  // sellers whenever the words matched nothing, so a product the shop does not
  // stock still triggered a full four-photo comparison (~40s) before answering
  // "not available". Unrelated photos now skip the comparison entirely.
  const recalled = recallByText(memory, [
    analysis.product_type,
    analysis.product_subtype,
    analysis.category,
    analysis.brand,
    ...analysis.keywords,
    ...analysis.functions,
    ...analysis.connectors,
    ...analysis.visible_text,
  ].filter(Boolean).join(" "), 6) as unknown as ProductRow[];
  const pinned = imageCandidateIds
    .map((id) => memory.byId.get(id)?.product as unknown as ProductRow | undefined)
    .filter((product): product is ProductRow => Boolean(product));
  const textMatches = Array.from(new Map([...pinned, ...recalled].map((p) => [p.id, p])).values());
  const allProducts = textMatches.filter((product) => productImages(product, 1).length > 0);
  if (!allProducts.length) return null;
  void query;
  // Runs on the platform owner's own provider keys (Winner Admin → AI).
  const requestJson = async (stage: "MATCH", content: any[]) => {
    let text: string;
    try {
      text = await routedVisionText(content, { jsonOnly: true });
    } catch (cause) {
      imageFailure(`${stage}_HTTP`, (cause as Error).message, true);
    }
    const object = text.match(/\{[\s\S]*\}/)?.[0];
    if (!object) imageFailure(`${stage}_JSON`, "AI match answer did not contain JSON", true);
    try {
      return JSON.parse(object) as Record<string, unknown>;
    } catch {
      imageFailure(`${stage}_JSON`, "AI match answer contained invalid JSON", true);
    }
  };

  try {
    // The photo index and the preloaded catalogue narrow the store to a small,
    // deterministic candidate set. Merchant-written metadata only controls
    // comparison order and can never override the visual verdict.
    const textRank = new Map(textMatches.map((product, index) => [product.id, index]));
    const candidates = [...allProducts].sort((left, right) => {
      const rankDelta = (textRank.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (textRank.get(right.id) ?? Number.MAX_SAFE_INTEGER);
      if (rankDelta !== 0) return rankDelta;
      return left.id.localeCompare(right.id);
    });

    // Speed: one comparison call, and only the few catalogue photos that can
    // plausibly win. Sending eight products × two photos meant downloading and
    // inlining sixteen full-size images per customer photo, which is what made
    // a found product slower to answer than a missing one.
    const batch = candidates.slice(0, 3);
    const content: any[] = [{
      type: "input_text",
      text: "CUSTOMER_IMAGE is first. Decide if any candidate photo shows the same sale product/model. Answer FAST and SHORT. " +
        'Return ONLY minified JSON: {"results":[{"index":number,"verdict":"same|close|different","type_compatible":boolean,"confidence":0..1,"reason":"few words"}]}. ' +
        "Use same only when function/type, ports, controls, branding/text and proportions agree; colour or shape alone is insufficient. " +
        "Judge by the IMAGES: catalogue names may be wrong and must never override the photo. If the customer image is the same photograph as a candidate photo (even cropped, resized or recompressed), return same with confidence 0.99. " +
        "Skip candidates that clearly differ instead of describing them.",
    }, { type: "input_image", image_url: analysis.image_data_url }];
    batch.forEach((product, index) => {
      const identity = productIdentityText(product, categoryNames.get(String(product.category_id ?? "")) ?? "").slice(0, 220);
      content.push({ type: "input_text", text: `CANDIDATE_${index}: ${identity}` });
      productImages(product, 1).forEach((image) => content.push({ type: "input_image", image_url: image }));
    });
    const compared = await requestJson("MATCH", content);
    const results = Array.isArray(compared.results) ? compared.results : [];
    let best: VisualMatch | null = null;
    for (const raw of results) {
      if (!raw || typeof raw !== "object") continue;
      const value = raw as Record<string, unknown>;
      const index = Number(value.index);
      const product = Number.isInteger(index) ? batch[index] : undefined;
      if (!product || value.type_compatible !== true) continue;
      const verdict = String(value.verdict ?? "different");
      if (verdict === "different") continue;
      const confidence = Math.max(0, Math.min(1, Number(value.confidence) || 0));
      if (confidence < 0.7) continue;
      const candidate: VisualMatch = {
        product,
        confidence,
        verdict: verdict === "same" && confidence >= 0.85 ? "exact" : "close",
        evidence: [String(value.reason ?? "").slice(0, 300)].filter(Boolean),
        reason: String(value.reason ?? "").slice(0, 300),
      };
      const better = !best
        || (candidate.verdict === "exact" && best.verdict !== "exact")
        || (candidate.verdict === best.verdict && candidate.confidence > best.confidence);
      if (better) best = candidate;
    }
    return best;
  } catch (cause) {
    if (cause instanceof ImageProcessingError) throw cause;
    imageFailure("MATCH_EXCEPTION", cause instanceof Error ? cause.message : "Unexpected catalogue match failure", true);
  }
}
