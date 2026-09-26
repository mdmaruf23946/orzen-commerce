// Shared Messenger webhook processing. The public route and the queue worker
// both call these directly — never over HTTP to our own origin (a self-request
// from the Worker back through Cloudflare fails with 522 and drops replies).
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildSystemPrompt, generateAgentReply, loadAiContext, resolveFocusProduct } from "@/lib/ai-agent.server";
import {
  sendProductCard,
  sendProductCarousel,
  sendQuickReplies,
  sendText,
  sendViewSiteButton,
  type ProductCardInput,
} from "@/lib/messenger-send.server";
import { checkDuplicate } from "@/lib/duplicate-guard.server";
import { sanitizeOutgoingText, type PayloadFacts } from "@/lib/messenger-text";
import {
  normalizeOrderFlow,
  renderConfirmation,
  requiredSlotFields,
  type OrderFlowConfig,
} from "@/lib/messenger-order-flow";
import {
  buildBuyNowMessage,
  buildMissingFieldsMessage,
  fetchDeliveryZones,
  money,
  resolveDeliveryCharge,
  toBnDigits,
} from "@/lib/chat-order-format";

// Absolute origin used for images and product links sent to Messenger.
// Configurable per deployment so it follows the live custom domain.
// Read lazily: env is injected per request on Workers.
function publicOrigin() {
  return (process.env["PUBLIC_SITE_ORIGIN"] || "https://orzen.top").replace(/\/$/, "");
}
const PRODUCT_STOPWORDS = new Set([
  "this", "that", "these", "those", "show", "send", "photo", "image", "picture", "pic", "please", "price", "details", "do", "you", "have", "any",
  "এটা", "এইটা", "ওটা", "এই", "ওই", "এর", "টার", "একটা", "একটি", "ছবি", "দাও", "দেন", "দেখাও", "দেখান", "কি", "কী", "আছে", "দাম", "কত", "ডিটেইলস", "বিস্তারিত", "প্লিজ", "আমাদের", "আপনাদের", "তোমার", "কাছে", "হবে", "লাগবে",
]);
const PRODUCT_SYNONYMS: Record<string, string[]> = {
  "ব্যাগ": ["bag", "school bag", "backpack"],
  "স্কুল": ["school"],
  "কলম": ["pen"],
  "পেন": ["pen"],
  "বই": ["book"],
  "জুতা": ["shoe", "shoes", "sandal"],
  "ঘড়ি": ["watch", "clock"],
  "কাপড়": ["cloth", "dress", "shirt"],
  "ড্রেস": ["dress"],
  "শার্ট": ["shirt"],
  "প্যান্ট": ["pant", "trouser"],
  "ফোন": ["phone", "mobile"],
  "মোবাইল": ["mobile", "phone"],
  "চার্জার": ["charger"],
  "হেডফোন": ["headphone", "earphone"],
  "ইয়ারফোন": ["earphone", "headphone"],
  "প্রজেক্টর": ["projector"],
  "বেডশিট": ["bedsheet", "bed sheet"],
  "ফ্যান": ["fan"],
  "লাইট": ["light"],
};

type ProductRow = {
  id: string;
  name: string;
  slug: string | null;
  brand?: string | null;
  sku?: string | null;
  product_code?: string | null;
  category_id?: string | null;
  short_description?: string | null;
  description?: string | null;
  price: number | string;
  old_price?: number | string | null;
  stock: number;
  primary_image_url?: string | null;
  gallery?: string[] | null;
  features?: unknown;
  specifications?: unknown;
  variants?: unknown;
  total_sold?: number | null;
  rating?: number | null;
  is_featured?: boolean | null;
};

type ImageAnalysis = {
  description: string;
  keywords: string[];
  is_product: boolean;
  product_type: string;
  product_subtype: string | null;
  category: string;
  primary_color: string | null;
  secondary_colors: string[];
  material: string | null;
  style: string | null;
  shape: string | null;
  pattern: string | null;
  visible_text: string[];
  brand: string | null;
  model_number: string | null;
  functions: string[];
  connectors: string[];
  controls: string[];
  package_specs: string[];
  distinctive_features: string[];
  field_confidence: Record<string, number>;
  visibility_warnings: string[];
  object_boundary_confidence: number;
  text_legibility: number;
  recognition_status: "clear" | "uncertain";
  inspection_passes: 1 | 2;
  confidence: number;
  image_data_url: string;
};

type VisualMatch = {
  product: ProductRow;
  confidence: number;
  reason: string;
  verdict: "exact" | "close";
  evidence: string[];
};

class ImageProcessingError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable: boolean) {
    super(`IMAGE_${retryable ? "RETRYABLE" : "TERMINAL"}_${code}: ${message}`.slice(0, 450));
    this.name = "ImageProcessingError";
    this.code = code;
    this.retryable = retryable;
  }
}

const IMAGE_FETCH_HEADERS = {
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  "User-Agent": "Mozilla/5.0 (compatible; ORZEN-Messenger/1.0)",
};

function imageFailure(code: string, detail: string, retryable: boolean): never {
  throw new ImageProcessingError(code, detail, retryable);
}

async function responseErrorMessage(response: Response) {
  const body = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: { message?: string } };
    return String(parsed.message ?? parsed.error?.message ?? `HTTP ${response.status}`).slice(0, 240);
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function refreshMessengerImageUrl(pageToken: string, messageId: string) {
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

async function downloadMessengerImage(url: string, pageToken: string, messageId: string) {
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

function parseResponsesText(rawStream: string, stage: "ANALYSIS" | "MATCH") {
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

function admin() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function fbSend(pageToken: string, recipientId: string, text: string) {
  const r = await fetch(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(pageToken)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: "RESPONSE",
        message: { text },
      }),
    },
  );
  const j = await r.json().catch(() => ({} as any));
  if (!r.ok) throw new Error(j?.error?.message || `Send failed (${r.status})`);
  return j as { message_id?: string };
}

/** Show the Page "typing…" bubble instantly so replies feel immediate. */
async function fbTyping(pageToken: string, recipientId: string) {
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(pageToken)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, sender_action: "typing_on" }),
  });
}

/** Merchant-controlled pacing: wait only the time still left after the AI worked. */
async function waitRemainingDelay(startedAt: number, delaySeconds: number) {
  const target = Math.max(0, Math.min(600, Number(delaySeconds) || 0)) * 1000;
  const left = target - (Date.now() - startedAt);
  if (left > 0) await new Promise((r) => setTimeout(r, left));
}

async function fbSendImage(pageToken: string, recipientId: string, imageUrl: string) {
  const r = await fetch(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(pageToken)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: "RESPONSE",
        message: {
          attachment: {
            type: "image",
            payload: { url: imageUrl, is_reusable: true },
          },
        },
      }),
    },
  );
  const j = await r.json().catch(() => ({} as any));
  if (!r.ok) throw new Error(j?.error?.message || `Image send failed (${r.status})`);
  return j as { message_id?: string };
}

function publicImageUrl(value: string | null | undefined) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/api/img/")) return `${publicOrigin()}${value}`;
  const clean = value.replace(/^\/+/, "");
  return `${publicOrigin()}/api/img/${clean}`;
}

function productPageUrl(storeSlug: string | null | undefined, product: ProductRow) {
  const slug = storeSlug || "store";
  return `${publicOrigin()}/store/${slug}/product/${product.id}`;
}

function firstProductImage(product: ProductRow) {
  if (product.primary_image_url) return publicImageUrl(product.primary_image_url);
  const gallery = Array.isArray(product.gallery) ? product.gallery : [];
  return publicImageUrl(gallery.find(Boolean));
}

function productImages(product: ProductRow, limit = 4) {
  const values = [product.primary_image_url, ...(Array.isArray(product.gallery) ? product.gallery : [])]
    .map((value) => publicImageUrl(value))
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(values)).slice(0, limit);
}

function productIdentityText(product: ProductRow, categoryName = "") {
  return [
    product.name,
    product.brand,
    categoryName,
    product.sku,
    product.product_code,
    product.short_description,
    product.description,
    stringifyField(product.features),
    stringifyField(product.specifications),
    stringifyField(product.variants),
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 900);
}

function stringifyField(value: unknown): string {
  if (!value) return "";
  if (Array.isArray(value)) return value.map(stringifyField).join(" ");
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).map(stringifyField).join(" ");
  return String(value);
}

