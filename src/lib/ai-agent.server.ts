// AI Commerce Engine — core agent logic used by storefront chat and Messenger webhook.
import { createClient } from "@supabase/supabase-js";
import { generateText, streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import {
  sendProductCard as fbSendProductCard,
  sendProductCarousel as fbSendProductCarousel,
} from "./messenger-send.server";
import { checkDuplicate } from "./duplicate-guard.server";

function admin() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type AgentContext = {
  storeId: string;
  storeSlug?: string;
  conversationId?: string; // Messenger/web conversation row
  psid?: string; // Messenger PSID
  pageToken?: string; // decrypted page access token
  siteOrigin?: string; // e.g. https://mystore.orzen.top
  channel?: "web" | "messenger"; // controls which display tools are registered
  focusProductId?: string | null; // server-resolved product for this turn (see resolveFocusProduct)
};


export async function loadAiContext(storeId: string) {
  const sb = admin();
  const [{ data: store }, { data: agent }, { data: settings }] = await Promise.all([
    sb.from("stores").select("id,slug,name,description,address,phone,whatsapp,facebook,delivery,payments_config").eq("id", storeId).maybeSingle(),
    sb.from("store_ai_agents").select("*").eq("store_id", storeId).maybeSingle(),
    sb.from("ai_global_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (!store || !agent) throw new Error("Agent not configured");
  if (!agent.enabled) throw new Error("Agent disabled");
  if (settings && settings.enabled === false) throw new Error("AI globally disabled");
  return { store, agent, settings };
}

export type GlobalAiSettings = {
  global_system_prompt?: string | null;
  safety_rules?: string | null;
  brand_voice?: string | null;
  supported_languages?: string[] | null;
  temperature?: number | null;
  max_tokens?: number | null;
  fallback_model?: string | null;
};

export type AgentState = {
  pending_order?: Record<string, any> | null;
  last_order?: Record<string, any> | null;
  recent_product_ids?: string[] | null;
};

export type FocusProduct = {
  product: any | null;
  ambiguous: boolean;
  candidates: any[]; // small summaries when ambiguous
  canonical_caption?: string;
};

export function buildSystemPrompt(
  store: any,
  agent: any,
  opts?: {
    channel?: "web" | "messenger";
    settings?: GlobalAiSettings | null;
    state?: AgentState | null;
    focus?: FocusProduct | null;
  },
) {
  const channel = opts?.channel ?? "messenger";
  const settings = opts?.settings ?? null;
  const state = opts?.state ?? null;
  const focus = opts?.focus ?? null;
  const displayTools =
    channel === "web"
      ? "showProducts (multiple) or showProduct (one) — the web chat renders rich cards inline"
      : "sendProductCarousel (multiple) or sendProductCard (one) so Messenger shows the image, price, stock and buy button";
  const k = (agent.knowledge ?? {}) as Record<string, any>;
  const supported = (settings?.supported_languages ?? []).filter(Boolean);
  const langHint =
    supported.length > 0
      ? `Only respond in one of these languages: ${supported.join(", ")}. Match the customer's language when possible.`
      : "";
  const lang =
    agent.language === "bn"
      ? "Respond in Bangla."
      : agent.language === "en"
      ? "Respond in English."
      : "Respond in the same language the customer uses (Bangla or English).";

  const emoji = agent.use_emoji ? "Use friendly emojis sparingly." : "Do not use emojis.";
  const human = agent.human_like ? "Sound natural and human, not robotic." : "";
  const faqs = Array.isArray(k.faqs)
    ? k.faqs.map((f: any) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")
    : "";
  const globalPrompt = (settings?.global_system_prompt ?? "").trim();
  const brand = (settings?.brand_voice ?? "").trim();
  const safety = (settings?.safety_rules ?? "").trim();
  const globalBlock = [
    globalPrompt ? `# Platform guidance\n${globalPrompt}` : "",
    brand ? `# Brand voice\n${brand}` : "",
    safety ? `# Safety & compliance (never violate)\n${safety}` : "",
    langHint ? `# Language policy\n${langHint}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // Compact pending-order block — NO product_name/product_id (that leaks into
  // free-form text as if it were the current focus). The focus block below is
  // the single source of truth for product facts this turn.
  const stateLines: string[] = [];
  const po = state?.pending_order && Object.keys(state.pending_order).length ? state.pending_order : null;
  if (po) {
    const parts = [
      po.qty ? `qty=${po.qty}` : null,
      po.customer_name ? `name=${po.customer_name}` : null,
      po.phone ? `phone=${po.phone}` : null,
      po.full_address ? `address=${String(po.full_address).slice(0, 120)}` : null,
      po.payment_method ? `payment=${po.payment_method}` : null,
    ].filter(Boolean);
    if (parts.length) stateLines.push(`Pending order slot (already collected): ${parts.join(", ")}`);
  }
  const lo = state?.last_order;
  if (lo?.order_id) {
    stateLines.push(
      `Last confirmed order: #${lo.invoice_no || lo.order_id} — ${lo.product_name ?? "product"} × ${lo.qty ?? 1}`,
    );
  }
  const stateBlock = stateLines.length ? `# Conversation state\n${stateLines.join("\n")}` : "";

  // Focus product block — server-resolved for THIS turn only. If set, it is the
  // ONLY product the assistant is allowed to describe/name/price/image in text.
  let focusBlock = "";
  if (focus?.product) {
    const p = focus.product;
    const feat = stringifyProductField(p.features).slice(0, 400);
    const varList = Array.isArray(p.variants)
      ? p.variants.map((v: any) => v?.label || v?.name).filter(Boolean).slice(0, 10).join(", ")
      : "";
    focusBlock = [
      `# Focus product (ONLY product allowed in this reply)`,
      `id: ${p.id}`,
      `name: ${p.name}`,
      p.brand ? `brand: ${p.brand}` : "",
      `price: ৳${p.price}${p.old_price ? ` (was ৳${p.old_price})` : ""}`,
      `stock: ${p.stock}`,
      p.sku ? `sku: ${p.sku}` : "",
      p.short_description ? `short_description: ${p.short_description}` : "",
      feat ? `features: ${feat}` : "",
      varList ? `variants: ${varList}` : "",
      ``,
      `Rule: every product fact in your reply MUST come from this record. Do not name, describe, price, or image any other product in this reply. To show it, call ${channel === "web" ? "showProduct" : "sendProductCard"} with productId=${p.id}.`,
    ].filter(Boolean).join("\n");
  } else if (focus?.ambiguous && focus.candidates?.length) {
    const list = focus.candidates.slice(0, 4).map((c: any, i: number) => `${i + 1}. ${c.name} — ৳${c.price} (id ${c.id})`).join("\n");
    focusBlock = [
      `# Focus product — AMBIGUOUS`,
      `The customer's message could refer to multiple products:`,
      list,
      ``,
      `Rule: do NOT pick one and describe it. Ask ONE short disambiguation question naming these options. Do not call sendProductCard / showProduct until the customer confirms.`,
    ].join("\n");
  }

  return `${globalBlock ? globalBlock + "\n\n" : ""}You are ${agent.agent_name}, the sales assistant for "${store.name}".
${lang} ${emoji} ${human}
Style: ${agent.style}.


# Hard rules — never violate
- NEVER invent product names, prices, stock, features, or policies. Every product fact must come from a tool call in this turn OR from the Focus product block below.
- Every reply must be freshly generated for the customer's latest message and the current conversation state. Never repeat the same sentence you sent earlier in this conversation — vary the wording.
- The MOMENT a customer mentions a product, category, price range, brand, or asks "what do you sell / show me products / আপনাদের কি আছে / দাম কত" — IMMEDIATELY call searchProducts (or listCategories if they ask for categories). Do not answer from memory, do not ask clarifying questions first for a general browse intent.
- If a Focus product is set below, you MUST use its id when calling sendProductCard/showProduct, and every product fact in your text MUST come from that record. Never mix in facts from another product, earlier turn, or the pending-order slot.
- If searchProducts returns 0 results, try again with a broader query (drop filters, translate Bangla→English keyword, try a synonym) before telling the customer "not found".
- When you have products to show, call ${displayTools}. Also write a short friendly text line (1 sentence) introducing them. Never leave the text reply empty when you showed products — always add a line like "এই প্রোডাক্টগুলো দেখুন 👇".
- Never say a product image is unavailable until you checked the product tool result. If primary_image_url or gallery has an image, send a product card.
- If a product is out of stock, tell the customer and call searchProducts in the same category to suggest alternatives.
- If the customer changes topic mid-conversation (e.g. asks about delivery charge while an order is pending), answer the new topic FIRST using the appropriate tool, then only resume the order flow when they signal they're ready to continue.
- If you cannot answer confidently from tools or store data, ask ONE specific follow-up question in the customer's language. Never send a generic greeting, apology, or "how can I help you?" template.
- If you cannot answer confidently or the customer asks for a human, call escalateToHuman.


# Order flow
When the customer wants to buy:
1. Use collectOrderInfo to save each field as the customer gives it (name, phone, district, upazila, union, village, full_address, product_id, variant, qty, delivery_method, payment_method).
2. Ask only for fields that are still missing — never re-ask what you already have (see the pending-order slot in the state block below).
3. Once every required field is present, call finalizeOrder. It creates the order and returns the confirmation.
4. If finalizeOrder returns error="duplicate_blocked", send the returned reply exactly and stop the order flow. Do not show product cards or say you are ordering again.
5. After finalizeOrder succeeds, use getRelatedProducts and offer 2-3 add-ons via sendProductCarousel.

# Tracking
If asked "where is my order" / "track my order", call trackOrder with orderId, invoice_no, or phone.

# Memory
At the start of each conversation call getCustomerMemory to see previous orders and preferences. Personalise your greeting.

${focusBlock ? focusBlock + "\n\n" : ""}${stateBlock ? stateBlock + "\n\n" : ""}# Store facts
Address: ${store.address || "n/a"}
Phone: ${store.phone || "n/a"}
Delivery: ${k.delivery_policy || JSON.stringify(store.delivery ?? {})}
Returns: ${k.return_policy || ""}
Warranty: ${k.warranty_policy || ""}
Payment: ${k.payment_methods || ""}
Business hours: ${k.business_hours || ""}
Store info: ${k.store_info || store.description || ""}

FAQs:
${faqs}`;
}



// ---------- Helpers ----------
const PUBLIC_MESSENGER_ORIGIN = "https://orzen-commerce.lovable.app";

function publicOrigin(ctx: AgentContext) {
  return (ctx.siteOrigin || process.env.PUBLIC_APP_URL || process.env.VITE_APP_URL || PUBLIC_MESSENGER_ORIGIN).replace(/\/$/, "");
}

function productUrl(ctx: AgentContext, slug: string | null | undefined, productId: string) {
  const base = publicOrigin(ctx);
  const s = ctx.storeSlug || slug || "";
  return s ? `${base.replace(/\/$/, "")}/store/${s}/product/${productId}` : `${base}/product/${productId}`;
}

function absoluteUrl(ctx: AgentContext, value: string | null | undefined) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  const base = publicOrigin(ctx);
  const path = value.startsWith("/") ? value : `/api/img/${value}`;
  return `${base}${path}`;
}

function firstImage(ctx: AgentContext, product: any) {
  if (product.primary_image_url) return absoluteUrl(ctx, product.primary_image_url);
  const gallery = Array.isArray(product.gallery) ? product.gallery : [];
  return absoluteUrl(ctx, gallery.find(Boolean));
}

const BANGLA_SEARCH_SYNONYMS: Record<string, string[]> = {
  "ব্যাগ": ["bag", "school bag", "backpack"],
  "স্কুল": ["school"],
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

const PRODUCT_STOPWORDS = new Set([
  "this", "that", "these", "those", "show", "give", "send", "photo", "image", "picture", "pic", "please", "price", "details",
  "এটা", "এইটা", "ওটা", "এই", "ওই", "এর", "টার", "একটা", "একটি", "ছবি", "দাও", "দেন", "দেখাও", "দেখান", "কি", "কী", "আছে", "দাম", "কত", "ডিটেইলস", "বিস্তারিত", "প্লিজ", "আমাদের", "আপনাদের",
]);

function searchTerms(raw: string) {
  const compact = raw.toLowerCase().replace(/[.,!?;:()\[\]{}"'`~|/\\]+/g, " ");
  const terms = new Set<string>();
  for (const token of compact.split(/\s+/).map((t) => t.trim()).filter(Boolean)) {
    if (token.length < 2 || PRODUCT_STOPWORDS.has(token)) continue;
    terms.add(token);
    for (const synonym of BANGLA_SEARCH_SYNONYMS[token] ?? []) terms.add(synonym.toLowerCase());
  }
  for (const [bn, synonyms] of Object.entries(BANGLA_SEARCH_SYNONYMS)) {
    if (compact.includes(bn)) synonyms.forEach((s) => terms.add(s.toLowerCase()));
  }
  return Array.from(terms);
}

function stringifyProductField(value: any): string {
  if (!value) return "";
  if (Array.isArray(value)) return value.map(stringifyProductField).join(" ");
  if (typeof value === "object") return Object.values(value).map(stringifyProductField).join(" ");
  return String(value);
}

function productSummary(ctx: AgentContext, product: any, categoryName?: string | null) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    category_id: product.category_id,
    category_name: categoryName ?? null,
    product_code: product.product_code,
    sku: product.sku,
    short_description: product.short_description,
    description: product.description,
    price: product.price,
    old_price: product.old_price,
    stock: product.stock,
    status: product.status,
    image_url: firstImage(ctx, product),
    primary_image_url: firstImage(ctx, product),
    gallery: Array.isArray(product.gallery) ? product.gallery.map((img: string) => absoluteUrl(ctx, img)).filter(Boolean) : [],
    features: product.features,
    specifications: product.specifications,
    variants: product.variants,
    delivery_charge: product.delivery_charge,
    delivery_time_days: product.delivery_time_days,
    rating: product.rating,
    total_sold: product.total_sold,
    warranty: product.warranty,
    return_policy: product.return_policy,
    shipping_info: product.shipping_info,
    product_url: productUrl(ctx, product.slug, product.id),
  };
}

async function getConversationSlot(conversationId: string): Promise<Record<string, any>> {
  const sb = admin();
  const { data } = await sb
    .from("ai_conversations")
    .select("psid_profile")
    .eq("id", conversationId)
    .maybeSingle();
  const profile = (data?.psid_profile ?? {}) as Record<string, any>;
  return (profile.pending_order ?? {}) as Record<string, any>;
}

async function updateConversationSlot(
  conversationId: string,
  patch: Record<string, any>,
) {
  const sb = admin();
  const { data } = await sb
    .from("ai_conversations")
    .select("psid_profile")
    .eq("id", conversationId)
    .maybeSingle();
  const profile = { ...((data?.psid_profile ?? {}) as Record<string, any>) };
  profile.pending_order = { ...(profile.pending_order ?? {}), ...patch };
  await sb.from("ai_conversations").update({ psid_profile: profile }).eq("id", conversationId);
  return profile.pending_order as Record<string, any>;
}

async function clearConversationSlot(conversationId: string) {
  const sb = admin();
  const { data } = await sb
    .from("ai_conversations")
    .select("psid_profile")
    .eq("id", conversationId)
    .maybeSingle();
  const profile = { ...((data?.psid_profile ?? {}) as Record<string, any>) };
  delete profile.pending_order;
  await sb.from("ai_conversations").update({ psid_profile: profile }).eq("id", conversationId);
}

function normalizePhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("8801") && digits.length === 13) return `0${digits.slice(3)}`;
  if (digits.startsWith("01") && digits.length === 11) return digits;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

async function blockDuplicateMessengerToolOrder(opts: {
  sb: ReturnType<typeof admin>;
  storeId: string;
  conversationId: string;
  psid?: string | null;
  slot: Record<string, any>;
  product: { id: string; name?: string | null };
}) {
  const { sb, storeId, conversationId, psid, slot, product } = opts;
  if (!psid || !product.id) return null;

  const { data: dpSettings } = await sb
    .from("store_duplicate_protection")
    .select("messenger_enabled, messenger_custom_reply")
    .eq("store_id", storeId)
    .maybeSingle();
  if (dpSettings && (dpSettings as any).messenger_enabled === false) return null;

  const phone = normalizePhone(slot.phone) ?? String(slot.phone ?? "").trim();
  const dup = await checkDuplicate({
    storeId,
    phone: phone || null,
    customerId: null,
    fingerprint: null,
    deviceId: null,
    productIds: [product.id],
    psid,
  });
  if (dup.action === "allow") return null;

  const invoice = dup.matchedOrder?.invoice_no || dup.matchedOrder?.id || "—";
  const status = dup.matchedOrder?.status || "pending";
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
    phone: phone || null,
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
      blocker: "ai_agent_finalizeOrder",
    },
  } as any);

  await clearConversationSlot(conversationId);
  return {
    ok: false,
    error: "duplicate_blocked",
    reply,
    matched_order_id: dup.matchedOrderId,
    matched_invoice_no: dup.matchedOrder?.invoice_no ?? null,
    matched_status: dup.matchedOrder?.status ?? null,
  };
}

