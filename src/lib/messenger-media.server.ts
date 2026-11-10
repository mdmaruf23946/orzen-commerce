// Extracted from the Messenger webhook; preserve existing channel behaviour.
import { routedTranscribeAudio, routedVisionText } from "@/lib/ai-provider.server";
import { ImageProcessingError, type ProductRow, type ImageAnalysis, type VisualMatch } from "./messenger-types";
import { imageFailure } from "./messenger-visual-match.server";
import type { MessengerClient } from "./messenger-client.server";

export const IMAGE_FETCH_HEADERS = {
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  "User-Agent": "Mozilla/5.0 (compatible; ORZEN-Messenger/1.0)",
};

// Customer-care wording for moments the photo can't be read. Never mention
// AI, "analysis", "system" or "saved" — it must read like a shop assistant.
export function humanPhotoFallback(): string {
  const list = [
    "ছবিটা পেয়েছি 😊 প্রোডাক্টটার নাম বা কোডটা একটু লিখে দিবেন? মিলিয়ে দেখে এখনই জানাচ্ছি।",
    "জি, ছবিটা দেখলাম। এটার নাম বা কোন ধরনের প্রোডাক্ট, একটু লিখে দিলে আমাদের কাছে আছে কিনা দেখে বলছি 😊",
    "ধন্যবাদ ছবির জন্য! প্রোডাক্টটার নামটা একটু জানাবেন? তাহলে দ্রুত চেক করে দিতে পারব।",
  ];
  return list[Math.floor(Math.random() * list.length)];
}

export function humanTextFallback(bangla: boolean): string {
  return bangla
    ? "জি, একটু সময় দিন প্লিজ, দেখে এখনই জানাচ্ছি 😊"
    : "Sure, give me a moment please, I'll get back to you shortly 😊";
}

export async function responseErrorMessage(response: Response) {
  const body = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: { message?: string } };
    return String(parsed.message ?? parsed.error?.message ?? `HTTP ${response.status}`).slice(0, 240);
  } catch {
    return `HTTP ${response.status}`;
  }
}