function productSearchTerms(raw: string) {
  const compact = raw.toLowerCase().replace(/[.,!?;:()\[\]{}"'`~|/\\]+/g, " ");
  const terms = new Set<string>();
  for (const token of compact.split(/\s+/).map((t) => t.trim()).filter(Boolean)) {
    if (token.length < 2 || PRODUCT_STOPWORDS.has(token)) continue;
    terms.add(token);
    for (const synonym of PRODUCT_SYNONYMS[token] ?? []) terms.add(synonym.toLowerCase());
  }
  for (const [bn, synonyms] of Object.entries(PRODUCT_SYNONYMS)) {
    if (compact.includes(bn)) {
      terms.add(bn);
      synonyms.forEach((s) => terms.add(s.toLowerCase()));
    }
  }
  return Array.from(terms);
}

function isPhotoIntent(text: string) {
  return /ছবি|ফটো|ইমেজ|photo|image|picture|pic/i.test(text);
}

function isProductIntent(text: string) {
  return /প্রোডাক্ট|পণ্য|দেখান|দেখাও|কী আছে|কি আছে|দাম|কত|বিস্তারিত|ডিটেইলস|product|item|price|show|details/i.test(text);
}

function isOrderStatusIntent(text: string) {
  // Tracking, status, cancel, return, refund — must be handled by the AI agent (trackOrder tool), not the buy flow.
  return /(where.*(is|are).*(my )?order|track.*order|order.*(status|track)|cancel.*order|return.*order|refund|আমার অর্ডার কোথায়|অর্ডার কোথায়|অর্ডার (ট্র্যাক|ট্রাক|ষ্ট্যাটাস|স্ট্যাটাস|স্টেটাস|status)|অর্ডার (বাতিল|ক্যান্সেল|cancel)|রিটার্ন|ফেরত)/i.test(text);
}

function isOrderIntent(text: string) {
  if (isOrderStatusIntent(text)) return false;
  return /অর্ডার|কিনতে|নিতে চাই|নিব|নেব|buy now|buy|order|purchase|checkout/i.test(text);
}

function isReferenceIntent(text: string) {
  return /এটা|এইটা|ওটা|এই|ওই|this|that|it|same/i.test(text);
}

/** True only when the person actually asked about our wellbeing. */
function isHowAreYouIntent(text: string) {
  const compact = text.trim().toLowerCase().replace(/[।!?.,\s]+$/u, "");
  return /(কেমন আছেন|কেমন আছো|কেমন আছিস|কি অবস্থা|কী অবস্থা|কি খবর|কী খবর|how are you|how r u|how'?s it going|what'?s up|whats up)/i.test(
    compact,
  );
}

function isSalamIntent(text: string) {
  return /(আসসালামু|আসসালাম|সালাম|assalam|salam)/i.test(text);
}

function isGreetingIntent(text: string) {
  const compact = text.trim().toLowerCase().replace(/[।!?.,\s]+$/u, "");
  if (!compact) return false;
  if (
    compact.length <= 8 &&
    /^(হি+|হে+ই*|হাই+|হ্যালো+|হেলো+|ওহে|ইয়ো|hi+|hai+|hey+|yo+|helo+|hello+|salam|sallam)$/u.test(compact)
  ) {
    return true;
  }
  if (/^(assalamu alaikum|assalamualaikum|আসসালামু আলাইকুম|আসসালামুআলাইকুম|সালাম)$/i.test(compact)) return true;
  return isHowAreYouIntent(compact);
}

function isSmallTalkIntent(text: string) {
  return isGreetingIntent(text) || isHowAreYouIntent(text);
}

/** The reply must match what was actually said — never volunteer "ভালো আছি" for a plain "হেই". */
function smallTalkReply(text: string) {
  const salam = isSalamIntent(text);
  const asked = isHowAreYouIntent(text);
  if (salam && asked) return "ওয়ালাইকুম আসসালাম। আলহামদুলিল্লাহ ভালো আছি। বলুন, কীভাবে সাহায্য করতে পারি?";
  if (salam) return "ওয়ালাইকুম আসসালাম। বলুন, কীভাবে সাহায্য করতে পারি?";
  if (asked) return "আলহামদুলিল্লাহ ভালো আছি, ধন্যবাদ। বলুন, কীভাবে সাহায্য করতে পারি?";
  return "হ্যালো! বলুন, কীভাবে সাহায্য করতে পারি?";
}

function sanitizeMessengerReply(reply: string, latestText: string) {
  const text = reply.trim();
  if (!text) return text;
  if (/productId|product_id|must_use_focus_product|tool|database|undefined|null/i.test(text)) {
    if (isSmallTalkIntent(latestText)) return smallTalkReply(latestText);
    return "দুঃখিত, আপনার কথাটা বুঝেছি—কোন প্রোডাক্টটি চান সেটার নাম আরেকবার লিখলে আমি ঠিকভাবে ছবিসহ দেখাচ্ছি।";
  }
  return text;
}

async function searchDirectProducts(sb: ReturnType<typeof admin>, storeId: string, text: string, limit = 6) {
  const productSelect =
    "product_id,name,slug,brand,product_code,sku,category_id,short_description,description,price,old_price,stock,primary_image_url,gallery,features,specifications,variants,total_sold,rating,is_featured";
  const [{ data: products }, { data: categories }, { data: blocked }] = await Promise.all([
    sb.from("ai_product_catalog").select(productSelect).eq("store_id", storeId).eq("status", "active").gt("stock", 0).limit(500),
    sb.from("categories").select("id,name").eq("store_id", storeId),
    sb.from("ai_product_blacklist").select("product_id").eq("store_id", storeId),
  ]);
  const blockedIds = new Set((blocked ?? []).map((r: any) => r.product_id));
  const cats = new Map((categories ?? []).map((c: any) => [c.id, c.name]));
  const terms = productSearchTerms(text);
  const phrase = text.toLowerCase().trim();
  const scored = ((products ?? []) as unknown as Array<Omit<ProductRow, "id"> & { product_id: string }>)
    .map((product) => ({ ...product, id: product.product_id }))
    .filter((p) => !blockedIds.has(p.id))
    .map((p) => {
      const categoryName = cats.get(p.category_id ?? "") ?? "";
      const haystack = [
        p.name,
        p.brand,
        p.sku,
        p.product_code,
        categoryName,
        p.short_description,
        p.description,
        stringifyField(p.features),
        stringifyField(p.specifications),
        stringifyField(p.variants),
      ].join(" ").toLowerCase();
      let score = 0;
      if (phrase && haystack.includes(phrase)) score += 60;
      for (const term of terms) {
        if (haystack.includes(term)) score += 25;
        if (String(p.name ?? "").toLowerCase().includes(term)) score += 20;
        if (String(categoryName).toLowerCase().includes(term)) score += 15;
      }
      if (p.primary_image_url || (Array.isArray(p.gallery) && p.gallery.length > 0)) score += 12;
      if (p.is_featured) score += 6;
      score += Math.min(Number(p.total_sold) || 0, 50) / 10;
      score += Math.min(Number(p.rating) || 0, 5);
      return { product: p, score };
    });
  const ranked = terms.length ? scored.filter((r) => r.score >= 25) : scored;
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit).map((r) => r.product);
}

async function getRecentRecommendedProducts(sb: ReturnType<typeof admin>, storeId: string, conversationId: string, limit = 5) {
  const { data: recs } = await sb
    .from("ai_product_recommendations")
    .select("product_id")
    .eq("store_id", storeId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit * 3);
  const ids = Array.from(new Set((recs ?? []).map((r: any) => r.product_id).filter(Boolean))).slice(0, limit);
  if (!ids.length) return [];
  const { data } = await sb
    .from("products")
    .select("id,name,slug,brand,product_code,sku,category_id,short_description,description,price,old_price,stock,primary_image_url,gallery,features,specifications,variants,total_sold,rating,is_featured")
    .eq("store_id", storeId)
    .eq("status", "active")
    .in("id", ids);
  const byId = new Map(((data ?? []) as ProductRow[]).map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as ProductRow[];
}

async function getConversationPendingOrder(sb: ReturnType<typeof admin>, conversationId: string) {
  const { data } = await sb
    .from("ai_conversations")
    .select("psid_profile")
    .eq("id", conversationId)
    .maybeSingle();
  const profile = ((data as any)?.psid_profile ?? {}) as Record<string, any>;
  return (profile.pending_order ?? {}) as Record<string, any>;
}

async function patchConversationPendingOrder(
  sb: ReturnType<typeof admin>,
  conversationId: string,
  patch: Record<string, any>,
) {
  const { data } = await sb
    .from("ai_conversations")
    .select("psid_profile")
    .eq("id", conversationId)
    .maybeSingle();
  const profile = { ...(((data as any)?.psid_profile ?? {}) as Record<string, any>) };
  profile.pending_order = { ...(profile.pending_order ?? {}), ...patch };
  await sb.from("ai_conversations").update({ psid_profile: profile } as any).eq("id", conversationId);
  return profile.pending_order as Record<string, any>;
}

const ORDER_FIELD_BN: Record<string, string> = {
  customer_name: "নাম",
  phone: "ফোন নম্বর",
  district: "জেলা",
  upazila: "থানা/উপজেলা",
  union: "ইউনিয়ন",
  village: "গ্রাম",
  area: "এলাকা",
  full_address: "সম্পূর্ণ ঠিকানা",
  qty: "কতটি লাগবে",
  payment_method: "পেমেন্ট মেথড (COD/bKash/Nagad)",
  note: "অতিরিক্ত নোট",
};

/** Store-admin configured Buy Now flow for this store. */
async function loadStoreOrderFlow(sb: ReturnType<typeof admin>, storeId: string): Promise<OrderFlowConfig> {
  const { data } = await sb
    .from("store_ai_agents")
    .select("order_flow")
    .eq("store_id", storeId)
    .maybeSingle();
  return normalizeOrderFlow((data as any)?.order_flow);
}

function orderMissingFields(slot: Record<string, any>, cfg?: OrderFlowConfig) {
  // Chat orders are always cash on delivery, so the customer is never asked
  // to choose a payment method.
  const keys = requiredSlotFields(cfg ?? normalizeOrderFlow(null)).filter(
    (k) => k !== "product_id" && k !== "payment_method",
  );
  return keys.filter((k) => !slot[k]).map((k) => ORDER_FIELD_BN[k] ?? k);
}

function normalizePhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("8801") && digits.length === 13) return `0${digits.slice(3)}`;
  if (digits.startsWith("01") && digits.length === 11) return digits;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

function extractPhone(text: string) {
  const bdMatch = text.match(/(?:\+?88[-\s]?)?01[3-9][\d\s-]{8,12}/);
  if (bdMatch) return normalizePhone(bdMatch[0]);
  const generic = text.match(/\+?\d[\d\s-]{7,18}\d/);
  return generic ? normalizePhone(generic[0]) : null;
}

function normalizePaymentMethod(text: string) {
  const compact = text.toLowerCase();
  if (/\bcod\b|cash\s*on\s*delivery|cash|ক্যাশ|ডেলিভারিতে|হাতে টাকা|ক্যাশ অন ডেলিভারি/i.test(compact)) return "cod";
  if (/bkash|b-kash|বিকাশ/i.test(compact)) return "bkash";
  if (/nagad|নগদ/i.test(compact)) return "nagad";
  if (/rocket|রকেট/i.test(compact)) return "rocket";
  if (/bank|ব্যাংক/i.test(compact)) return "bank";
  return null;
}

function extractQty(text: string) {
  const match = text.match(/(?:qty|quantity|পরিমাণ)\s*[:：-]?\s*(\d{1,2})|\b(\d{1,2})\s*(?:pcs|pieces|piece|পিস|টা|টি)\b/i);
  const qty = match ? Number(match[1] ?? match[2]) : null;
  return qty && qty > 0 && qty <= 99 ? qty : null;
}

function isPaymentLine(line: string) {
  return !!normalizePaymentMethod(line) && line.trim().replace(/[\s.,।-]+/g, "").length <= 24;
}

function extractEmail(text: string) {
  const m = String(text ?? "").match(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/);
  return m ? m[0].toLowerCase().slice(0, 160) : null;
}

/** Strip a leading serial marker like "1." / "১)" / "৩-" from a line. */
const SERIAL_RE = /^\s*[(\[]?[\d০-৯]{1,2}\s*[).:\-–।]\s*/;

function stripSerial(line: string) {
  return line.replace(SERIAL_RE, "").trim();
}

function parseOrderDetailsText(text: string) {
  const rawLines = text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const phone = extractPhone(text);
  const email = extractEmail(text);
  const qty = extractQty(text);

  const patch: Record<string, any> = {};

  // Customers answer the numbered prompt: 1) name 2) phone 3) email 4) address 5) note
  const serialLines = rawLines.filter((l) => SERIAL_RE.test(l));
  if (serialLines.length >= 2) {
    const parts = serialLines.map(stripSerial).filter(Boolean);
    const [p1, p2, p3, p4, p5] = parts;
    const nonPhone = (v?: string) => (v && !extractPhone(v) && !extractEmail(v) ? v : undefined);
    const name = nonPhone(p1);
    if (name) patch.customer_name = name.slice(0, 120);
    const addressCandidates = [p4, p5, p3]
      .filter((v): v is string => !!v && !extractPhone(v) && !extractEmail(v))
      .filter((v) => v !== name);
    if (addressCandidates.length) patch.full_address = addressCandidates[0]!.slice(0, 500);
    const note = p5 && p5 !== patch.full_address && !extractEmail(p5) && !extractPhone(p5) ? p5 : null;
    if (note) patch.note = note.slice(0, 300);
    if (!patch.full_address && p2 && !extractPhone(p2)) patch.full_address = p2.slice(0, 500);
  }

  const cleanedLines = rawLines
    .map((line) => stripSerial(line))
    .map((line) => (phone ? line.replace(/(?:\+?88[-\s]?)?01[3-9][\d\s-]{8,12}/g, "") : line))
    .map((line) => (email ? line.replace(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/g, "") : line))
    .map((line) => line.trim())
    .filter((line) => line && !isPaymentLine(line));

  let customer_name: string | undefined = patch.customer_name;
  let full_address: string | undefined = patch.full_address;

  const nameMatch = text.match(/(?:^|\n|\b)(?:name|নাম)\s*[:：-]?\s*([^\n,;|]+)/i);
  if (!customer_name && nameMatch?.[1]) customer_name = nameMatch[1].trim();
  const addressMatch = text.match(/(?:address|ঠিকানা|এড্রেস)\s*[:：-]?\s*([^|]+)/i);
  if (!full_address && addressMatch?.[1]) full_address = addressMatch[1].trim();

  if (!customer_name) {
    const firstNameLike = cleanedLines.find((line) => {
      const withoutDigits = line.replace(/[\d+()-]/g, "").trim();
      return withoutDigits.length >= 2 && withoutDigits.length <= 80 && !/,/.test(withoutDigits);
    });
    if (firstNameLike) customer_name = firstNameLike;
  }

  if (!full_address) {
    const addressLines = cleanedLines.filter((line) => line !== customer_name);
    if (addressLines.length) full_address = addressLines.join(", ");
  }

  if (customer_name) patch.customer_name = customer_name.slice(0, 120);
  if (phone) patch.phone = phone;
  if (email) patch.email = email;
  if (full_address) patch.full_address = full_address.slice(0, 500);
  if (qty) patch.qty = qty;
  return patch;
}

function looksLikeOrderDetails(text: string) {
  const hasPhone = !!extractPhone(text);
  const hasPayment = !!normalizePaymentMethod(text);
  const hasAddress = /,|address|ঠিকানা|এড্রেস|গ্রাম|ইউনিয়ন|উপজেলা|জেলা|চট্টগ্রাম|ঢাকা|house|road|village|district|upazila/i.test(text);
  return (hasPhone && (hasPayment || hasAddress)) || (hasPayment && hasAddress);
}

async function replaceConversationProfile(
  sb: ReturnType<typeof admin>,
  conversationId: string,
  updater: (profile: Record<string, any>) => Record<string, any>,
) {
  const { data } = await sb
    .from("ai_conversations")
    .select("psid_profile")
    .eq("id", conversationId)
    .maybeSingle();
  const profile = { ...(((data as any)?.psid_profile ?? {}) as Record<string, any>) };
  const next = updater(profile);
  await sb.from("ai_conversations").update({ psid_profile: next } as any).eq("id", conversationId);
  return next;
}

async function finalizePendingMessengerOrder(opts: {
  sb: ReturnType<typeof admin>;
  storeId: string;
  conversationId: string;
  psid: string;
  token: string;
}) {
  const { sb, storeId, conversationId, psid, token } = opts;
  const slot = await getConversationPendingOrder(sb, conversationId);
  const flowCfg = await loadStoreOrderFlow(sb, storeId);
  const missing = orderMissingFields(slot, flowCfg);
  if (!slot.product_id) missing.unshift("প্রোডাক্ট");
  if (missing.length) {
    await sendAndLogText(sb, token, psid, conversationId, buildMissingFieldsMessage(missing));
    return true;
  }

  const qty = Math.max(1, Math.min(Number(slot.qty ?? 1) || 1, 99));
  const { data: product } = await sb
    .from("products")
    .select("id,name,price,stock,status,delivery_charge")
    .eq("store_id", storeId)
    .eq("id", slot.product_id)
    .maybeSingle();

  if (!product || product.status !== "active") {
    await sendAndLogText(sb, token, psid, conversationId, "দুঃখিত, এই প্রোডাক্টটি এখন অর্ডারের জন্য পাওয়া যাচ্ছে না। অন্য প্রোডাক্ট চাইলে নাম লিখুন।");
    return true;
  }
  if (Number(product.stock) < qty) {
    await sendAndLogText(sb, token, psid, conversationId, `দুঃখিত, ${product.name} এর স্টক এখন ${Number(product.stock)}টি। কম quantity চাইলে বলুন, আমি অর্ডার করে দিচ্ছি।`);
    return true;
  }

  const blocked = await maybeBlockDuplicateMessengerOrder({
    sb,
    storeId,
    conversationId,
    psid,
    token,
    slot,
    product: { id: product.id, name: product.name },
  });
  if (blocked) return true;

  const subtotal = Number(product.price) * qty;
  const addressText = [slot.full_address, slot.area, slot.village, slot.union, slot.upazila, slot.district]
    .filter(Boolean)
    .join(", ");
  const zones = await fetchDeliveryZones(sb, storeId);
  const { charge: delivery, zone } = resolveDeliveryCharge(
    addressText,
    zones,
    (product as any).delivery_charge,
  );
  const total = subtotal + delivery;
  const { data: invoiceNo } = await sb.rpc("generate_invoice_no", { _store_id: storeId } as any);
  const { data: order, error: orderError } = await sb
    .from("orders")
    .insert({
      store_id: storeId,
      customer_name: String(slot.customer_name).trim(),
      phone: normalizePhone(slot.phone) ?? String(slot.phone).trim(),
      email: slot.email ? String(slot.email).trim() : null,
      address: String(slot.full_address).trim(),
      area:
        [slot.village, slot.union, slot.upazila, slot.district].filter(Boolean).join(", ") ||
        zone?.name ||
        null,
      payment_method: "cod",
      subtotal: total,
      delivery_amount: delivery,
      delivery_zone_id: zone?.id ?? null,
      discount_amount: 0,
      status: "pending",
      invoice_no: invoiceNo || null,
      notes: slot.note
        ? `Placed via Messenger AI Sales Agent — ${String(slot.note).slice(0, 300)}`
        : "Placed via Messenger AI Sales Agent",
    } as any)
    .select("id,invoice_no")
    .single();

  if (orderError || !order) {
    const errorText = orderError?.message ?? "Order failed";
    await sendAndLogText(sb, token, psid, conversationId, "দুঃখিত, অর্ডারটি কনফার্ম করতে সমস্যা হয়েছে। আমাদের টিম একটু পর দেখে জানাবে।");
    await sb.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "system",
      direction: "out",
      message_type: "text",
      content: "[order create failed]",
      delivery_status: "failed",
      error: errorText,
    } as any);
    throw new Error(errorText);
  }

  const { error: itemError } = await sb.from("order_items").insert({
    order_id: order.id,
    product_id: product.id,
    name_snapshot: product.name,
    price_snapshot: product.price,
    qty,
  } as any);
  if (itemError) throw new Error(itemError.message);

  await Promise.all([
    sb.from("order_timeline").insert({ store_id: storeId, order_id: order.id, stage: "placed", note: "Order placed via Messenger AI" } as any),
    sb.from("admin_notifications").insert({
      store_id: storeId,
      kind: "new_order",
      title: "New Messenger AI order",
      body: `${slot.customer_name} ordered ${qty}× ${product.name}`,
      meta: { order_id: order.id, conversation_id: conversationId },
    } as any),
    sb.from("ai_conversations").update({
      customer_name: String(slot.customer_name).trim(),
      phone: normalizePhone(slot.phone) ?? String(slot.phone).trim(),
      address: String(slot.full_address).trim(),
      lead_status: "ordered",
    } as any).eq("id", conversationId),
  ]);

  await replaceConversationProfile(sb, conversationId, (profile) => {
    delete profile.pending_order;
    return {
      ...profile,
      last_order: {
        order_id: order.id,
        invoice_no: order.invoice_no,
        product_id: product.id,
        product_name: product.name,
        qty,
        total,
        created_at: new Date().toISOString(),
      },
    };
  });

  const template = String(flowCfg.confirmation_message ?? "");
  const uses = (key: string) => new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "i").test(template);
  const lines = [
    renderConfirmation(template, {
      product: product.name,
      qty,
      total: money(total),
      customer_name: slot.customer_name,
      address: slot.full_address,
      payment_method: "ক্যাশ অন ডেলিভারি",
      invoice_no: order.invoice_no || order.id,
    }),
  ];
  // Only add the summary lines the admin's own template doesn't already cover.
  lines.push("────────────────");
  if (!uses("invoice_no")) lines.push(`🧾 অর্ডার নম্বর: ${order.invoice_no || order.id}`);
  if (!uses("product") && !uses("qty")) lines.push(`🛍️ প্রোডাক্ট: ${product.name} × ${toBnDigits(qty)}`);
  lines.push(`💰 পণ্যের মূল্য: ${money(subtotal)}`);
  lines.push(`🚚 ডেলিভারি চার্জ${zone ? ` (${zone.name})` : ""}: ${money(delivery)}`);
  if (!uses("total")) lines.push(`✅ সর্বমোট: ${money(total)}`);
  if (!uses("payment_method")) lines.push("💵 পেমেন্ট: ক্যাশ অন ডেলিভারি");
  const confirmation = lines.filter(Boolean).join("\n");
  await sendAndLogText(sb, token, psid, conversationId, confirmation);
  return true;
}