// ---------- Focus product resolver (root-cause fix for wrong-image/wrong-text) ----------

const DEICTIC_TOKENS = [
  "this", "that", "it", "এটা", "এইটা", "ওটা", "ওইটা", "এই", "ওই", "সেই", "সেটা",
];

const PRODUCT_SELECT_MIN =
  "id,name,slug,brand,product_code,sku,category_id,short_description,price,old_price,stock,status,primary_image_url,gallery,features,variants,total_sold,rating,is_featured";

/** Pure scoring function — exposed for tests. Returns 0 when no meaningful signal. */
export function scoreProductAgainstQuery(
  product: {
    name?: string | null;
    brand?: string | null;
    sku?: string | null;
    product_code?: string | null;
    short_description?: string | null;
    description?: string | null;
    features?: unknown;
    specifications?: unknown;
    variants?: unknown;
  },
  terms: string[],
  phrase: string,
): number {
  const name = String(product.name ?? "").toLowerCase();
  const brand = String(product.brand ?? "").toLowerCase();
  const sku = String(product.sku ?? "").toLowerCase();
  const code = String(product.product_code ?? "").toLowerCase();
  const haystack = [
    name, brand, sku, code,
    String(product.short_description ?? "").toLowerCase(),
    String(product.description ?? "").toLowerCase(),
    stringifyProductField(product.features).toLowerCase(),
    stringifyProductField(product.specifications).toLowerCase(),
    stringifyProductField(product.variants).toLowerCase(),
  ].join(" ");
  let score = 0;
  const p = phrase.toLowerCase().trim();
  if (p && name === p) score += 200;                     // exact name match wins
  if (p && name && name.includes(p) && p.length >= 3) score += 100;
  if (p && haystack.includes(p) && p.length >= 3) score += 40;
  for (const t of terms) {
    if (!t) continue;
    if (sku && sku === t) score += 150;                  // exact SKU
    if (code && code === t) score += 150;                // exact product code
    if (name.includes(t)) score += 30;
    if (brand === t) score += 25;
    else if (brand && brand.includes(t)) score += 10;
    if (haystack.includes(t)) score += 8;
  }
  return score;
}