export async function refreshMessengerImageUrl(pageToken: string, messageId: string) {
  if (!pageToken || !messageId) return null;
  const response = await fetch(
    `https://graph.facebook.com/v19.0/${encodeURIComponent(messageId)}?fields=attachments&access_token=${encodeURIComponent(pageToken)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null) as any;
  const attachments = payload?.attachments?.data;
  if (!Array.isArray(attachments)) return null;
  for (const attachment of attachments) {
    const candidate = attachment?.image_data?.url ?? attachment?.file_url ?? attachment?.payload?.url;
    if (typeof candidate === "string" && /^https:\/\//i.test(candidate)) return candidate;
  }
  return null;
}

export async function downloadMessengerImage(url: string, pageToken: string, messageId: string) {
  if (!url) imageFailure("URL_MISSING", "Messenger supplied no image URL", false);
  let currentUrl = url;
  let refreshed = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(currentUrl, { headers: IMAGE_FETCH_HEADERS });
    } catch (cause) {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        continue;
      }
      imageFailure("DOWNLOAD_NETWORK", cause instanceof Error ? cause.message : "Image download failed", true);
    }
    if (!response.ok) {
      if (!refreshed && [401, 403, 404].includes(response.status)) {
        const freshUrl = await refreshMessengerImageUrl(pageToken, messageId);
        if (freshUrl) {
          currentUrl = freshUrl;
          refreshed = true;
          continue;
        }
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      imageFailure("DOWNLOAD_HTTP", `Facebook image returned HTTP ${response.status}`, response.status === 429 || response.status >= 500);
    }
    const type = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    if (!type.startsWith("image/")) imageFailure("CONTENT_TYPE", `Facebook returned ${type || "no content type"}`, false);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength) imageFailure("EMPTY", "Facebook returned an empty image", true);
    if (bytes.byteLength > 8_000_000) imageFailure("TOO_LARGE", `Image is ${bytes.byteLength} bytes`, false);
    return { bytes, type };
  }
  imageFailure("DOWNLOAD_RETRY_EXHAUSTED", "Image download retries were exhausted", true);
}

export function parseResponsesText(rawStream: string, stage: "ANALYSIS" | "MATCH") {
  let text = "";
  let terminalError = "";
  for (const line of rawStream.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const event = JSON.parse(payload) as any;
      if (event?.type === "response.output_text.delta") text += String(event.delta ?? "");
      if (event?.type === "response.failed" || event?.type === "error") {
        terminalError = String(event?.response?.error?.message ?? event?.error?.message ?? event?.message ?? "Gateway stream failed");
      }
      if (event?.type === "response.completed" && !text) {
        text = String(event?.response?.output_text ?? "");
      }
    } catch {
      // SSE frames are line-delimited JSON; non-JSON metadata is not content.
    }
  }
  if (terminalError) imageFailure(`${stage}_STREAM`, terminalError, true);
  if (!text.trim()) imageFailure(`${stage}_EMPTY`, "AI returned no answer text", true);
  return text;
}

export async function transcribeAudioAttachment(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const audioRes = await fetch(url);
    if (!audioRes.ok) return null;
    const buf = new Uint8Array(await audioRes.arrayBuffer());
    if (!buf.byteLength || buf.byteLength > 15 * 1024 * 1024) return null;
    const mime = ((audioRes.headers.get("content-type") || "audio/mp4").split(";")[0] ?? "audio/mp4").trim();
    // Runs on the platform owner's own provider keys (Winner Admin → AI).
    return await routedTranscribeAudio(buf, mime);
  } catch (e) {
    console.error("[messenger] voice transcription failed", e);
    return null;
  }
}

/**
 * Look at a photo the customer sent and describe it, so the sales agent can act
 * on it (find the product, say it is unavailable, or answer about a receipt).
 */
export async function describeImageAttachment(
  url: string,
  pageToken: string,
  messageId: string,
  prepared?: { bytes: Uint8Array; type: string } | null,
): Promise<ImageAnalysis> {
  // Runs on the platform owner's own provider keys (Winner Admin → AI).
  try {
    // The model provider cannot fetch Facebook's signed CDN links itself
    // (it returns "Cannot fetch content from the provided URL"), so the bytes
    // are downloaded here and sent inline as a data URL. The fingerprint step
    // already downloaded the photo, so its bytes are reused instead of pulling
    // the same image from Facebook a second time.
    const { bytes, type } = prepared ?? await downloadMessengerImage(url, pageToken, messageId);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const dataUrl = `data:${type};base64,${btoa(binary)}`;

    // Speed: the old prompt asked for 25 fields and took 15-20s to generate on
    // free keys. The agent only ever uses a handful of them, so the model now
    // writes one short object and the rest keep their safe defaults.
    const prompt =
      "A customer sent this photo to an online shop. Identify the sale item (ignore people, hands and background). " +
      "Read any visible brand, model number or label text. Answer FAST and SHORT. " +
      'Return ONLY minified JSON: {"description":"one short sentence","keywords":["2-6 catalogue search words"],' +
      '"is_product":true|false,"product_type":"short noun","brand":null|"...","model_number":null|"...",' +
      '"primary_color":null|"...","confidence":0..1}. ' +
      "Never invent a brand, model or specification that is not visible. is_product is false for receipts, screenshots, documents, selfies or memes.";
    let raw: string;
    try {
      raw = await routedVisionText([
        { type: "input_text", text: prompt },
        { type: "input_image", image_url: dataUrl },
      ], { jsonOnly: true });
    } catch (cause) {
      imageFailure("ANALYSIS_HTTP", (cause as Error).message, true);
    }
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) imageFailure("ANALYSIS_JSON", "AI answer did not contain JSON", true);
    let parsed: {
      description?: string;
      keywords?: unknown;
      is_product?: boolean;
      product_type?: string;
      product_subtype?: string | null;
      category?: string;
      primary_color?: string | null;
      secondary_colors?: unknown;
      material?: string | null;
      style?: string | null;
      shape?: string | null;
      pattern?: string | null;
      visible_text?: unknown;
      brand?: string | null;
      model_number?: string | null;
      functions?: unknown;
      connectors?: unknown;
      controls?: unknown;
      package_specs?: unknown;
      distinctive_features?: unknown;
      field_confidence?: unknown;
      visibility_warnings?: unknown;
      object_boundary_confidence?: number;
      text_legibility?: number;
      confidence?: number;
    };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      imageFailure("ANALYSIS_JSON", "AI answer contained invalid JSON", true);
    }

    const firstConfidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    const firstFieldConfidence = parsed.field_confidence && typeof parsed.field_confidence === "object" && !Array.isArray(parsed.field_confidence)
      ? parsed.field_confidence as Record<string, unknown>
      : {};
    const hasFirstTypeConfidence = typeof firstFieldConfidence.product_type === "number";
    const firstTypeConfidence = Math.max(0, Math.min(1, Number(firstFieldConfidence.product_type) || 0));
    const hasFirstBoundaryConfidence = typeof parsed.object_boundary_confidence === "number";
    const firstBoundaryConfidence = Math.max(0, Math.min(1, Number(parsed.object_boundary_confidence) || 0));
    // Speed: a second inspection pass doubled the wait on every photo while
    // rarely changing the verdict. Only re-inspect when the first pass gave us
    // nothing usable at all.
    const needsFocusedInspection = parsed.is_product !== false &&
      !String(parsed.product_type ?? "").trim() &&
      firstConfidence < 0.4 &&
      (!hasFirstTypeConfidence || firstTypeConfidence < 0.3) &&
      (!hasFirstBoundaryConfidence || firstBoundaryConfidence < 0.3);
    let inspectionPasses: 1 | 2 = 1;
    if (needsFocusedInspection) {
      const focusedPrompt =
        "Re-inspect this difficult product photo independently. Ignore background colour and isolate the sale item using silhouette edges, local shadows, seams, cap/base, ports, controls, printed-label layout, texture and proportions. " +
        "Pay special attention to white-on-white, black-on-black, transparent, reflective, blurred, backlit or overexposed regions. Read faint text only when genuinely legible. " +
        "Do not invent a brand, model, specification or colour. Return ONLY minified JSON with keys description,keywords,is_product,product_type,product_subtype,category,primary_color,secondary_colors,material,style,shape,pattern,visible_text,brand,model_number,functions,connectors,controls,package_specs,distinctive_features,field_confidence,visibility_warnings,object_boundary_confidence,text_legibility,confidence. " +
        "Use null for uncertain single values and [] for absent lists. object_boundary_confidence, text_legibility, confidence and every field_confidence value MUST be JSON numbers from 0 to 1, never text. visibility_warnings may contain ONLY these exact codes: low_contrast, blur, overexposure, underexposure, reflection, transparency, occlusion.";
      let focusedRaw: string;
      try {
        focusedRaw = await routedVisionText([
          { type: "input_text", text: focusedPrompt },
          { type: "input_image", image_url: dataUrl },
        ], { jsonOnly: true });
      } catch (cause) {
        imageFailure("FOCUSED_ANALYSIS_HTTP", (cause as Error).message, true);
      }
      const focusedObject = focusedRaw.match(/\{[\s\S]*\}/)?.[0];
      if (!focusedObject) imageFailure("FOCUSED_ANALYSIS_JSON", "Focused AI answer did not contain JSON", true);
      let focused: typeof parsed;
      try {
        focused = JSON.parse(focusedObject);
      } catch {
        imageFailure("FOCUSED_ANALYSIS_JSON", "Focused AI answer contained invalid JSON", true);
      }
      const mergeList = (left: unknown, right: unknown, max: number) => Array.from(new Set([
        ...(Array.isArray(left) ? left : []),
        ...(Array.isArray(right) ? right : []),
      ].map((value) => String(value).trim()).filter(Boolean))).slice(0, max);
      const focusedFields = focused.field_confidence && typeof focused.field_confidence === "object" && !Array.isArray(focused.field_confidence)
        ? focused.field_confidence as Record<string, unknown>
        : {};
      const firstFields = parsed.field_confidence && typeof parsed.field_confidence === "object" && !Array.isArray(parsed.field_confidence)
        ? parsed.field_confidence as Record<string, unknown>
        : {};
      const mergedFields: Record<string, number> = {};
      for (const name of new Set([...Object.keys(firstFields), ...Object.keys(focusedFields)])) {
        mergedFields[name] = Math.max(Number(firstFields[name]) || 0, Number(focusedFields[name]) || 0);
      }
      const preferFocused = Math.max(0, Math.min(1, Number(focused.confidence) || 0)) >= firstConfidence - 0.08;
      parsed = {
        ...(preferFocused ? parsed : focused),
        ...(preferFocused ? focused : parsed),
        keywords: mergeList(parsed.keywords, focused.keywords, 8),
        secondary_colors: mergeList(parsed.secondary_colors, focused.secondary_colors, 5),
        visible_text: mergeList(parsed.visible_text, focused.visible_text, 10),
        functions: mergeList(parsed.functions, focused.functions, 8),
        connectors: mergeList(parsed.connectors, focused.connectors, 8),
        controls: mergeList(parsed.controls, focused.controls, 8),
        package_specs: mergeList(parsed.package_specs, focused.package_specs, 10),
        distinctive_features: mergeList(parsed.distinctive_features, focused.distinctive_features, 10),
        visibility_warnings: mergeList(parsed.visibility_warnings, focused.visibility_warnings, 8),
        field_confidence: mergedFields,
        object_boundary_confidence: Math.max(Number(parsed.object_boundary_confidence) || 0, Number(focused.object_boundary_confidence) || 0),
        text_legibility: Math.max(Number(parsed.text_legibility) || 0, Number(focused.text_legibility) || 0),
        confidence: Math.max(firstConfidence, Number(focused.confidence) || 0),
      };
      inspectionPasses = 2;
    }
    const description = String(parsed.description ?? "").trim().slice(0, 400);
    if (!description) imageFailure("ANALYSIS_SCHEMA", "AI answer omitted the image description", true);
    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 6)
      : [];
    const list = (value: unknown, max: number) => Array.isArray(value)
      ? value.map((v) => String(v).trim()).filter(Boolean).slice(0, max)
      : [];
    const nullable = (value: unknown) => {
      const text = typeof value === "string" ? value.trim() : "";
      return text ? text.slice(0, 100) : null;
    };
    const fieldConfidence = parsed.field_confidence && typeof parsed.field_confidence === "object" && !Array.isArray(parsed.field_confidence)
      ? Object.fromEntries(
          Object.entries(parsed.field_confidence as Record<string, unknown>)
            .slice(0, 20)
            .map(([name, value]) => [name.slice(0, 60), Math.max(0, Math.min(1, Number(value) || 0))]),
        )
      : {};
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    const productType = String(parsed.product_type ?? "").trim().slice(0, 100);
    const hasBoundaryConfidence = typeof parsed.object_boundary_confidence === "number";
    const boundaryConfidence = Math.max(0, Math.min(1, Number(parsed.object_boundary_confidence) || 0));
    const recognitionStatus = parsed.is_product !== false && confidence >= 0.72 && Boolean(productType) && (!hasBoundaryConfidence || boundaryConfidence >= 0.48)
      ? "clear"
      : "uncertain";
    return {
      description,
      keywords: keywords.slice(0, 8),
      is_product: parsed.is_product !== false,
      product_type: productType,
      product_subtype: nullable(parsed.product_subtype),
      category: String(parsed.category ?? "").trim().slice(0, 100),
      primary_color: nullable(parsed.primary_color),
      secondary_colors: list(parsed.secondary_colors, 5),
      material: nullable(parsed.material),
      style: nullable(parsed.style),
      shape: nullable(parsed.shape),
      pattern: nullable(parsed.pattern),
      visible_text: list(parsed.visible_text, 8),
      brand: nullable(parsed.brand),
      model_number: nullable(parsed.model_number),
      functions: list(parsed.functions, 8),
      connectors: list(parsed.connectors, 8),
      controls: list(parsed.controls, 8),
      package_specs: list(parsed.package_specs, 10),
      distinctive_features: list(parsed.distinctive_features, 10),
      field_confidence: fieldConfidence,
      visibility_warnings: list(parsed.visibility_warnings, 8).filter((warning) => [
        "low_contrast", "blur", "overexposure", "underexposure", "reflection", "transparency", "occlusion",
      ].includes(warning.toLowerCase())).map((warning) => warning.toLowerCase()),
      object_boundary_confidence: boundaryConfidence,
      text_legibility: Math.max(0, Math.min(1, Number(parsed.text_legibility) || 0)),
      recognition_status: recognitionStatus,
      inspection_passes: inspectionPasses,
      confidence,
      image_data_url: dataUrl,
    };
  } catch (cause) {
    if (cause instanceof ImageProcessingError) throw cause;
    imageFailure("ANALYSIS_EXCEPTION", cause instanceof Error ? cause.message : "Unexpected image analysis failure", true);
  }
}

export async function fastImageLookup(
  sb: MessengerClient,
  storeId: string,
  imageUrl: string,
  pageToken: string,
  messageId: string,
): Promise<{
  analysis: ImageAnalysis | null;
  match: VisualMatch | null;
  candidateIds: string[];
  photo: { bytes: Uint8Array; type: string } | null;
}> {
  // Memorised photo fingerprints: a catalogue photo sent back by a customer is
  // recognised in milliseconds with no AI call. Anything uncertain falls
  // through to the AI inspection below, with the closest products pinned.
  let photo: { bytes: Uint8Array; type: string } | null = null;
  try {
    const download = await downloadMessengerImage(imageUrl, pageToken, messageId);
    photo = download;
    const { findProductByPhoto } = await import("@/lib/photo-match.server");
    const found = await findProductByPhoto(sb, storeId, download.bytes, download.type || "image/jpeg");
    const candidateIds = found.candidateIds;
    console.log(`[messenger] photo match store=${storeId} method=${found.method ?? "none"} score=${found.score.toFixed(3)} ms=${found.ms}`);
    if (!found.product) return { analysis: null, match: null, candidateIds, photo };
    const product = found.product as any;
    const top = { distance: Math.round((1 - found.score) * 128) };
    const margin = found.margin;
    const row = { ...product, id: product.id } as ProductRow;
    const confidence = Math.min(0.99, Math.round(found.score * 100) / 100);
    const analysis: ImageAnalysis = {
      description: row.name,
      keywords: [row.name],
      is_product: true,
      product_type: row.name,
      product_subtype: null,
      category: "",
      primary_color: null,
      secondary_colors: [],
      material: null,
      style: null,
      shape: null,
      pattern: null,
      visible_text: [],
      brand: row.brand ?? null,
      model_number: null,
      functions: [],
      connectors: [],
      controls: [],
      package_specs: [],
      distinctive_features: [],
      field_confidence: {},
      visibility_warnings: [],
      object_boundary_confidence: confidence,
      text_legibility: 0,
      recognition_status: "clear",
      inspection_passes: 1,
      confidence,
      image_data_url: "",
    };
    return {
      analysis,
      match: {
        product: row,
        confidence,
        verdict: "exact",
        reason: `Photo match via ${found.method} (score ${found.score.toFixed(3)}, margin ${margin.toFixed(3)}, ${found.ms}ms)`,
        evidence: [found.method === "vector" ? "fast_image_vector" : "fast_image_fingerprint"],
      },
      candidateIds,
      photo,
    };
  } catch {
    // Any index problem falls back to description plus the preloaded text index.
    return { analysis: null, match: null, candidateIds: [], photo };
  }
}