async function maybeBlockDuplicateMessengerOrder(opts: {
  sb: ReturnType<typeof admin>;
  storeId: string;
  conversationId: string;
  psid: string;
  token: string;
  slot: Record<string, any>;
  product: { id: string; name?: string | null };
}) {
  const { sb, storeId, conversationId, psid, token, slot, product } = opts;
  if (!product.id) return false;

  const { data: dpSettings } = await sb
    .from("store_duplicate_protection")
    .select("messenger_enabled, messenger_custom_reply")
    .eq("store_id", storeId)
    .maybeSingle();
  if (dpSettings && (dpSettings as any).messenger_enabled === false) return false;

  const normalizedPhone = normalizePhone(slot.phone) ?? String(slot.phone ?? "").trim();
  const dup = await checkDuplicate({
    storeId,
    phone: normalizedPhone || null,
    customerId: null,
    fingerprint: null,
    deviceId: null,
    productIds: [product.id],
    psid,
  });
  if (dup.action === "allow") return false;

  const invoice = shortOrderNo(dup.matchedOrder?.invoice_no, dup.matchedOrder?.id);
  const status = orderStatusBn(dup.matchedOrder?.status);
  const defaultReply = [
    "আপনার এই পণ্যের একটি অর্ডার ইতোমধ্যে রয়েছে।",
    `অর্ডার নম্বর: #${invoice}`,
    `স্ট্যাটাস: ${status}`,
    "একই পণ্যের জন্য নতুন অর্ডার দেওয়ার আগে বর্তমান অর্ডারটি সম্পন্ন অথবা বাতিল হওয়া প্রয়োজন।",
    "আপনার কি বর্তমান অর্ডারের স্ট্যাটাস জানতে চান?",
  ].join("\n");
  const reply = ((dpSettings as any)?.messenger_custom_reply as string | null) || defaultReply;

  await sb.from("store_duplicate_blocks").insert({
    store_id: storeId,
    phone: normalizedPhone || null,
    matched_rules: dup.matchedRules,
    matched_order_id: dup.matchedOrderId,
    status: "blocked",
    source: "messenger",
    psid,
    product_ids: [product.id],
    payload: {
      customerName: slot.customer_name,
      address: slot.full_address,
      productId: product.id,
      productName: product.name,
      qty: Math.max(1, Math.min(Number(slot.qty ?? 1) || 1, 99)),
      reason: "Duplicate Order Attempt",
    },
  } as any);

  await sendAndLogText(sb, token, psid, conversationId, reply);
  await replaceConversationProfile(sb, conversationId, (profile) => {
    delete profile.pending_order;
    return profile;
  });
  return true;
}

async function maybeApplyPendingOrderText(opts: {
  sb: ReturnType<typeof admin>;
  storeId: string;
  conversationId: string;
  psid: string;
  token: string;
  text: string;
}) {
  // Context-only: merge any order details from this message into the pending-order slot
  // so the LLM sees them via the state block, and block duplicates. NEVER sends a canned reply.
  const { sb, storeId, conversationId, psid, token, text } = opts;
  const current = await getConversationPendingOrder(sb, conversationId);
  const details = parseOrderDetailsText(text);
  const hasNewOrderDetails = Object.keys(details).length > 0;
  if (!hasNewOrderDetails && !isOrderIntent(text)) return false;
  const slot = Object.keys(details).length
    ? await patchConversationPendingOrder(sb, conversationId, { ...current, ...details })
    : current;
  if (!slot.product_id) return false;
  // Customer just sent the details after Buy Now and nothing is missing:
  // create the order and send the confirmation directly (no AI round-trip,
  // which could time out and leave the customer without any reply).
  if (hasNewOrderDetails) {
    const missing = orderMissingFields(slot, await loadStoreOrderFlow(sb, storeId));
    if (!missing.length) {
      return finalizePendingMessengerOrder({ sb, storeId, conversationId, psid, token });
    }
  }
  const blocked = await maybeBlockDuplicateMessengerOrder({
    sb,
    storeId,
    conversationId,
    psid,
    token,
    slot,
    product: { id: String(slot.product_id), name: slot.product_name ?? null },
  });
  return blocked; // true = duplicate short-circuit already replied; false = fall through to LLM
}

async function transcribeAudioAttachment(url: string): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key || !url) return null;
  try {
    const audioRes = await fetch(url);
    if (!audioRes.ok) return null;
    const buf = new Uint8Array(await audioRes.arrayBuffer());
    if (!buf.byteLength) return null;
    let bin = "";
    for (let i = 0; i < buf.byteLength; i++) bin += String.fromCharCode(buf[i]!);
    const b64 = btoa(bin);
    const mime = (audioRes.headers.get("content-type") || "audio/mp4").split(";")[0]!.trim();
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe this voice message verbatim. Return only the transcript text with no extra commentary." },
              { type: "input_audio", input_audio: { data: b64, format: mime.replace(/^audio\//, "") } },
            ],
          },
        ],
      }),
    });
    if (!r.ok) return null;
    const j = (await r.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string } }> } | null;
    const text = j?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null;
  }
}

/**
 * Look at a photo the customer sent and describe it, so the sales agent can act
 * on it (find the product, say it is unavailable, or answer about a receipt).
 */