export function canonicalCaption(p: {
  name: string;
  price: number | string;
  old_price?: number | string | null;
  stock: number;
  short_description?: string | null;
}): string {
  const price = p.old_price ? `৳${p.price} (was ৳${p.old_price})` : `৳${p.price}`;
  const stock = Number(p.stock) > 0 ? "in stock" : "out of stock";
  const sd = (p.short_description ?? "").trim();
  return sd ? `${p.name} — ${price}, ${stock}. ${sd}` : `${p.name} — ${price}, ${stock}.`;
}

/**
 * Deterministically resolve which product this turn is about, BEFORE calling
 * the model. This is the single anti-hallucination gate: if the customer's
 * latest message names/references a product, we pin that product's DB row and
 * force every tool call + text sentence to derive from it.
 */
export async function resolveFocusProduct(opts: {
  storeId: string;
  conversationId?: string | null;
  text: string;
}): Promise<FocusProduct> {
  const raw = String(opts.text ?? "").trim();
  if (!raw) return { product: null, ambiguous: false, candidates: [] };
  const sb = admin();

  // 1) Deictic reference ("this / এটা / ওইটা / it") → use the last recommended
  //    product in this conversation. If there's exactly one recent id, pin it.
  const compact = raw.toLowerCase();
  const hasDeictic = DEICTIC_TOKENS.some((t) => new RegExp(`(^|\\W)${t}(\\W|$)`, "i").test(compact));
  if (hasDeictic && opts.conversationId) {
    const { data: recs } = await sb
      .from("ai_product_recommendations")
      .select("product_id,created_at")
      .eq("store_id", opts.storeId)
      .eq("conversation_id", opts.conversationId)
      .order("created_at", { ascending: false })
      .limit(5);
    const ids = Array.from(new Set((recs ?? []).map((r: any) => r.product_id).filter(Boolean)));
    if (ids.length === 1) {
      const { data: p } = await sb
        .from("products")
        .select(PRODUCT_SELECT_MIN)
        .eq("store_id", opts.storeId)
        .eq("id", ids[0]!)
        .eq("status", "active")
        .maybeSingle();
      if (p) return { product: p, ambiguous: false, candidates: [], canonical_caption: canonicalCaption(p as any) };
    }
    // Multiple recent products → let the search branch below try to
    // disambiguate; if it also fails, we'll return ambiguous with these ids.
  }

  // 2) Search branch: score all active products against the message text.
  const terms = searchTerms(raw);
  if (!terms.length && !hasDeictic) return { product: null, ambiguous: false, candidates: [] };

  const { data: rows } = await sb
    .from("products")
    .select(PRODUCT_SELECT_MIN)
    .eq("store_id", opts.storeId)
    .eq("status", "active")
    .limit(500);
  const { data: bl } = await sb
    .from("ai_product_blacklist")
    .select("product_id")
    .eq("store_id", opts.storeId);
  const blocked = new Set((bl ?? []).map((r: any) => r.product_id));

  const scored = (rows ?? [])
    .filter((r: any) => !blocked.has(r.id))
    .map((r: any) => ({ product: r, score: scoreProductAgainstQuery(r, terms, raw) }))
    .filter((row) => row.score >= 25)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    // Deictic with multiple recent products → mark ambiguous with those.
    if (hasDeictic && opts.conversationId) {
      const { data: recs } = await sb
        .from("ai_product_recommendations")
        .select("product_id,created_at")
        .eq("store_id", opts.storeId)
        .eq("conversation_id", opts.conversationId)
        .order("created_at", { ascending: false })
        .limit(4);
      const ids = Array.from(new Set((recs ?? []).map((r: any) => r.product_id).filter(Boolean))).slice(0, 4);
      if (ids.length >= 2) {
        const { data: prods } = await sb
          .from("products")
          .select(PRODUCT_SELECT_MIN)
          .eq("store_id", opts.storeId)
          .in("id", ids);
        return {
          product: null,
          ambiguous: true,
          candidates: (prods ?? []).map((p: any) => ({
            id: p.id, name: p.name, price: p.price, primary_image_url: p.primary_image_url,
          })),
        };
      }
    }
    return { product: null, ambiguous: false, candidates: [] };
  }

  const top = scored[0]!;
  const second = scored[1];
  // Ambiguous when top-2 within 15% of the top score AND both above threshold.
  if (second && second.score >= top.score * 0.85) {
    return {
      product: null,
      ambiguous: true,
      candidates: scored.slice(0, 4).map((row) => ({
        id: row.product.id, name: row.product.name, price: row.product.price,
        primary_image_url: row.product.primary_image_url,
      })),
    };
  }
  return {
    product: top.product,
    ambiguous: false,
    candidates: [],
    canonical_caption: canonicalCaption(top.product as any),
  };
}