async function describeImageAttachment(
  url: string,
  pageToken: string,
  messageId: string,
): Promise<ImageAnalysis> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) imageFailure("CONFIG", "AI service is not configured", false);
  try {
    // The model provider cannot fetch Facebook's signed CDN links itself
    // (it returns "Cannot fetch content from the provided URL"), so the bytes
    // are downloaded here and sent inline as a data URL.
    const { bytes, type } = await downloadMessengerImage(url, pageToken, messageId);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const dataUrl = `data:${type};base64,${btoa(binary)}`;

    const prompt =
      "A customer sent this photo to an online shop. Inspect the actual sale item carefully, not the model/person/background. " +
      "First separate the sale item's outline from the background using edges, shadows, seams, cap/port/button boundaries, label layout and texture—not colour contrast alone. " +
      "Handle white-on-white, black-on-black, transparent, reflective, backlit and overexposed items without assuming their colour. " +
      "Read every visible logo, label, model number and package specification. Identify ports/connectors, buttons, display, controls, " +
      "physical construction and likely function. Distinguish visually similar but functionally different products (for example a charger, " +
      "adapter, tracker, speaker, hub or power bank). Return ONLY minified JSON with keys description,keywords,is_product,product_type," +
      "product_subtype,category,primary_color,secondary_colors,material,style,shape,pattern,visible_text,brand,model_number,functions," +
      "connectors,controls,package_specs,distinctive_features,field_confidence,visibility_warnings,object_boundary_confidence,text_legibility,confidence. " +
      "Use null for uncertain single-value attributes and [] for absent lists. confidence is 0..1. " +
      "object_boundary_confidence and text_legibility MUST each be a JSON number from 0 to 1, never text. visibility_warnings may contain ONLY these exact codes: low_contrast, blur, overexposure, underexposure, reflection, transparency, occlusion. " +
      "field_confidence is an object whose keys are only attributes actually observed and whose values are 0..1. " +
      "Never invent specifications that are not visible or reliably identifiable. Do not guess a colour under ambiguous lighting; name exact visible colours only when confident. " +
      "keywords must contain 2-8 concise catalogue terms. is_product is false for receipts, screenshots, documents, selfies or memes.";
    const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: dataUrl },
            ],
          },
        ],
      }),
    });
    if (!r.ok) {
      const detail = await responseErrorMessage(r);
      imageFailure("ANALYSIS_HTTP", detail, r.status === 429 || r.status >= 500);
    }
    if (!r.body) imageFailure("ANALYSIS_BODY", "AI response had no stream", true);
    const raw = parseResponsesText(await r.text(), "ANALYSIS");
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
    const needsFocusedInspection = parsed.is_product !== false && (
      !String(parsed.product_type ?? "").trim() ||
      firstConfidence < 0.82 ||
      (hasFirstTypeConfidence && firstTypeConfidence < 0.68) ||
      (hasFirstBoundaryConfidence && firstBoundaryConfidence < 0.62)
    );
    let inspectionPasses: 1 | 2 = 1;
    if (needsFocusedInspection) {
      const focusedPrompt =
        "Re-inspect this difficult product photo independently. Ignore background colour and isolate the sale item using silhouette edges, local shadows, seams, cap/base, ports, controls, printed-label layout, texture and proportions. " +
        "Pay special attention to white-on-white, black-on-black, transparent, reflective, blurred, backlit or overexposed regions. Read faint text only when genuinely legible. " +
        "Do not invent a brand, model, specification or colour. Return ONLY minified JSON with keys description,keywords,is_product,product_type,product_subtype,category,primary_color,secondary_colors,material,style,shape,pattern,visible_text,brand,model_number,functions,connectors,controls,package_specs,distinctive_features,field_confidence,visibility_warnings,object_boundary_confidence,text_legibility,confidence. " +
        "Use null for uncertain single values and [] for absent lists. object_boundary_confidence, text_legibility, confidence and every field_confidence value MUST be JSON numbers from 0 to 1, never text. visibility_warnings may contain ONLY these exact codes: low_contrast, blur, overexposure, underexposure, reflection, transparency, occlusion.";
      const focusedResponse = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "openai/gpt-6-astra",
          stream: true,
          reasoning: { effort: "medium", summary: "auto" },
          input: [{ role: "user", content: [
            { type: "input_text", text: focusedPrompt },
            { type: "input_image", image_url: dataUrl },
          ] }],
        }),
      });
      if (!focusedResponse.ok) {
        const detail = await responseErrorMessage(focusedResponse);
        imageFailure("FOCUSED_ANALYSIS_HTTP", detail, focusedResponse.status === 429 || focusedResponse.status >= 500);
      }
      if (!focusedResponse.body) imageFailure("FOCUSED_ANALYSIS_BODY", "Focused AI response had no stream", true);
      const focusedRaw = parseResponsesText(await focusedResponse.text(), "ANALYSIS");
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

async function visuallyMatchProduct(
  sb: ReturnType<typeof admin>,
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
  const productSelect =
    "product_id,name,slug,brand,product_code,sku,category_id,short_description,description,price,old_price,stock,primary_image_url,gallery,features,specifications,variants,total_sold,rating,is_featured";
  const [textMatches, blockedResult, categoriesResult] = await Promise.all([
    searchDirectProducts(sb, storeId, query, 20),
    sb.from("ai_product_blacklist").select("product_id").eq("store_id", storeId),
    sb.from("categories").select("id,name").eq("store_id", storeId),
  ]);
  const blockedIds = new Set((blockedResult.data ?? []).map((row: any) => String(row.product_id)));
  const categoryNames = new Map((categoriesResult.data ?? []).map((row: any) => [String(row.id), String(row.name ?? "")]));
  const candidateIds = Array.from(new Set([...imageCandidateIds, ...textMatches.map((product) => product.id)])).slice(0, 20);
  if (!candidateIds.length) return null;
  const { data: candidateRows, error: candidateError } = await sb
    .from("ai_product_catalog")
    .select(productSelect)
    .eq("store_id", storeId)
    .eq("status", "active")
    .gt("stock", 0)
    .in("product_id", candidateIds);
  if (candidateError) imageFailure("CATALOGUE_QUERY", candidateError.message, true);
  const allProducts = ((candidateRows ?? []) as unknown as Array<Omit<ProductRow, "id"> & { product_id: string }>).map((product) => ({
    ...product,
    id: product.product_id,
  })).filter((product) => !blockedIds.has(product.id) && productImages(product, 1).length > 0);
  if (!allProducts.length) return null;
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;

  const requestJson = async (stage: "MATCH", content: any[]) => {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning: { effort: "medium", summary: "auto" },
        stream: true,
        input: [{ role: "user", content }],
      }),
    });
    if (!response.ok) {
      const detail = await responseErrorMessage(response);
      imageFailure(`${stage}_HTTP`, detail, response.status === 429 || response.status >= 500);
    }
    if (!response.body) imageFailure(`${stage}_BODY`, "AI match response had no stream", true);
    const text = parseResponsesText(await response.text(), stage);
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

    // Stage 1: compare the customer's photo with every eligible image in the
    // current store. Eight products × up to three images stays below the model's
    // image limit while covering large catalogues through deterministic batches.
    const ranked: Array<{ product: ProductRow; confidence: number; reason: string; verdict: string }> = [];
    for (let offset = 0; offset < candidates.length; offset += 8) {
      const batch = candidates.slice(offset, offset + 8);
      const content: any[] = [{
        type: "input_text",
        text: "Compare CUSTOMER_IMAGE with each candidate's images. Product function/type must match. Return ONLY minified JSON: " +
          '{"results":[{"index":number,"verdict":"same|close|different","type_compatible":boolean,"confidence":number,"reason":"short visual evidence"}]}. ' +
          "Use same only when model-defining construction, ports, controls, branding/text and proportions agree; colour or shape alone is insufficient. " +
          "Judge by the IMAGES: catalogue names, categories and descriptions may be wrong and must never override an image match. If the customer image is the same photograph as a catalogue image (even cropped, resized, recompressed or Messenger-encoded), return same with confidence 0.99.",
      }, { type: "input_image", image_url: analysis.image_data_url }];
      batch.forEach((product, index) => {
        content.push({ type: "input_text", text: `CANDIDATE_${index}: ${productIdentityText(product, categoryNames.get(String(product.category_id ?? "")) ?? "")}` });
        productImages(product, 3).forEach((image) => content.push({ type: "input_image", image_url: image }));
      });
      const compared = await requestJson("MATCH", content);
      const results = Array.isArray(compared.results) ? compared.results : [];
      for (const raw of results) {
        if (!raw || typeof raw !== "object") continue;
        const value = raw as Record<string, unknown>;
        const index = Number(value.index);
        const product = Number.isInteger(index) ? batch[index] : undefined;
        if (!product || value.type_compatible !== true) continue;
        const verdict = String(value.verdict ?? "different");
        const confidence = Math.max(0, Math.min(1, Number(value.confidence) || 0));
        if ((verdict === "same" || verdict === "close") && confidence >= 0.72) {
          ranked.push({ product, confidence, verdict, reason: String(value.reason ?? "").slice(0, 300) });
        }
      }
    }
    ranked.sort((left, right) => right.confidence - left.confidence);
    if (!ranked.length) return null;

    // Stage 2: independently verify the strongest candidates one at a time.
    // Only this pass can authorize a customer-facing product card.
    let closest: VisualMatch | null = null;
    const strongest = [...ranked]
      .sort((left, right) => {
        if (left.verdict === "same" && right.verdict !== "same") return -1;
        if (right.verdict === "same" && left.verdict !== "same") return 1;
        return right.confidence - left.confidence;
      })
      .slice(0, 6);
    for (const candidate of strongest) {
      const content: any[] = [{
        type: "input_text",
        text: "Final independent verification. Decide whether CUSTOMER_IMAGE and CATALOGUE_IMAGES show the exact same sale product/model. " +
          "Reject if function/type, connector layout, controls, proportions, logo/model text or defining construction conflict in the IMAGES. " +
          "The catalogue name/category/description text is merchant-written and may be inaccurate: any text-vs-image metadata mismatch is NOT conflicting evidence. " +
          "If the customer image is the same photograph as a catalogue image (crop/resize/compression/Messenger encoding only), return exact with confidence 0.99. " +
          "Return ONLY minified JSON: {\"verdict\":\"exact|close|different\",\"type_compatible\":boolean,\"confidence\":number," +
          "\"matching_evidence\":[string],\"conflicting_evidence\":[string],\"reason\":\"short factual reason\"}.",
      }, { type: "input_text", text: `PHOTO IDENTITY: ${query}` },
      { type: "input_image", image_url: analysis.image_data_url },
      { type: "input_text", text: `CATALOGUE PRODUCT: ${productIdentityText(candidate.product, categoryNames.get(String(candidate.product.category_id ?? "")) ?? "")}` }];
      productImages(candidate.product, 4).forEach((image) => content.push({ type: "input_image", image_url: image }));
      const verified = await requestJson("MATCH", content);
      const verdict = String(verified.verdict ?? "different");
      const confidence = Math.max(0, Math.min(1, Number(verified.confidence) || 0));
      const matchingEvidence = Array.isArray(verified.matching_evidence)
        ? verified.matching_evidence.map(String).filter(Boolean).slice(0, 8)
        : [];
      const conflicts = Array.isArray(verified.conflicting_evidence)
        ? verified.conflicting_evidence.map(String).filter(Boolean).slice(0, 8)
        : [];
      if (verified.type_compatible !== true || verdict === "different") continue;
      if (verdict === "exact" && confidence >= 0.92 && matchingEvidence.length >= 2 && conflicts.length === 0) {
        return {
          product: candidate.product,
          confidence,
          verdict: "exact",
          evidence: matchingEvidence,
          reason: String(verified.reason ?? candidate.reason).slice(0, 300),
        };
      }
      if (!closest || confidence > closest.confidence) {
        closest = {
          product: candidate.product,
          confidence,
          verdict: "close",
          evidence: matchingEvidence,
          reason: String(verified.reason ?? candidate.reason).slice(0, 300),
        };
      }
    }
    return closest;
  } catch (cause) {
    if (cause instanceof ImageProcessingError) throw cause;
    imageFailure("MATCH_EXCEPTION", cause instanceof Error ? cause.message : "Unexpected catalogue match failure", true);
  }
}

async function markQueuedReply(
  sb: ReturnType<typeof admin>,
  queuedJobId: string | null,
  text: string,
  outboundMessageId?: string | null,
) {
  if (!queuedJobId) return;
  await sb
    .from("messenger_jobs")
    .update({ reply_text: text.slice(0, 2000), outbound_message_id: outboundMessageId ?? null } as any)
    .eq("id", queuedJobId);
}