// ---------- Tools ----------
export function buildTools(ctx: AgentContext) {

  const sb = admin();
  const storeId = ctx.storeId;

  const productSelect =
    "id,name,slug,brand,product_code,sku,category_id,short_description,description,price,old_price,stock,status,primary_image_url,gallery,features,specifications,variants,video_url,delivery_charge,delivery_time_days,rating,total_sold,warranty,return_policy,shipping_info,is_featured,created_at";

  const convId = ctx.conversationId ?? null;

  async function getBlacklistedIds(): Promise<Set<string>> {
    const { data } = await sb
      .from("ai_product_blacklist")
      .select("product_id")
      .eq("store_id", storeId);
    return new Set((data ?? []).map((r: any) => r.product_id));
  }

  async function logRecommendations(toolName: string, products: any[], contextText: string) {
    if (!convId || !products?.length) return;
    try {
      const rows = products.slice(0, 10).map((p: any) => ({
        store_id: storeId,
        conversation_id: convId,
        product_id: p.id,
        tool_name: toolName,
        context: contextText.slice(0, 500),
      }));
      await sb.from("ai_product_recommendations").insert(rows as any);
    } catch { /* non-fatal */ }
  }

  async function categoryMap() {
    const { data } = await sb.from("categories").select("id,name").eq("store_id", storeId);
    return new Map((data ?? []).map((c: any) => [c.id, c.name]));
  }

  const tools: Record<string, any> = {
    searchProducts: tool({
      description:
        "Search this store's products. Use for any natural-language product intent (e.g. 'mini projector', 'waterproof bedsheet under 1000', 'cheapest fan'). Returns matching products with price, stock, image.",
      inputSchema: z.object({
        query: z.string().min(1).max(200).describe("Customer's search phrase or keyword"),
        category: z.string().optional().describe("Optional category name"),
        brand: z.string().optional(),
        minPrice: z.number().nonnegative().optional(),
        maxPrice: z.number().nonnegative().optional(),
        inStockOnly: z.boolean().optional().default(true),
        sort: z.enum(["relevance", "price_asc", "price_desc", "bestseller", "newest"]).optional().default("relevance"),
        limit: z.number().int().min(1).max(10).optional().default(6),
      }),
      execute: async (input) => {
        let q = sb
          .from("products")
          .select(productSelect)
          .eq("store_id", storeId)
          .eq("status", "active");
        if (input.brand) q = q.ilike("brand", `%${input.brand}%`);
        if (input.minPrice != null) q = q.gte("price", input.minPrice);
        if (input.maxPrice != null) q = q.lte("price", input.maxPrice);
        if (input.inStockOnly) q = q.gt("stock", 0);
        const cats = await categoryMap();
        if (input.category) {
          const { data: cat } = await sb
            .from("categories")
            .select("id")
            .eq("store_id", storeId)
            .ilike("name", `%${input.category}%`)
            .maybeSingle();
          if (cat) q = q.eq("category_id", cat.id);
        }
        if (input.sort === "price_asc") q = q.order("price", { ascending: true });
        else if (input.sort === "price_desc") q = q.order("price", { ascending: false });
        else if (input.sort === "bestseller") q = q.order("total_sold", { ascending: false });
        else if (input.sort === "newest") q = q.order("created_at", { ascending: false });
        else q = q.order("is_featured", { ascending: false }).order("total_sold", { ascending: false });
        const { data } = await q.limit(120);
        const blocked = await getBlacklistedIds();
        const terms = searchTerms(input.query);
        const phrase = input.query.toLowerCase().trim();
        const scored = (data ?? [])
          .filter((p: any) => !blocked.has(p.id))
          .map((p: any) => {
            const categoryName = cats.get(p.category_id) ?? "";
            const haystack = [
              p.name,
              p.brand,
              p.sku,
              p.product_code,
              categoryName,
              p.short_description,
              p.description,
              stringifyProductField(p.features),
              stringifyProductField(p.specifications),
              stringifyProductField(p.variants),
            ].join(" ").toLowerCase();
            let score = 0;
            if (phrase && haystack.includes(phrase)) score += 60;
            for (const term of terms) {
              if (haystack.includes(term)) score += 25;
              if (String(p.name ?? "").toLowerCase().includes(term)) score += 20;
              if (String(categoryName).toLowerCase().includes(term)) score += 15;
              if (String(p.brand ?? "").toLowerCase().includes(term)) score += 10;
            }
            if (p.stock > 0) score += 8;
            if (p.is_featured) score += 6;
            score += Math.min(Number(p.total_sold) || 0, 50) / 10;
            score += Math.min(Number(p.rating) || 0, 5);
            return { product: p, score };
          });
        const hasMeaningfulTerms = terms.length > 0;
        let ranked = scored;
        if (hasMeaningfulTerms) {
          const matches = scored.filter((row) => row.score >= 25);
          ranked = matches.length ? matches : scored;
        }
        ranked.sort((a, b) => b.score - a.score);
        const filtered = ranked.slice(0, input.limit ?? 6).map((row) => row.product);
        await logRecommendations("searchProducts", filtered, input.query);
        return {
          products: filtered.map((p: any) => productSummary(ctx, p, cats.get(p.category_id))),
          query_terms: terms,
          fallback_used: hasMeaningfulTerms && !scored.some((row) => row.score >= 25),
        };
      },
    }),

    getRecentRecommendations: tool({
      description:
        "Return the most recent products shown/recommended in this conversation. Use when the customer says this/that/এটা/এইটা/ছবি/details after a previous product recommendation.",
      inputSchema: z.object({
        limit: z.number().optional().default(5),
      }),
      execute: async ({ limit }) => {
        if (!convId) return { products: [] };
        const { data: recs } = await sb
          .from("ai_product_recommendations")
          .select("product_id,created_at,context")
          .eq("store_id", storeId)
          .eq("conversation_id", convId)
          .order("created_at", { ascending: false })
          .limit(Math.max(Number(limit ?? 5) * 3, 5));
        const ids = Array.from(new Set((recs ?? []).map((r: any) => r.product_id).filter(Boolean))).slice(0, limit ?? 5);
        if (!ids.length) return { products: [] };
        const [blocked, cats, productsResult] = await Promise.all([
          getBlacklistedIds(),
          categoryMap(),
          sb.from("products").select(productSelect).eq("store_id", storeId).eq("status", "active").in("id", ids),
        ]);
        const byId = new Map((productsResult.data ?? []).map((p: any) => [p.id, p]));
        const products = ids
          .map((id) => byId.get(id))
          .filter((p: any) => p && !blocked.has(p.id))
          .map((p: any) => productSummary(ctx, p, cats.get(p.category_id)));
        return { products };
      },
    }),

    getProduct: tool({
      description: "Get full details of one product by id. Use before quoting exact price or specs.",
      inputSchema: z.object({ productId: z.string().uuid() }),
      execute: async ({ productId }) => {
        const blocked = await getBlacklistedIds();
        if (blocked.has(productId)) {
          return { blocked: true, message: "This product is unavailable. Suggest an alternative." };
        }
        const { data } = await sb
          .from("products")
          .select(productSelect)
          .eq("store_id", storeId)
          .eq("id", productId)
          .maybeSingle();
        if (data) await logRecommendations("getProduct", [data], "detail_view");
        const cats = await categoryMap();
        return data ? productSummary(ctx, data, cats.get(data.category_id)) : null;
      },
    }),

    listCategories: tool({
      description: "List product categories in this store.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await sb
          .from("categories")
          .select("id,name")
          .eq("store_id", storeId);
        return data ?? [];
      },
    }),

    listBrands: tool({
      description: "List distinct product brands sold in this store.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await sb
          .from("products")
          .select("brand")
          .eq("store_id", storeId)
          .not("brand", "is", null);
        const set = new Set((data ?? []).map((r: any) => r.brand).filter(Boolean));
        return Array.from(set);
      },
    }),

    checkStock: tool({
      description: "Check real-time stock for a product (and variant if given).",
      inputSchema: z.object({
        productId: z.string().uuid(),
        variant: z.string().optional().describe("e.g. 'Red / M'"),
      }),
      execute: async ({ productId, variant }) => {
        const { data } = await sb
          .from("products")
          .select("id,name,stock,variants,low_stock_threshold")
          .eq("store_id", storeId)
          .eq("id", productId)
          .maybeSingle();
        if (!data) return { found: false };
        let variantStock: number | null = null;
        if (variant && Array.isArray(data.variants)) {
          const v = (data.variants as any[]).find(
            (x) => String(x.label || x.name || "").toLowerCase() === variant.toLowerCase(),
          );
          if (v) variantStock = Number(v.stock ?? 0);
        }
        return {
          found: true,
          name: data.name,
          stock: variantStock ?? data.stock,
          low_stock: (variantStock ?? data.stock) <= (data.low_stock_threshold ?? 5),
        };
      },
    }),

    getRelatedProducts: tool({
      description:
        "Get related products for upsell/cross-sell. kind='similar' returns same-category products; 'accessory'/'upsell' returns curated related_product_ids.",
      inputSchema: z.object({
        productId: z.string().uuid(),
        kind: z.enum(["similar", "accessory", "upsell"]).default("similar"),
        limit: z.number().int().min(1).max(6).default(4),
      }),
      execute: async ({ productId, kind, limit }) => {
        const { data: p } = await sb
          .from("products")
          .select("id,category_id,related_product_ids")
          .eq("store_id", storeId)
          .eq("id", productId)
          .maybeSingle();
        if (!p) return [];
        if (kind !== "similar" && Array.isArray(p.related_product_ids) && p.related_product_ids.length) {
          const { data } = await sb
            .from("products")
            .select(productSelect)
            .eq("store_id", storeId)
            .in("id", p.related_product_ids as any)
            .eq("status", "active")
            .gt("stock", 0)
            .limit(limit);
          return data ?? [];
        }
        if (!p.category_id) return [];
        const { data } = await sb
          .from("products")
          .select(productSelect)
          .eq("store_id", storeId)
          .eq("category_id", p.category_id)
          .neq("id", productId)
          .eq("status", "active")
          .gt("stock", 0)
          .limit(limit);
        return data ?? [];
      },
    }),

    compareProducts: tool({
      description:
        "Compare 2-4 products side by side (price, features, stock, rating) and get a recommended pick.",
      inputSchema: z.object({
        productIds: z.array(z.string().uuid()).min(2).max(4),
      }),
      execute: async ({ productIds }) => {
        const { data } = await sb
          .from("products")
          .select("id,name,price,old_price,stock,features,specifications,rating,total_sold")
          .eq("store_id", storeId)
          .in("id", productIds);
        const rows = data ?? [];
        // Score: rating * 20 + in-stock bonus + normalized price (lower better)
        const maxPrice = Math.max(...rows.map((r) => Number(r.price) || 0), 1);
        const scored = rows.map((r) => {
          const s =
            (Number(r.rating) || 0) * 20 +
            (r.stock > 0 ? 15 : 0) +
            (1 - Number(r.price) / maxPrice) * 30 +
            (Number(r.total_sold) || 0) * 0.1;
          return { ...r, score: s };
        });
        scored.sort((a, b) => (b as any).score - (a as any).score);
        return { comparison: scored, recommended: scored[0]?.id };
      },
    }),
  };

  // Messenger-only tools that need PSID + token
  if (ctx.psid && ctx.pageToken) {
    tools.sendProductCard = tool({
      description:
        "Send one product to the customer as a rich Messenger card with Buy Now / View Product buttons. Prefer this over describing a product in plain text.",
      inputSchema: z.object({ productId: z.string().uuid() }),
      execute: async ({ productId }) => {
        if (ctx.focusProductId && productId !== ctx.focusProductId) {
          return { sent: false, error: "must_use_focus_product", focus_product_id: ctx.focusProductId };
        }
        const { data: p } = await sb
          .from("products")
          .select("id,name,slug,short_description,price,old_price,stock,primary_image_url,gallery")
          .eq("store_id", storeId)
          .eq("id", productId)
          .maybeSingle();
        if (!p) return { sent: false, error: "not_found" };

        const priceLine = p.old_price
          ? `৳${p.price} (was ৳${p.old_price})`
          : `৳${p.price}`;
        const stockLine = p.stock > 0 ? "In stock" : "Out of stock";
        const subtitle = `${priceLine} · ${stockLine}${p.short_description ? " — " + p.short_description : ""}`;
        try {
          await fbSendProductCard(ctx.pageToken!, ctx.psid!, {
            title: p.name,
            subtitle,
            image_url: firstImage(ctx, p),
            buy_url: productUrl(ctx, p.slug, p.id),
            product_id: p.id,
          });
          if (ctx.conversationId) {
            await sb.from("ai_messages").insert({
              conversation_id: ctx.conversationId,
              role: "assistant",
              direction: "out",
              message_type: "product_card",
              content: `[card] ${p.name}`,
              attachments: [{ type: "product_card", product_id: p.id }],
            } as any);
          }
          return { sent: true, canonical_caption: canonicalCaption(p as any), product_id: p.id, name: p.name };
        } catch (e) {
          return { sent: false, error: (e as Error).message };
        }
      },
    });

    tools.sendProductCarousel = tool({
      description:
        "Send multiple products as a scrollable carousel. Use for search results, comparisons, and upsell suggestions.",
      inputSchema: z.object({
        productIds: z.array(z.string().uuid()).min(1).max(10),
      }),
      execute: async ({ productIds }) => {
        const { data } = await sb
          .from("products")
          .select("id,name,slug,short_description,price,old_price,stock,primary_image_url,gallery")
          .eq("store_id", storeId)
          .in("id", productIds);
        const items = (data ?? []).map((p) => ({
          title: p.name,
          subtitle: `${p.old_price ? `৳${p.price} (was ৳${p.old_price})` : `৳${p.price}`} · ${p.stock > 0 ? "In stock" : "Out of stock"}`,
          image_url: firstImage(ctx, p),
          buy_url: productUrl(ctx, p.slug, p.id),
          product_id: p.id,
        }));
        if (!items.length) return { sent: false, error: "no_products" };
        try {
          await fbSendProductCarousel(ctx.pageToken!, ctx.psid!, items);
          if (ctx.conversationId) {
            await sb.from("ai_messages").insert({
              conversation_id: ctx.conversationId,
              role: "assistant",
              direction: "out",
              message_type: "product_carousel",
              content: `[carousel] ${items.length} products`,
              attachments: items.map((i) => ({ type: "product_card", product_id: i.product_id })),
            } as any);
          }
          return { sent: true, count: items.length };
        } catch (e) {
          return { sent: false, error: (e as Error).message };
        }
      },
    });
  }

  // Web-only display tools — return structured JSON that the chat panel renders inline.
  if (ctx.channel === "web") {
    async function loadProducts(ids: string[]) {
      if (!ids.length) return [];
      const [blocked, cats, res] = await Promise.all([
        getBlacklistedIds(),
        categoryMap(),
        sb.from("products").select(productSelect).eq("store_id", storeId).in("id", ids),
      ]);
      const byId = new Map((res.data ?? []).map((p: any) => [p.id, p]));
      return ids
        .map((id) => byId.get(id))
        .filter((p: any) => p && !blocked.has(p.id))
        .map((p: any) => productSummary(ctx, p, cats.get(p.category_id)));
    }

    tools.showProduct = tool({
      description:
        "Display ONE product to the web-chat customer as a rich card (image, name, price, stock, view/buy buttons). Use whenever you want the customer to see a specific product.",
      inputSchema: z.object({ productId: z.string().uuid() }),
      execute: async ({ productId }) => {
        if (ctx.focusProductId && productId !== ctx.focusProductId) {
          return { rendered: false, error: "must_use_focus_product", focus_product_id: ctx.focusProductId };
        }
        const products = await loadProducts([productId]);
        if (!products.length) return { rendered: false, error: "not_found" };
        await logRecommendations("showProduct", products, "web_card");
        return { rendered: true, products, canonical_caption: canonicalCaption(products[0] as any) };
      },
    });


    tools.showProducts = tool({
      description:
        "Display up to 10 products to the web-chat customer as a scrollable carousel. Use for search results, comparisons, and cross-sell suggestions.",
      inputSchema: z.object({ productIds: z.array(z.string().uuid()).min(1).max(10) }),
      execute: async ({ productIds }) => {
        const products = await loadProducts(productIds);
        if (!products.length) return { rendered: false, error: "no_products" };
        await logRecommendations("showProducts", products, "web_carousel");
        return { rendered: true, products };
      },
    });
  }

  // Conversation-aware tools (order flow, memory, escalation)
  if (ctx.conversationId) {
    const convId = ctx.conversationId;

    tools.collectOrderInfo = tool({
      description:
        "Save one or more fields the customer just provided for their pending order. Only pass fields the customer explicitly gave. Returns which required fields are still missing.",
      inputSchema: z.object({
        customer_name: z.string().optional(),
        phone: z.string().optional(),
        district: z.string().optional(),
        upazila: z.string().optional(),
        union: z.string().optional(),
        village: z.string().optional(),
        full_address: z.string().optional(),
        product_id: z.string().uuid().optional(),
        variant: z.string().optional(),
        qty: z.number().int().min(1).max(99).optional(),
        delivery_method: z.string().optional(),
        payment_method: z.enum(["cod", "bkash", "nagad", "rocket", "bank"]).optional(),
      }),
      execute: async (input) => {
        const patch: Record<string, any> = {};
        Object.entries(input).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") patch[k] = v;
        });
        const slot = await updateConversationSlot(convId, patch);
        const required = ["customer_name", "phone", "full_address", "product_id", "qty", "payment_method"];
        const missing = required.filter((f) => !slot[f]);
        return { saved: patch, current: slot, missing };
      },
    });

    tools.finalizeOrder = tool({
      description:
        "Create the order after collectOrderInfo has all required fields. Reserves stock, generates invoice, sends confirmation. Returns orderId and totals.",
      inputSchema: z.object({}),
      execute: async () => {
        const slot = await getConversationSlot(convId);
        const required = ["customer_name", "phone", "full_address", "product_id", "qty", "payment_method"];
        const missing = required.filter((f) => !slot[f]);
        if (missing.length) return { ok: false, error: "missing_fields", missing };

        const { data: product } = await sb
          .from("products")
          .select("id,name,price,stock,delivery_charge")
          .eq("store_id", storeId)
          .eq("id", slot.product_id)
          .maybeSingle();
        if (!product) return { ok: false, error: "product_not_found" };
        if (product.stock < slot.qty) return { ok: false, error: "out_of_stock", available: product.stock };

        const duplicateBlocked = await blockDuplicateMessengerToolOrder({
          sb,
          storeId,
          conversationId: convId,
          psid: ctx.psid,
          slot,
          product: { id: product.id, name: product.name },
        });
        if (duplicateBlocked) return duplicateBlocked;

        const subtotal = Number(product.price) * Number(slot.qty);
        const delivery = Number(product.delivery_charge ?? 0);

        // Link to store_customers by phone
        let customerId: string | null = null;
        const phoneNorm = normalizePhone(slot.phone) ?? String(slot.phone).replace(/\D/g, "");
        if (phoneNorm) {
          const { data: existing } = await sb
            .from("store_customers")
            .select("id")
            .eq("store_id", storeId)
            .eq("phone", phoneNorm)
            .maybeSingle();
          if (existing) customerId = existing.id;
        }

        const { data: order, error } = await sb
          .from("orders")
          .insert({
            store_id: storeId,
            customer_name: slot.customer_name,
            phone: phoneNorm || slot.phone,
            address: slot.full_address,
            area: [slot.village, slot.union, slot.upazila, slot.district].filter(Boolean).join(", ") || null,
            payment_method: slot.payment_method,
            subtotal,
            delivery_amount: delivery,
            status: "pending",
            notes: "Placed via AI Sales Agent (Messenger)",
            customer_id: customerId,
          } as any)
          .select("id,invoice_no")
          .single();
        if (error || !order) return { ok: false, error: error?.message ?? "insert_failed" };

        await sb.from("order_items").insert({
          order_id: order.id,
          product_id: product.id,
          name_snapshot: product.name,
          price_snapshot: product.price,
          qty: slot.qty,
        } as any);

        // Admin notification
        await sb.from("admin_notifications").insert({
          store_id: storeId,
          kind: "new_order",
          title: "New AI order",
          body: `${slot.customer_name} ordered ${slot.qty}× ${product.name}`,
          meta: { order_id: order.id },
        } as any);

        await clearConversationSlot(convId);

        return {
          ok: true,
          orderId: order.id,
          invoice_no: order.invoice_no,
          subtotal,
          delivery,
          grand_total: subtotal + delivery,
          product_name: product.name,
          qty: slot.qty,
        };
      },
    });

    tools.trackOrder = tool({
      description:
        "Look up an order's live status. Provide orderId, invoice_no, or the customer's phone.",
      inputSchema: z.object({
        orderId: z.string().uuid().optional(),
        invoice_no: z.string().optional(),
        phone: z.string().optional(),
      }),
      execute: async ({ orderId, invoice_no, phone }) => {
        let q = sb
          .from("orders")
          .select("id,invoice_no,status,customer_name,courier_name,courier_tracking_id,courier_status,created_at")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false })
          .limit(3);
        if (orderId) q = q.eq("id", orderId);
        else if (invoice_no) q = q.eq("invoice_no", invoice_no);
        else if (phone) q = q.eq("phone", String(phone).replace(/\D/g, ""));
        else return { orders: [] };
        const { data } = await q;
        return { orders: data ?? [] };
      },
    });

    tools.getCustomerMemory = tool({
      description:
        "Get what we know about the current customer: previous orders, favourite products, preferred language.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data: conv } = await sb
          .from("ai_conversations")
          .select("customer_name,phone,psid_profile")
          .eq("id", convId)
          .maybeSingle();
        if (!conv) return {};
        const phoneNorm = conv.phone ? String(conv.phone).replace(/\D/g, "") : null;
        let customer: any = null;
        if (phoneNorm) {
          const { data } = await sb
            .from("store_customers")
            .select("id,full_name,ai_memory,preferred_language")
            .eq("store_id", storeId)
            .eq("phone", phoneNorm)
            .maybeSingle();
          customer = data;
        }
        let recentOrders: any[] = [];
        if (customer?.id) {
          const { data } = await sb
            .from("orders")
            .select("id,invoice_no,status,subtotal,created_at")
            .eq("store_id", storeId)
            .eq("customer_id", customer.id)
            .order("created_at", { ascending: false })
            .limit(5);
          recentOrders = data ?? [];
        }
        return {
          name: conv.customer_name,
          profile: conv.psid_profile,
          customer,
          recent_orders: recentOrders,
        };
      },
    });

    tools.escalateToHuman = tool({
      description:
        "Hand this conversation to a human agent. Use when you cannot answer confidently or the customer asks for a person.",
      inputSchema: z.object({ reason: z.string().min(1).max(500) }),
      execute: async ({ reason }) => {
        await sb.from("ai_conversations").update({
          handoff_mode: "human",
          handoff_reason: reason,
          handoff_at: new Date().toISOString(),
        } as any).eq("id", convId);
        await sb.from("admin_notifications").insert({
          store_id: storeId,
          kind: "human_handoff",
          title: "Customer needs a human",
          body: reason,
          meta: { conversation_id: convId },
        } as any);
        return { ok: true, message: "Handed off to human agent" };
      },
    });
  }

  return tools;
}