async function fastImageLookup(
  sb: ReturnType<typeof admin>,
  storeId: string,
  imageUrl: string,
  pageToken: string,
  messageId: string,
): Promise<{ analysis: ImageAnalysis | null; match: VisualMatch | null; candidateIds: string[] }> {
  try {
    const { rankProductImageMatches } = await import("@/lib/product-image-embeddings.server");
    const { bytes, type } = await downloadMessengerImage(imageUrl, pageToken, messageId);
    const ranked = await rankProductImageMatches(sb as any, storeId, bytes, type, 8);
    const hit = ranked[0];
    const margin = hit ? hit.similarity - (ranked[1]?.similarity ?? 0) : 0;
    const candidateIds = ranked.filter((row) => row.similarity >= 0.45).map((row) => row.productId);
    // Never declare "not available" from fingerprints alone: embeddings cover
    // only one photo per product, so a different angle/source photo of a real
    // catalogue item can score low. Uncertain photos always fall through to
    // the full AI inspection below.
    if (!hit || hit.similarity < 0.86 || margin < 0.12) return { analysis: null, match: null, candidateIds };
    const [{ data: product }, { data: blocked }] = await Promise.all([
      sb
        .from("ai_product_catalog")
        .select("product_id,name,slug,brand,product_code,sku,category_id,short_description,description,price,old_price,stock,primary_image_url,gallery,features,specifications,variants,total_sold,rating,is_featured")
        .eq("product_id", hit.productId)
        .eq("store_id", storeId)
        .eq("status", "active")
        .gt("stock", 0)
        .maybeSingle(),
      sb.from("ai_product_blacklist").select("product_id").eq("store_id", storeId).eq("product_id", hit.productId).maybeSingle(),
    ]);
    if (!product || blocked) return { analysis: null, match: null, candidateIds };
    const row = { ...(product as any), id: (product as any).product_id } as ProductRow;
    const confidence = Math.min(0.99, Math.round(hit.similarity * 100) / 100);
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
        reason: `Photo fingerprint match (similarity ${hit.similarity.toFixed(3)}, margin ${margin.toFixed(3)})`,
        evidence: ["fast_image_fingerprint"],
      },
      candidateIds,
    };
  } catch {
    // Any index problem falls back to description plus the preloaded text index.
    return { analysis: null, match: null, candidateIds: [] };
  }
}

function friendlyItemName(a: ImageAnalysis): string {
  const s = [a.product_subtype, a.product_type, a.category].filter(Boolean).join(" ").toLowerCase();
  const map: Array<[RegExp, string]> = [
    [/watch/, "ঘড়ি"], [/shoe|sneaker|boot|sandal|footwear/, "জুতা"], [/bag|backpack|purse/, "ব্যাগ"],
    [/shirt|t-shirt|tee|top/, "শার্ট"], [/dress|saree|sari|kurti|clothing|apparel/, "পোশাক"],
    [/phone|mobile/, "ফোন"], [/headphone|earbud|earphone/, "হেডফোন"], [/speaker/, "স্পিকার"],
    [/lipstick/, "লিপস্টিক"], [/perfume|fragrance/, "পারফিউম"], [/serum|lotion|cream|moisturi|skincare|cosmetic|beauty/, "প্রোডাক্ট"],
    [/mug|cup/, "মগ"], [/glass|sunglass/, "চশমা"], [/jewel|ring|necklace|earring|bracelet/, "গয়না"],
  ];
  for (const [re, bn] of map) if (re.test(s)) return bn;
  return "প্রোডাক্ট";
}

async function sendVisualProductResult(opts: {
  sb: ReturnType<typeof admin>;
  token: string;
  psid: string;
  conversationId: string;
  storeId: string;
  storeSlug: string | null | undefined;
  sourceMid: string | null;
  queuedJobId: string | null;
  analysis: ImageAnalysis;
  match: VisualMatch | null;
}) {
  const { sb, token, psid, conversationId, storeId, storeSlug, sourceMid, queuedJobId, analysis, match } = opts;
  if (!match || match.verdict !== "exact") {
    const noun = friendlyItemName(analysis);
    const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];
    const text = analysis.recognition_status === "uncertain"
      ? pick([
          "ছবিটা একটু অস্পষ্ট লাগছে, ঠিকমতো বুঝতে পারছি না 😊 আরেকটু কাছ থেকে বা আলোতে একটা ছবি দিবেন? চাইলে প্রোডাক্টের নামটাও লিখে দিতে পারেন।",
          "দুঃখিত, ছবিটা ঠিক পরিষ্কার আসেনি। আরেকটা ছবি পাঠাবেন প্লিজ? নাম জানলে লিখে দিলেও আমি খুঁজে দিচ্ছি।",
        ])
      : match?.verdict === "close"
      ? pick([
          `${noun} দেখে আমাদের কাছে প্রায় এরকম একটা আছে মনে হচ্ছে, তবে একদম একই কিনা নিশ্চিত হতে পারছি না। নামটা একটু লিখে দিবেন, বা আরেকটা ছবি? তাহলে ঠিকঠাক মিলিয়ে দিতে পারব 😊`,
          `এরকম ${noun} আমাদের কাছে থাকতে পারে, কিন্তু হুবহু এটাই কিনা শিওর না। প্রোডাক্টের নাম বা আরেকটা ছবি দিলে আমি ভালো করে দেখে জানাচ্ছি।`,
        ])
      : pick([
          `সুন্দর ${noun} 😊 কিন্তু দুঃখিত, এই ${noun}টা এখন আমাদের কাছে নেই। অন্য কিছু খুঁজলে বলুন, আমি সাহায্য করছি।`,
          `আহা, এই ${noun}টা এই মুহূর্তে আমাদের দোকানে নেই, দুঃখিত! আপনার পছন্দের অন্য কিছু থাকলে জানান, খুঁজে দিচ্ছি।`,
        ]);
    const sent = await fbSend(token, psid, text);
    await markQueuedReply(sb, queuedJobId, text, sent.message_id);
    await sb.from("ai_messages").insert({
      conversation_id: conversationId, role: "assistant", direction: "out", message_type: "text",
      content: text, attachments: [{
        in_reply_to_mid: sourceMid,
        recognition_status: analysis.recognition_status,
        recognition_confidence: analysis.confidence,
        visibility_warnings: analysis.visibility_warnings,
        visual_match_verdict: match?.verdict ?? "none",
        visual_match_confidence: match?.confidence ?? 0,
        visual_match_reason: match?.reason ?? null,
      }],
      mid: sent.message_id ?? null, delivery_status: "sent",
    } as any);
    return;
  }

  await logProductRecommendations(sb, storeId, conversationId, [match.product], `image:${sourceMid ?? "unknown"}`);
  const card = await productCardInput(storeSlug, match.product, storeId, psid);
  const cardSent = await sendProductCard(token, psid, card);
  await markQueuedReply(sb, queuedJobId, `[card] ${card.title}`, cardSent.message_id);
  await sb.from("ai_messages").insert({
    conversation_id: conversationId, role: "assistant", direction: "out", message_type: "product_card",
    content: `[card] ${card.title}`,
    attachments: [{ type: "product_card", product_id: match.product.id, element: card, in_reply_to_mid: sourceMid }],
    mid: cardSent.message_id ?? null, delivery_status: "sent",
  } as any);
  const askList = [
    "জি, এটা আমাদের কাছে আছে 😊 নিতে চাইলে বলুন, অর্ডার করে দিচ্ছি।",
    "পেয়ে গেছি! এটাই তো আমাদের এই প্রোডাক্টটা। নিবেন?",
    "হ্যাঁ, এটা আমাদের কাছে পাওয়া যাচ্ছে। অর্ডার করতে চাইলে জানান 😊",
  ];
  const text = askList[Math.floor(Math.random() * askList.length)];
  // Ordering happens through the card's own "Buy Now" postback button, so no
  // separate quick reply is attached below the message.
  const sent = await fbSend(token, psid, text);
  await markQueuedReply(sb, queuedJobId, text, sent.message_id);
  await sb.from("ai_messages").insert({
    conversation_id: conversationId, role: "assistant", direction: "out", message_type: "text",
    content: text,
    attachments: [{ in_reply_to_mid: sourceMid, product_id: match.product.id, visual_match_confidence: match.confidence, match_verdict: match.verdict }],
    mid: sent.message_id ?? null, delivery_status: "sent",
  } as any);
}




async function productCardInput(
  storeSlug: string | null | undefined,
  product: ProductRow,
  storeId: string,
  psid: string,
): Promise<ProductCardInput> {
  const priceLine = `৳${Number(product.price).toFixed(0)}`;
  const stockLine = product.stock > 0 ? "In stock" : "Out of stock";
  return {
    title: product.name,
    subtitle: `${priceLine} · ${stockLine}`,
    image_url: firstProductImage(product),
    buy_url: productPageUrl(storeSlug, product),
    product_id: product.id,
  };

}

async function logProductRecommendations(sb: ReturnType<typeof admin>, storeId: string, conversationId: string, products: ProductRow[], context: string) {
  if (!products.length) return;
  await sb.from("ai_product_recommendations").insert(
    products.slice(0, 10).map((p) => ({
      store_id: storeId,
      conversation_id: conversationId,
      product_id: p.id,
      tool_name: "directMessengerSearch",
      context: context.slice(0, 500),
    })) as any,
  );
}

async function logOutgoingText(sb: ReturnType<typeof admin>, conversationId: string, text: string, mid?: string | null, failedError?: string) {
  await sb.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    direction: "out",
    message_type: "text",
    content: text,
    mid: mid ?? null,
    delivery_status: failedError ? "failed" : "sent",
    error: failedError ?? null,
  } as any);
}

async function sendAndLogText(
  sb: ReturnType<typeof admin>,
  token: string,
  psid: string,
  conversationId: string,
  rawText: string,
  facts: PayloadFacts = {},
) {
  // Never point at a card/image/link that is not part of this payload.
  const text = sanitizeOutgoingText(rawText, facts) || rawText;
  try {
    const sent = await fbSend(token, psid, text);
    await logOutgoingText(sb, conversationId, text, sent.message_id ?? null);
    return true;
  } catch (e) {
    await logOutgoingText(sb, conversationId, text, null, (e as Error).message);
    throw e;
  }
}

async function sendAndLogViewSiteButton(
  sb: ReturnType<typeof admin>,
  token: string,
  psid: string,
  conversationId: string,
  text: string,
  url: string,
) {
  try {
    const sent = await sendViewSiteButton(token, psid, text, url);
    await sb.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      direction: "out",
      message_type: "button",
      content: text,
      attachments: [{ type: "web_url", url }],
      mid: sent.message_id ?? null,
      delivery_status: "sent",
    } as any);
    return true;
  } catch (e) {
    await sb.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      direction: "out",
      message_type: "button",
      content: text,
      attachments: [{ type: "web_url", url }],
      delivery_status: "failed",
      error: (e as Error).message,
    } as any);
    throw e;
  }
}