export async function logUsage(storeId: string | null, model: string, usage: any, kind: string) {
  try {
    const sb = admin();
    await sb.from("ai_usage").insert({
      store_id: storeId,
      model,
      prompt_tokens: usage?.promptTokens ?? usage?.inputTokens ?? 0,
      completion_tokens: usage?.completionTokens ?? usage?.outputTokens ?? 0,
      cost_usd: 0,
      kind,
    });
  } catch {
    /* swallow */
  }
}

export async function getModelForStore(opts?: { fast?: boolean; modelOverride?: string }) {
  const sb = admin();
  const { data: settings } = await sb.from("ai_global_settings").select("*").eq("id", 1).maybeSingle();
  const saved = (settings?.provider_api_key || "").trim();
  const looksLovable = saved.startsWith("lv_") || saved.startsWith("sk-lovable");
  const apiKey = (looksLovable ? saved : "") || process.env.LOVABLE_API_KEY!;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
  const configuredModel = opts?.modelOverride || settings?.default_model || "google/gemini-2.5-flash";
  const modelId = opts?.fast && configuredModel.includes("pro") ? "google/gemini-2.5-flash" : configuredModel;
  const gateway = createLovableAiGatewayProvider(apiKey);
  return { model: gateway(modelId), modelId, settings: (settings ?? null) as GlobalAiSettings | null, gateway };
}