async function maybeSendDirectProductReply(opts: {
  sb: ReturnType<typeof admin>;
  storeId: string;
  storeSlug: string | null | undefined;
  conversationId: string;
  psid: string;
  token: string;
  text: string;
}) {
  const { sb, storeId, storeSlug, conversationId, psid, token, text } = opts;
  const terms = productSearchTerms(text);
  const photoIntent = isPhotoIntent(text);
  const orderIntent = isOrderIntent(text);
  const referenceIntent = isReferenceIntent(text);
  const explicitProductIntent = isProductIntent(text);
  if (!photoIntent && !orderIntent && !explicitProductIntent && looksLikeOrderDetails(text)) return false;
  if (!photoIntent && !orderIntent && !explicitProductIntent && !terms.length) return false;

  let products = photoIntent || orderIntent || (referenceIntent && terms.length === 0)
    ? await getRecentRecommendedProducts(sb, storeId, conversationId, 3)
    : [];
  if (!products.length) products = await searchDirectProducts(sb, storeId, text, 6);

  if (!products.length && !photoIntent && !orderIntent && !explicitProductIntent) return false;

  if (!products.length) {
    const noResult = orderIntent || referenceIntent
      ? "কোন প্রোডাক্টটি অর্ডার করতে চান বুঝতে পারছি না। প্রোডাক্টের নাম লিখুন, আমি ছবিসহ দেখিয়ে অর্ডার শুরু করে দিব।"
      : "দুঃখিত, এই নামে কোনো স্টকে থাকা প্রোডাক্ট পেলাম না। অন্য নাম/ক্যাটাগরি লিখলে আবার খুঁজে দেখছি।";
    await sendAndLogText(sb, token, psid, conversationId, noResult);
    return true;
  }

  if (orderIntent) {
    const product = products[0];
    const current = await getConversationPendingOrder(sb, conversationId);
    const details = parseOrderDetailsText(text);
    const slot = await patchConversationPendingOrder(sb, conversationId, {
      ...current,
      ...details,
      product_id: product.id,
      product_name: product.name,
      qty: details.qty ?? current.qty ?? 1,
    });
    const blocked = await maybeBlockDuplicateMessengerOrder({
      sb,
      storeId,
      conversationId,
      psid,
      token,
      slot,
      product: { id: product.id, name: product.name },
    });
    if (blocked) return true;
    const missing = orderMissingFields(slot, await loadStoreOrderFlow(sb, storeId));
    if (!missing.length) {
      await logProductRecommendations(sb, storeId, conversationId, [product], text);
      return finalizePendingMessengerOrder({ sb, storeId, conversationId, psid, token });
    }
    const zones = await fetchDeliveryZones(sb, storeId);
    const textReply = buildBuyNowMessage({
      productName: product.name,
      price: Number((product as any).price ?? 0),
      qty: Number(slot.qty ?? 1) || 1,
      zones,
      productDeliveryCharge: (product as any).delivery_charge,
      intro: `ঠিক আছে, ${product.name} অর্ডার শুরু করলাম।`,
    });
    await logProductRecommendations(sb, storeId, conversationId, [product], text);
    await sendAndLogText(sb, token, psid, conversationId, textReply);
    return true;
  }

  await logProductRecommendations(sb, storeId, conversationId, products, text);
  const intro = photoIntent
    ? "এই প্রোডাক্টের ছবিসহ বিস্তারিত পাঠাচ্ছি।"
    : products.length === 1
    ? `জি, ${products[0].name} আছে — ছবিসহ বিস্তারিত দেখুন।`
    : "জি, মিল থাকা প্রোডাক্টগুলো ছবিসহ পাঠাচ্ছি।";
  await sendAndLogText(sb, token, psid, conversationId, intro, { hasCard: true });

  const cards = await Promise.all(products.map((p) => productCardInput(storeSlug, p, storeId, psid)));
  try {
    if (cards.length === 1) {
      const result = await sendProductCard(token, psid, cards[0]);
      await sb.from("ai_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        direction: "out",
        message_type: "product_card",
        content: `[card] ${cards[0].title}`,
        attachments: [{ type: "product_card", product_id: products[0].id, element: cards[0] }],
        mid: result.message_id ?? null,
        delivery_status: "sent",
      } as any);
    } else {
      const result = await sendProductCarousel(token, psid, cards);
      await sb.from("ai_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        direction: "out",
        message_type: "product_carousel",
        content: `[carousel] ${cards.length} products`,
        attachments: cards.map((card, i) => ({ type: "product_card", product_id: products[i].id, element: card })),
        mid: result.message_id ?? null,
        delivery_status: "sent",
      } as any);
    }
    // Ordering runs through each card's own "Buy Now" postback button, so no
    // extra quick reply row is attached below the carousel.
    const image = firstProductImage(products[0]);
    if (photoIntent && image) {
      const imgSent = await fbSendImage(token, psid, image);
      await sb.from("ai_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        direction: "out",
        message_type: "image",
        content: `[image] ${products[0].name}`,
        attachments: [{ type: "image", url: image, product_id: products[0].id }],
        mid: imgSent.message_id ?? null,
        delivery_status: "sent",
      } as any);
    }
    return true;
  } catch (e) {
    await sb.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      direction: "out",
      message_type: "product_card",
      content: "[product card failed]",
      delivery_status: "failed",
      error: (e as Error).message,
      attachments: cards.map((card, i) => ({ type: "product_card", product_id: products[i].id, element: card })),
    } as any);
    throw e;
  }
}

export async function handleBuyPostback(opts: {
  sb: ReturnType<typeof admin>;
  storeId: string;
  conversationId: string;
  psid: string;
  token: string;
  payload: string;
  queuedJobId?: string | null;
}) {
  const { sb, storeId, conversationId, psid, token, payload } = opts;
  const queuedJobId = opts.queuedJobId ?? null;
  const productId = payload.replace(/^BUY_/, "");
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return false;
  const { data: product } = await sb
    .from("products")
    .select("id,name,slug,price,stock,status,product_type,delivery_charge")
    .eq("store_id", storeId)
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.status !== "active") {
    const miss = "দুঃখিত, এই প্রোডাক্টটি এখন পাওয়া যাচ্ছে না। চাইলে কাছাকাছি অন্য প্রোডাক্ট দেখাতে পারি।";
    await sendAndLogText(sb, token, psid, conversationId, miss);
    await markQueuedReply(sb, queuedJobId, miss, null);
    return true;
  }
  // Only physical products can be ordered inside Messenger.
  if (String((product as any).product_type ?? "physical") !== "physical") {
    const { data: store } = await sb.from("stores").select("slug").eq("id", storeId).maybeSingle();
    const origin = (process.env["PUBLIC_APP_URL"] || process.env["VITE_APP_URL"] || "https://orzen-commerce.lovable.app").replace(/\/$/, "");
    const url = store?.slug ? `${origin}/store/${store.slug}/product/${product.id}` : `${origin}/product/${product.id}`;
    const webText = "এই প্রোডাক্টটি আমাদের ওয়েবসাইট থেকে নিরাপদে কিনতে পারবেন";
    await sendAndLogViewSiteButton(sb, token, psid, conversationId, webText, url);
    await markQueuedReply(sb, queuedJobId, webText, null);
    return true;
  }
  if (Number(product.stock) <= 0) {
    const oos = "দুঃখিত, এই প্রোডাক্টটি এখন স্টকে নেই। চাইলে কাছাকাছি অন্য প্রোডাক্ট দেখাতে পারি।";
    await sendAndLogText(sb, token, psid, conversationId, oos);
    await markQueuedReply(sb, queuedJobId, oos, null);
    return true;
  }

  const current = await getConversationPendingOrder(sb, conversationId);
  const slot = await patchConversationPendingOrder(sb, conversationId, {
    ...current,
    product_id: product.id,
    qty: current.qty ?? 1,
  });
  const cfg = await loadStoreOrderFlow(sb, storeId);
  const missing = orderMissingFields(slot, cfg);
  const zones = await fetchDeliveryZones(sb, storeId);
  const reply = missing.length
    ? buildBuyNowMessage({
        productName: product.name,
        price: Number((product as any).price ?? 0),
        qty: Number(slot.qty ?? 1) || 1,
        zones,
        productDeliveryCharge: (product as any).delivery_charge,
        intro: cfg.buy_now_message,
      })
    : `ঠিক আছে, ${product.name} অর্ডারের তথ্য পেয়েছি। কনফার্ম করতে "হ্যাঁ" লিখুন।`;
  await sendAndLogText(
    sb,
    token,
    psid,
    conversationId,
    reply,
  );
  await markQueuedReply(sb, queuedJobId, reply, null);
  return true;
}

// Verify Facebook's X-Hub-Signature-256 (HMAC-SHA256 of the raw body with the app secret).
async function verifyMessengerSignature(rawBody: string, header: string, appSecret: string) {
  const provided = header.trim().toLowerCase().replace(/^sha256=/, "");
  if (!/^[0-9a-f]{64}$/.test(provided)) return false;
  const { createHmac } = await import("node:crypto");
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return expected === provided;
}

async function decryptToken(enc: string | null | undefined): Promise<string | null> {

  if (!enc) return null;
  const mod = await import("@/lib/crypto/credentials.server");
  try {
    return mod.decryptJSON<string>(enc);
  } catch {
    return null;
  }
}

async function fetchPsidProfile(token: string, psid: string) {
  try {
    const r = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(psid)}?fields=first_name,last_name,name,profile_pic,locale,timezone&access_token=${encodeURIComponent(token)}`,
    );
    if (!r.ok) return null;
    const j = (await r.json()) as Record<string, any>;
    return { ...j, fetched_at: new Date().toISOString() } as Record<string, any>;
  } catch {
    return null;
  }
}

/** Profile pictures are signed CDN links that expire — refresh every few hours. */
function profileIsStale(profile: any) {
  if (!profile || Object.keys(profile).length === 0) return true;
  const at = profile.fetched_at ? Date.parse(profile.fetched_at) : NaN;
  if (Number.isNaN(at)) return true;
  return Date.now() - at > 6 * 60 * 60 * 1000;
}

type IncomingContent = {
  text: string;
  message_type:
    | "text"
    | "image"
    | "video"
    | "audio"
    | "file"
    | "sticker"
    | "quick_reply"
    | "postback";
  attachments: any[];
};

function parseMessage(msg: any): IncomingContent {
  if (msg?.quick_reply?.payload) {
    return {
      text: msg.text || msg.quick_reply.payload,
      message_type: "quick_reply",
      attachments: [{ type: "quick_reply", payload: msg.quick_reply.payload }],
    };
  }
  if (msg?.text) {
    return { text: msg.text, message_type: "text", attachments: [] };
  }
  const atts = Array.isArray(msg?.attachments) ? msg.attachments : [];
  if (atts.length) {
    const first = atts[0];
    const type = (first.type as string) || "file";
    const mapped: IncomingContent["message_type"] =
      type === "image" || type === "video" || type === "audio" || type === "file"
        ? (type as any)
        : type === "fallback"
        ? "file"
        : "sticker";
    return {
      text: `[${mapped}]`,
      message_type: mapped,
      attachments: atts.map((a: any) => ({ type: a.type, url: a.payload?.url, sticker_id: a.payload?.sticker_id })),
    };
  }
  return { text: "", message_type: "text", attachments: [] };
}

export async function handleMessengerVerify(request: Request): Promise<Response> {
  {
    {
      {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode === "subscribe" && token) {
          const sb = admin();
          const { data } = await sb
            .from("messenger_integrations")
            .select("id")
            .eq("verify_token", token)
            .maybeSingle();
          if (data) return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("forbidden", { status: 403 });
      }
    }
  }
}

export async function handleMessengerWebhook(request: Request): Promise<Response> {
  {
    {
      {
        // Facebook signs every webhook delivery. Read the RAW body first so the
        // HMAC is computed over the exact bytes Facebook signed.
        const rawBody = await request.text();
        const signatureHeader =
          request.headers.get("x-hub-signature-256") || request.headers.get("X-Hub-Signature-256");
        const queuedJobId = request.headers.get("x-orzen-queue-job");
        const queuedMessageId = request.headers.get("x-orzen-queue-mid");
        const fallbackOnly = request.headers.get("x-orzen-queue-fallback") === "1";
        let queuedProcessingError: Error | null = null;
        let body: any = null;
        try {
          body = JSON.parse(rawBody);
        } catch {
          body = null;
        }
        if (!body || (body.object !== "page" && body.object !== "instagram")) {
          return new Response("ok");
        }
        // Page feed events (comments/posts) belong to the Facebook Page module.
        // Forward the exact signed body; that endpoint verifies the signature
        // again with the Page's own App Secret and resolves its own store.
        if (!queuedJobId && (body.entry ?? []).some((e: any) => Array.isArray(e?.changes) && e.changes.length)) {
          const target = new URL("/api/public/facebook/webhook", request.url);
          const headers = new Headers({ "content-type": "application/json", "x-orzen-facebook-routed": "page" });
          if (signatureHeader) headers.set("x-hub-signature-256", signatureHeader);
          try {
            await fetch(target, { method: "POST", headers, body: rawBody });
          } catch {
            /* comment sync is best-effort; never fail the delivery */
          }
          if (!(body.entry ?? []).some((e: any) => Array.isArray(e?.messaging) && e.messaging.length)) {
            return new Response("ok");
          }
        }

        const sb = admin();
        for (const entry of body.entry ?? []) {
          const pageId = String(entry.id);
          const { data: integ } = await sb
            .from("messenger_integrations")
            .select(
              "id,store_id,page_access_token,page_access_token_encrypted,app_secret_encrypted,ai_auto_reply,human_takeover,conversation_history,delivery_failures,reply_delay_seconds,reply_speed,app_id,verify_token",
            )
            .eq("page_id", pageId)
            .maybeSingle();
          if (!integ) continue;

          // Facebook signs every delivery. Unsigned events are untrusted and are
          // never processed: without an App Secret anyone who knows the public
          // Page ID could forge customer messages and drive the AI order flow.
          const appSecret = await decryptToken((integ as any).app_secret_encrypted);
          if (!appSecret) {
            await sb
              .from("messenger_integrations")
              .update({
                last_error:
                  "App Secret সেট করা নেই — নিরাপত্তার কারণে webhook ইভেন্ট গ্রহণ করা হচ্ছে না। App Secret যোগ করুন।",
              })
              .eq("id", (integ as any).id);
            continue;
          }
          if (!signatureHeader) continue;
          if (!(await verifyMessengerSignature(rawBody, signatureHeader, appSecret))) continue;

          // Normal Facebook deliveries only perform the durable write. The insert
          // wakes an independent processor, allowing Facebook to receive 200
          // immediately instead of waiting for AI generation and Graph delivery.
          if (!queuedJobId) {
            for (const ev of entry.messaging ?? []) {
              const incoming = ev?.message;
              const senderId = String(ev?.sender?.id ?? "");
              const messageId = String(incoming?.mid ?? "");
              if (!senderId || !messageId || incoming?.is_echo) continue;
              await sb.from("messenger_jobs").upsert(
                {
                  store_id: integ.store_id,
                  integration_id: (integ as any).id,
                  page_id: pageId,
                  sender_id: senderId,
                  message_id: messageId,
                  event_payload: { raw: rawBody, signature: signatureHeader, message_id: messageId },
                  available_at: new Date(
                    Date.now() + Math.max(0, Number((integ as any).reply_delay_seconds ?? 0)) * 1000,
                  ).toISOString(),
                } as any,
                { onConflict: "page_id,message_id", ignoreDuplicates: true },
              );
            }
            // Message events are now queued; everything else (postbacks,
            // delivery/read receipts, opt-ins, referrals) is still handled
            // inline below because it is cheap and must not be dropped.
          }



          const token =
            (await decryptToken((integ as any).page_access_token_encrypted)) ||
            (integ as any).page_access_token;

          // Card "Buy Now" taps need the messaging_postbacks webhook field.
          if (token) {
            try {
              const { ensurePostbacksDelivered } = await import("@/lib/messenger-subscribe.server");
              const res = await ensurePostbacksDelivered({
                pageId,
                token,
                appId: (integ as any).app_id ?? null,
                appSecret: appSecret,
                verifyToken: (integ as any).verify_token ?? null,
              });
              if (res.page || res.app) {
                console.log("[messenger] postback subscription", pageId, JSON.stringify(res));
              }
            } catch (e) {
              console.warn("[messenger] postback check failed", (e as Error).message);
            }
          }


          // Handle standby events (log only)
          for (const _st of entry.standby ?? []) {
            // no-op, we don't have thread control
          }

          for (const ev of entry.messaging ?? []) {
            const senderId = ev.sender?.id;
            if (!senderId) continue;
            // Incoming customer messages are answered by the queue worker.
            if (!queuedJobId && ev.message?.mid && !ev.message?.is_echo) continue;

            try {
              // deliveries / reads update outgoing message status by mids
              if (ev.delivery?.mids?.length) {
                await sb
                  .from("ai_messages")
                  .update({ delivery_status: "delivered" })
                  .in("mid", ev.delivery.mids)
                  .neq("delivery_status", "read");
                continue;
              }
              if (ev.read?.watermark) {
                // mark all outgoing before watermark as read for this conversation
                const { data: convRow } = await sb
                  .from("ai_conversations")
                  .select("id")
                  .eq("store_id", integ.store_id)
                  .eq("channel", "messenger")
                  .eq("external_id", senderId)
                  .maybeSingle();
                if (convRow) {
                  const iso = new Date(ev.read.watermark).toISOString();
                  await sb
                    .from("ai_messages")
                    .update({ delivery_status: "read" })
                    .eq("conversation_id", convRow.id)
                    .eq("direction", "out")
                    .lte("created_at", iso);
                }
                continue;
              }

              // Ensure conversation
              let { data: conv } = await sb
                .from("ai_conversations")
                .select("id,psid_profile,unread_count,handoff_mode")
                .eq("store_id", integ.store_id)
                .eq("channel", "messenger")
                .eq("external_id", senderId)
                .maybeSingle();
              if (!conv) {
                const profile = token ? await fetchPsidProfile(token, senderId) : null;
                const name = profile
                  ? (profile["name"] as string | undefined) ||
                    [profile["first_name"], profile["last_name"]].filter(Boolean).join(" ") ||
                    null
                  : null;
                const { data: created } = await sb
                  .from("ai_conversations")
                  .insert({
                    store_id: integ.store_id,
                    channel: "messenger",
                    external_id: senderId,
                    customer_name: name,
                    psid_profile: profile ?? {},
                  })
                  .select("id,psid_profile,unread_count,handoff_mode")
                  .single();
                conv = created;
              } else if (token && profileIsStale(conv.psid_profile as any)) {
                const profile = await fetchPsidProfile(token, senderId);
                if (profile) {
                  await sb
                    .from("ai_conversations")
                    .update({
                      psid_profile: profile,
                      customer_name:
                        (profile["name"] as string | undefined) ||
                        [profile["first_name"], profile["last_name"]].filter(Boolean).join(" ") ||
                        null,
                    })
                    .eq("id", conv.id);
                }
              }

              // Optins / referrals — log as system rows, no reply
              if (ev.optin || ev.referral) {
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "system",
                  direction: "in",
                  message_type: "text",
                  content: ev.optin ? "[opt-in]" : "[referral]",
                  attachments: [ev.optin ?? ev.referral],
                });
                continue;
              }

              // Postback
              if (ev.postback) {
                const preview = ev.postback.title || ev.postback.payload || "[postback]";
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "user",
                  direction: "in",
                  message_type: "postback",
                  content: preview,
                  attachments: [{ payload: ev.postback.payload, title: ev.postback.title }],
                });
                await sb
                  .from("ai_conversations")
                  .update({
                    last_message_at: new Date().toISOString(),
                    last_message_preview: preview.slice(0, 200),
                    unread_count: (conv!.unread_count ?? 0) + 1,
                  })
                  .eq("id", conv!.id);
                const handoff = (conv as any)!.handoff_mode ?? "ai";
                if (
                  handoff === "ai" &&
                  token &&
                  !(integ as any).human_takeover &&
                  (integ as any).ai_auto_reply !== false &&
                  String(ev.postback.payload ?? "").startsWith("BUY_")
                ) {
                  await handleBuyPostback({
                    sb,
                    storeId: integ.store_id,
                    conversationId: conv!.id,
                    psid: senderId,
                    token,
                    payload: String(ev.postback.payload),
                    queuedJobId,
                  });
                  await sb
                    .from("messenger_integrations")
                    .update({ last_error: null } as any)
                    .eq("id", (integ as any).id);
                }
                continue;
              }

              // messages event
              const msg = ev.message;
              if (!msg || msg.is_echo) continue;
              if (queuedMessageId && String(msg.mid ?? "") !== queuedMessageId) continue;
              if (msg.mid) {
                const { data: existingMessage } = await sb
                  .from("ai_messages")
                  .select("id")
                  .eq("mid", msg.mid)
                  .maybeSingle();
                if (existingMessage && !queuedJobId) continue;
              }
              const parsed = parseMessage(msg);
              const sourceCreatedAt = Number(ev.timestamp) > 0
                ? new Date(Number(ev.timestamp)).toISOString()
                : new Date().toISOString();

              // "Buy now" taps: card buttons arrive as postbacks, quick replies
              // arrive as ordinary messages. Both mean the same intent and must
              // start the order flow instead of going to the LLM as raw text.
              const qrPayload = String((parsed.attachments?.[0] as any)?.payload ?? "");
              if (parsed.message_type === "quick_reply" && /^BUY_[0-9a-f-]{36}$/i.test(qrPayload)) {
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "user",
                  direction: "in",
                  message_type: "quick_reply",
                  content: msg.text || "Buy Now",
                  attachments: parsed.attachments,
                  mid: msg.mid ?? null,
                  created_at: sourceCreatedAt,
                });
                await sb
                  .from("ai_conversations")
                  .update({
                    last_message_at: new Date().toISOString(),
                    last_message_preview: (msg.text || "Buy Now").slice(0, 200),
                    unread_count: (conv!.unread_count ?? 0) + 1,
                  })
                  .eq("id", conv!.id);
                const qrHandoff = (conv as any)!.handoff_mode ?? "ai";
                if (
                  qrHandoff === "ai" &&
                  token &&
                  !(integ as any).human_takeover &&
                  (integ as any).ai_auto_reply !== false
                ) {
                  await handleBuyPostback({
                    sb,
                    storeId: integ.store_id,
                    conversationId: conv!.id,
                    psid: senderId,
                    token,
                    payload: qrPayload,
                    queuedJobId,
                  });
                }
                continue;
              }


              // Voice notes: transcribe upstream so the LLM sees text, not "[audio]".
              let effectiveText = parsed.text;
              let imageAnalysis: ImageAnalysis | null = null;
              let imageMatch: VisualMatch | null = null;
              if (parsed.message_type === "audio") {
                const audioUrl = (parsed.attachments?.[0]?.url as string) || "";
                const transcript = await transcribeAudioAttachment(audioUrl);
                if (transcript) effectiveText = transcript;
              }
              // Photos: describe the image so the agent can look the item up in the
              // catalogue instead of leaving the customer with silence.
              if (parsed.message_type === "image") {
                const imageUrl = (parsed.attachments?.[0]?.url as string) || "";
                if (fallbackOnly) {
                  const fallback = "দুঃখিত, সাময়িক সমস্যার কারণে ছবিটি এখন বিশ্লেষণ করা যায়নি। ছবিটি সংরক্ষিত আছে—অনুগ্রহ করে একটু পরে আবার পাঠান।";
                  const sent = await fbSend(token, senderId, fallback);
                  await markQueuedReply(sb, queuedJobId, fallback, sent.message_id);
                  await sb.from("ai_messages").insert({
                    conversation_id: conv!.id,
                    role: "assistant",
                    direction: "out",
                    message_type: "text",
                    content: fallback,
                    attachments: [{ in_reply_to_mid: msg.mid ?? null, image_processing_failed: true }],
                    mid: sent.message_id ?? null,
                    delivery_status: "sent",
                  });
                  continue;
                }
                // Fast path: an unambiguous photo-fingerprint match against this
                // store's own products answers in ~1s; anything uncertain falls
                // through to the full AI inspection below.
                const fast = await fastImageLookup(sb, integ.store_id, imageUrl, token, String(msg.mid ?? ""));
                const seen = fast.analysis ?? await describeImageAttachment(imageUrl, token, String(msg.mid ?? ""));
                {
                  imageAnalysis = seen;
                  imageMatch = fast.match ?? (seen.is_product
                    ? await visuallyMatchProduct(sb, integ.store_id, seen, fast.candidateIds)
                    : null);
                  const terms = seen.keywords.length ? ` Search terms: ${seen.keywords.join(", ")}.` : "";
                  effectiveText = seen.is_product
                    ? `[The customer sent a photo of a product. The photo shows: ${seen.description}.${terms}] ` +
                      `Use the synchronized store catalogue as the authoritative product list; do not browse the website. ` +
                      `If found, show the product card with price and stock and ask if this is the one they want. ` +
                      `If nothing matching exists, say politely in the customer's own language that this product is not available right now, ` +
                      `mention what you saw in the photo, and offer the closest alternatives. Never invent a product.`
                    : `[The customer sent a photo. The photo shows: ${seen.description}.] ` +
                      `Answer about this photo naturally in the customer's language. Do not search the product catalogue unless they ask.`;
                  parsed.attachments = (parsed.attachments ?? []).map((a: any, i: number) => i === 0 ? {
                    ...a,
                    ai_description: seen.description,
                    ai_keywords: seen.keywords,
                    is_product: seen.is_product,
                    visual_attributes: {
                      product_type: seen.product_type,
                      product_subtype: seen.product_subtype,
                      category: seen.category,
                      primary_color: seen.primary_color,
                      secondary_colors: seen.secondary_colors,
                      material: seen.material,
                      style: seen.style,
                      shape: seen.shape,
                      pattern: seen.pattern,
                      visible_text: seen.visible_text,
                      brand: seen.brand,
                      model_number: seen.model_number,
                      functions: seen.functions,
                      connectors: seen.connectors,
                      controls: seen.controls,
                      package_specs: seen.package_specs,
                      distinctive_features: seen.distinctive_features,
                      field_confidence: seen.field_confidence,
                      visibility_warnings: seen.visibility_warnings,
                      object_boundary_confidence: seen.object_boundary_confidence,
                      text_legibility: seen.text_legibility,
                      recognition_status: seen.recognition_status,
                      inspection_passes: seen.inspection_passes,
                      confidence: seen.confidence,
                    },
                    matched_product_id: imageMatch?.verdict === "exact" ? imageMatch.product.id : null,
                    visual_match_verdict: imageMatch?.verdict ?? "none",
                    visual_match_confidence: imageMatch?.confidence ?? 0,
                    visual_match_reason: imageMatch?.reason ?? null,
                    visual_match_evidence: imageMatch?.evidence ?? [],
                  } : a);
                }
              }

              // Merchant command path: only a verified merchant identity of THIS
              // store reaches the Master Agent. Everyone else falls through to
              // the existing customer flow untouched.
              if (effectiveText) {
                try {
                  const { handleMerchantChannelMessage } = await import(
                    "@/lib/merchant-ai/router.server"
                  );
                  const merchant = await handleMerchantChannelMessage(
                    sb,
                    integ.store_id,
                    "messenger",
                    senderId,
                    effectiveText,
                  );
                  if (merchant?.handled) {
                    if (token) {
                      const result = await sendText(token, senderId, merchant.reply);
                      await markQueuedReply(sb, queuedJobId, merchant.reply, (result as any)?.message_id ?? null);
                    }
                    continue;
                  }
                } catch (err) {
                  // Never break the customer flow — but never swallow it silently either.
                  try {
                    const { logActivity } = await import("@/lib/merchant-ai/core.server");
                    await logActivity(sb as any, integ.store_id, {
                      agent: "master",
                      actionKey: "channel_router_failed",
                      level: "error",
                      message: err instanceof Error ? err.message : "Merchant command router failed",
                      meta: { channel: "messenger" },
                    });
                  } catch {
                    /* logging must not break delivery */
                  }
                }

              }

              const preview = effectiveText.slice(0, 200) || `[${parsed.message_type}]`;

              if (!msg.mid || !(await sb.from("ai_messages").select("id").eq("mid", msg.mid).maybeSingle()).data) {
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "user",
                  direction: "in",
                  message_type: parsed.message_type,
                  content: effectiveText || preview,
                  attachments: parsed.attachments,
                  mid: msg.mid ?? null,
                  created_at: sourceCreatedAt,
                });
                await sb
                  .from("ai_conversations")
                  .update({
                    last_message_at: new Date().toISOString(),
                    last_message_preview: preview,
                    unread_count: (conv!.unread_count ?? 0) + 1,
                  })
                  .eq("id", conv!.id);
              }

              // AI reply gate
              const handoff = (conv as any)!.handoff_mode ?? "ai";
              if (handoff !== "ai") continue;
              if ((integ as any).human_takeover || (integ as any).ai_auto_reply === false) continue;
              if (!token) continue;
              // Audio was transcribed and images were described above; stickers and
              // files still have no text form, so they do not reach the LLM.
              if (
                parsed.message_type !== "text" &&
                parsed.message_type !== "quick_reply" &&
                parsed.message_type !== "audio" &&
                parsed.message_type !== "image"
              ) continue;
              if (!effectiveText.trim()) continue;

              // Product photos are resolved deterministically from the current
              // image turn. This prevents an older recommendation or free-form
              // model reply from replacing the newest photo's product context.
              if (parsed.message_type === "image" && imageAnalysis?.is_product) {
                const { data: storeRow } = await sb
                  .from("stores")
                  .select("slug")
                  .eq("id", integ.store_id)
                  .maybeSingle();
                await sendVisualProductResult({
                  sb,
                  token,
                  psid: senderId,
                  conversationId: conv!.id,
                  storeId: integ.store_id,
                  storeSlug: storeRow?.slug,
                  sourceMid: msg.mid ?? null,
                  queuedJobId,
                  analysis: imageAnalysis,
                  match: imageMatch,
                });
                await sb
                  .from("messenger_integrations")
                  .update({ last_error: null } as any)
                  .eq("id", (integ as any).id);
                // After replying, fingerprint a few new/changed products of this
                // store so later photos of them also take the fast path.
                try {
                  const { syncProductImageEmbeddings } = await import("@/lib/product-image-embeddings.server");
                  await syncProductImageEmbeddings(sb as any, { storeId: integ.store_id, limit: 3 });
                } catch {
                  /* best effort; the scheduled sync covers it */
                }
                continue;
              }

              if (fallbackOnly) {
                const fallback = /[\u0980-\u09ff]/.test(effectiveText)
                  ? "দুঃখিত, এই মুহূর্তে আপনার মেসেজের পূর্ণ উত্তর তৈরি করা যায়নি। আপনার মেসেজটি সংরক্ষিত আছে—অনুগ্রহ করে একটু পরে আবার চেষ্টা করুন।"
                  : "Sorry, I couldn't complete the full answer right now. Your message is saved—please try again shortly.";
                const sent = await fbSend(token, senderId, fallback);
                await markQueuedReply(sb, queuedJobId, fallback, sent.message_id);
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "assistant",
                  direction: "out",
                  message_type: "text",
                  content: fallback,
                  mid: sent.message_id ?? null,
                  delivery_status: "sent",
                });
                continue;
              }

              // Greetings need no model or store lookup. Answer immediately so
              // the common first interaction stays near Facebook network speed.
              if (isGreetingIntent(effectiveText)) {
                const instantReply = /[\u0980-\u09ff]/.test(effectiveText)
                  ? smallTalkReply(effectiveText)
                  : "Hello! How can I help you today?";
                const sent = await fbSend(token, senderId, instantReply);
                await markQueuedReply(sb, queuedJobId, instantReply, sent.message_id);
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "assistant",
                  direction: "out",
                  message_type: "text",
                  content: instantReply,
                  mid: sent.message_id ?? null,
                  delivery_status: "sent",
                });
                await sb
                  .from("ai_conversations")
                  .update({ last_message_at: new Date().toISOString(), last_message_preview: instantReply })
                  .eq("id", conv!.id);
                continue;
              }

              // Reply pacing is merchant-controlled. Timing starts the moment the
              // customer's message lands, so the AI's own thinking time counts
              // toward the configured delay instead of adding to it.
              const turnStartedAt = Date.now();
              const replyDelaySeconds = Number((integ as any).reply_delay_seconds ?? 0) || 0;
              const replySpeed = String((integ as any).reply_speed ?? "fastest");
              // Instant feedback in Messenger while the model runs.
              void fbTyping(token, senderId).catch(() => {});


              // Merge any order-detail hints into the pending-order slot as CONTEXT for the LLM.
              // This never sends a template — it only short-circuits when the duplicate guard blocks the order.
              const duplicateBlocked = await maybeApplyPendingOrderText({
                sb,
                storeId: integ.store_id,
                conversationId: conv!.id,
                psid: senderId,
                token,
                text: effectiveText,
              });
              if (duplicateBlocked) {
                await sb
                  .from("messenger_integrations")
                  .update({ last_error: null } as any)
                  .eq("id", (integ as any).id);
                continue;
              }

              // Everything the model needs is fetched in ONE parallel round-trip.
              // Previously these six reads ran one after another and dominated the
              // reply latency.
              const useHistory = (integ as any).conversation_history !== false;
              // Shorter context = fewer tokens = faster first token.
              const historyLimit = replySpeed === "thorough" ? 30 : replySpeed === "balanced" ? 16 : 8;
              const smallTalk = isSmallTalkIntent(effectiveText);
              const [aiCtx, historyRes, pending, convStateRes, recentRecsRes, focusRes] = await Promise.all([
                loadAiContext(integ.store_id),
                useHistory
                  ? sb
                      .from("ai_messages")
                      .select("role,content,message_type")
                      .eq("conversation_id", conv!.id)
                      .in("message_type", ["text", "quick_reply", "postback", "audio", "image"])
                      .order("created_at", { ascending: false })
                      .limit(historyLimit)
                  : Promise.resolve({ data: [] as any[] }),
                getConversationPendingOrder(sb, conv!.id),
                sb.from("ai_conversations").select("psid_profile").eq("id", conv!.id).maybeSingle(),
                sb
                  .from("ai_product_recommendations")
                  .select("product_id")
                  .eq("conversation_id", conv!.id)
                  .order("created_at", { ascending: false })
                  .limit(3),
                smallTalk
                  ? Promise.resolve({ product: null, ambiguous: false, candidates: [] as any[] })
                  : resolveFocusProduct({
                      storeId: integ.store_id,
                      conversationId: conv!.id,
                      text: effectiveText,
                    }),
              ]);
              const { store, agent, settings } = aiCtx;
              const history = (historyRes as any).data ?? [];
              const messages = [...history].reverse()
                .filter((m: any) => m.role === "user" || m.role === "assistant")
                .map((m: any) => ({
                  role: m.role as "user" | "assistant",
                  content:
                    m.message_type && m.message_type !== "text" && m.message_type !== "quick_reply"
                      ? `[${m.message_type}] ${m.content ?? ""}`.trim()
                      : (m.content ?? ""),
                }));
              const latestInHistory = [...messages]
                .reverse()
                .find((m) => m.role === "user")?.content?.trim();
              if (latestInHistory !== effectiveText.trim()) {
                messages.push({ role: "user", content: effectiveText.trim() });
              }

              // Conversation-state block so the model always sees what's already collected.
              const lastOrder = ((convStateRes as any)?.data?.psid_profile as any)?.last_order ?? null;
              const recentIds = Array.from(
                new Set(
                  ((recentRecsRes as any).data ?? [])
                    .map((r: any) => String(r.product_id ?? ""))
                    .filter(Boolean) as string[],
                ),
              );
              const focus = focusRes as any;

              const reply = await generateAgentReply({
                ctx: {
                  storeId: integ.store_id,
                  storeSlug: (store as any).slug,
                  conversationId: conv!.id,
                  psid: senderId,
                  pageToken: token,
                  focusProductId: focus.product?.id ?? null,
                },
                messages,
                system: buildSystemPrompt(store, agent, {
                  channel: "messenger",
                  settings,
                  state: smallTalk
                    ? { pending_order: {}, last_order: null, recent_product_ids: [] }
                    : { pending_order: pending, last_order: lastOrder, recent_product_ids: recentIds },
                  focus,
                  latestUserText: effectiveText,
                }),
                fast: true,
              });




              const replyText = sanitizeOutgoingText(
                sanitizeMessengerReply(reply?.text ?? "", effectiveText),
                reply?.facts ?? {},
              );
              if (!replyText) {
                // AI answered by sending a product card/carousel via tool call;
                // nothing more to say. Clear stale errors, don't POST empty text.
                await sb
                  .from("messenger_integrations")
                  .update({ last_error: null } as any)
                  .eq("id", (integ as any).id);
                continue;
              }

              try {
                const sent = await fbSend(token, senderId, replyText);
                await markQueuedReply(sb, queuedJobId, replyText, sent.message_id);
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "assistant",
                  direction: "out",
                  message_type: "text",
                  content: replyText,
                  mid: sent.message_id ?? null,
                  delivery_status: "sent",
                });
                await sb
                  .from("ai_conversations")
                  .update({
                    last_message_at: new Date().toISOString(),
                    last_message_preview: replyText.slice(0, 200),
                  })
                  .eq("id", conv!.id);
                // Clear any previous last_error on successful send.
                await sb
                  .from("messenger_integrations")
                  .update({ last_error: null } as any)
                  .eq("id", (integ as any).id);
              } catch (sendErr) {
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "assistant",
                  direction: "out",
                  message_type: "text",
                  content: replyText,
                  delivery_status: "failed",
                  error: (sendErr as Error).message,
                });
                await sb
                  .from("messenger_integrations")
                  .update({
                    last_error: (sendErr as Error).message,
                    delivery_failures: ((integ as any).delivery_failures ?? 0) + 1,
                  } as any)
                  .eq("id", (integ as any).id);
              }

            } catch (e) {
              console.error("messenger handler", e);
              if (queuedJobId) queuedProcessingError = e instanceof Error ? e : new Error("Messenger processing failed");
              await sb
                .from("messenger_integrations")
                .update({ last_error: (e as Error).message } as any)
                .eq("id", (integ as any).id);
            }
          }
        }
        if (queuedProcessingError) return new Response(queuedProcessingError.message, { status: 503 });
        return new Response("ok");
      }
    }
  }
}