function generationParams(settings: GlobalAiSettings | null | undefined) {
  const params: { temperature?: number; maxOutputTokens?: number } = {};
  const t = settings?.temperature;
  if (typeof t === "number" && Number.isFinite(t)) params.temperature = Math.max(0, Math.min(2, t));
  const m = settings?.max_tokens;
  if (typeof m === "number" && Number.isFinite(m) && m > 0) params.maxOutputTokens = Math.floor(m);
  return params;
}

export function streamAgentResponse(opts: {
  ctx: AgentContext;
  messages: any[];
  system: string;
}) {
  return async () => {
    const { model, modelId, settings } = await getModelForStore();
    const result = streamText({
      model,
      system: opts.system,
      messages: opts.messages,
      tools: buildTools(opts.ctx),
      stopWhen: stepCountIs(50),
      ...generationParams(settings),
      onFinish: ({ usage }) => {
        void logUsage(opts.ctx.storeId, modelId, usage, "chat");
      },
    });
    return result;
  };
}

function findDuplicateBlockedReply(value: any, depth = 0, seen = new WeakSet<object>()): string | null {
  if (!value || depth > 8) return null;
  if (typeof value !== "object") return null;
  if (seen.has(value)) return null;
  seen.add(value);
  if (value.error === "duplicate_blocked" && typeof value.reply === "string" && value.reply.trim()) {
    return value.reply;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDuplicateBlockedReply(item, depth + 1, seen);
      if (found) return found;
    }
    return null;
  }
  for (const item of Object.values(value)) {
    const found = findDuplicateBlockedReply(item, depth + 1, seen);
    if (found) return found;
  }
  return null;
}

function isTransientGatewayError(err: unknown) {
  const msg = (err as any)?.message || "";
  const status = (err as any)?.statusCode ?? (err as any)?.status;
  if (status === 429 || (typeof status === "number" && status >= 500 && status < 600)) return true;
  return /\b(429|rate.?limit|timeout|overload|5\d\d)\b/i.test(String(msg));
}

async function runGenerate(opts: {
  ctx: AgentContext;
  messages: any[];
  system: string;
  fast?: boolean;
  modelOverride?: string;
}) {
  const { model, modelId, settings } = await getModelForStore({
    fast: opts.fast,
    modelOverride: opts.modelOverride,
  });
  const result = await generateText({
    model,
    system: opts.system,
    messages: opts.messages,
    tools: buildTools(opts.ctx),
    stopWhen: stepCountIs(50),
    ...generationParams(settings),
  });
  return { result, modelId, settings };
}

export async function generateAgentReply(opts: {
  ctx: AgentContext;
  messages: any[];
  system: string;
  fast?: boolean;
}) {
  let attempt: Awaited<ReturnType<typeof runGenerate>>;
  try {
    attempt = await runGenerate(opts);
  } catch (err) {
    // Try fallback model once if configured and error is transient
    const { settings } = await getModelForStore({ fast: opts.fast });
    const fb = (settings?.fallback_model || "").trim();
    if (fb && isTransientGatewayError(err)) {
      attempt = await runGenerate({ ...opts, modelOverride: fb });
    } else {
      throw err;
    }
  }
  const { result, modelId } = attempt;
  void logUsage(opts.ctx.storeId, modelId, result.usage, "messenger");
  const duplicateReply = findDuplicateBlockedReply(result as any);
  if (duplicateReply) return duplicateReply;
  return result.text;
}

