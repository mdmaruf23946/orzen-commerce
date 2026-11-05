// AI Commerce Engine — core agent logic used by storefront chat and Messenger webhook.
import { createClient } from "@supabase/supabase-js";
import { generateText, streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  sendProductCard as fbSendProductCard,
  sendProductCarousel as fbSendProductCarousel,
  sendViewSiteButton as fbSendViewSiteButton,
  sendQuickReplies as fbSendQuickReplies,
} from "./messenger-send.server";
import { checkDuplicate } from "./duplicate-guard.server";
import { collectVerifiedFacts } from "./reply-guard.server";
import {
  fetchDeliveryZones,
  money,
  orderStatusBn,
  resolveDeliveryCharge,
  shortOrderNo,
} from "./chat-order-format";
import {
  ORDER_FIELD_LABELS,
  messengerPaymentMethods,
  normalizeOrderFlow,
  optionalSlotFields,
  renderConfirmation,
  requiredSlotFields,
  type OrderFieldKey,
} from "./messenger-order-flow";
import { replyStyleInstruction, SHORT_REPLY_RULE } from "./reply-language";
import { deriveCustomerStyle, personaInstruction } from "./agents/customer-style";
import { specialistFocus, allowedToolsFor, stepBudget } from "./agents/specialists";
import { asksForHuman } from "./conversation-guard.server";

export function admin() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}
import type { AgentContext, GlobalAiSettings, AgentState, FocusProduct } from "./ai-agent-types";
import { drawerBoundRules, buildSystemPrompt } from "./ai-agent-prompt.server";

// ---------- Helpers ----------
export const PUBLIC_MESSENGER_ORIGIN = "https://orzen-commerce.lovable.app";

export function publicOrigin(ctx: AgentContext) {
  return (
    ctx.siteOrigin ||
    process.env.PUBLIC_APP_URL ||
    process.env.VITE_APP_URL ||
    PUBLIC_MESSENGER_ORIGIN
  ).replace(/\/$/, "");
}

export function productUrl(ctx: AgentContext, slug: string | null | undefined, productId: string) {
  const base = publicOrigin(ctx);
  const s = ctx.storeSlug || slug || "";
  return s
    ? `${base.replace(/\/$/, "")}/store/${s}/product/${productId}`
    : `${base}/product/${productId}`;
}

export function absoluteUrl(ctx: AgentContext, value: string | null | undefined) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  // Images always come from the main live site, which serves every store's
  // photos; merchant/preview hosts may not, leaving Messenger cards blank.
  const base = (process.env.PUBLIC_SITE_ORIGIN || "https://orzen.top").replace(/\/$/, "");
  const path = value.startsWith("/") ? value : `/api/img/${value.replace(/^\/+/, "")}`;
  return `${base}${path}`;
}

export function firstImage(ctx: AgentContext, product: any) {
  if (product.primary_image_url) return absoluteUrl(ctx, product.primary_image_url);
  const gallery = Array.isArray(product.gallery) ? product.gallery : [];
  return absoluteUrl(ctx, gallery.find(Boolean));
}

export const BANGLA_SEARCH_SYNONYMS: Record<string, string[]> = {
  ব্যাগ: ["bag", "school bag", "backpack"],
  মানিব্যাগ: ["wallet", "money bag", "moneybag", "purse"],
  ওয়ালেট: ["wallet"],
  পার্স: ["purse", "wallet"],
  স্কুল: ["school"],
  কলম: ["pen"],
  পেন: ["pen"],
  বই: ["book"],
  জুতা: ["shoe", "shoes", "sandal"],
  ঘড়ি: ["watch", "clock"],
  কাপড়: ["cloth", "dress", "shirt"],
  ড্রেস: ["dress"],
  শার্ট: ["shirt"],
  প্যান্ট: ["pant", "trouser"],
  ফোন: ["phone", "mobile"],
  মোবাইল: ["mobile", "phone"],
  চার্জার: ["charger"],
  হেডফোন: ["headphone", "earphone"],
  ইয়ারফোন: ["earphone", "headphone"],
  প্রজেক্টর: ["projector"],
  বেডশিট: ["bedsheet", "bed sheet"],
  ফ্যান: ["fan"],
  লাইট: ["light"],
};

export const PRODUCT_STOPWORDS = new Set([
  "this",
  "that",
  "these",
  "those",
  "show",
  "give",
  "send",
  "photo",
  "image",
  "picture",
  "pic",
  "please",
  "price",
  "details",
  "hi",
  "hai",
  "hey",
  "hii",
  "hiii",
  "yo",
  "sup",
  "ok",
  "okay",
  "hmm",
  "hello",
  "helo",
  "news",
  "status",
  "you",
  "your",
  "how",
  "are",
  "এটা",
  "এইটা",
  "ওটা",
  "এই",
  "ওই",
  "এর",
  "টার",
  "একটা",
  "একটি",
  "ছবি",
  "দাও",
  "দেন",
  "দেখাও",
  "দেখান",
  "কি",
  "কী",
  "আছে",
  "দাম",
  "কত",
  "ডিটেইলস",
  "বিস্তারিত",
  "প্লিজ",
  "আমাদের",
  "আপনাদের",
  "তুমি",
  "তোমার",
  "আপনি",
  "আপনার",
  "খবর",
  "অবস্থা",
  "কেমন",
  "ভালো",
  "আছেন",
  "আছো",
  "হাই",
  "হ্যালো",
  "হেলো",
  "হি",
  "হেই",
  "হ্যা",
  "হ্যাঁ",
  "হুম",
  "হুঁ",
  "আচ্ছা",
  "ওহে",
  "ইয়ো",
  "ওকে",
  "সালাম",
]);

export function searchTerms(raw: string) {
  const compact = raw.toLowerCase().replace(/[.,!?;:()\[\]{}"'`~|/\\]+/g, " ");
  const terms = new Set<string>();
  for (const token of compact
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)) {
    const variants = new Set(
      [token, token.replace(/(ের|এর|টি|টা|গুলো|গুলি|গুলোতে|গুলোর|টার|টির)$/u, "")].filter(Boolean),
    );
    for (const variant of variants) {
      // Require ≥3 chars: prevents short greetings/particles like "হি", "হে",
      // "hi", "ok" from being treated as product keywords and hallucinating a focus product.
      if (variant.length < 3 || PRODUCT_STOPWORDS.has(variant)) continue;
      terms.add(variant);
      for (const synonym of BANGLA_SEARCH_SYNONYMS[variant] ?? []) terms.add(synonym.toLowerCase());
    }
  }

  for (const [bn, synonyms] of Object.entries(BANGLA_SEARCH_SYNONYMS)) {
    if (compact.includes(bn)) synonyms.forEach((s) => terms.add(s.toLowerCase()));
  }
  return Array.from(terms);
}

export function isBroadBrowseQuery(raw: string) {
  return /প্রোডাক্ট|পণ্য|কি আছে|কী আছে|দেখান|দেখাও|সব|নতুন|বেস্ট|best|new|popular|product|products|items|show|browse|catalog/i.test(
    raw,
  );
}

export function stringifyProductField(value: any): string {
  if (!value) return "";
  if (Array.isArray(value)) return value.map(stringifyProductField).join(" ");
  if (typeof value === "object") return Object.values(value).map(stringifyProductField).join(" ");
  return String(value);
}

export type ProductKind = "physical" | "digital" | "service" | "subscription";

export function productKind(product: any): ProductKind {
  const t = String(product?.product_type ?? "physical").toLowerCase();
  return t === "digital" || t === "service" || t === "subscription"
    ? (t as ProductKind)
    : "physical";
}

/** Only physical products may be ordered inside Messenger. */
export function isMessengerOrderable(product: any) {
  return productKind(product) === "physical";
}

export function subscriptionBilling(product: any) {
  const meta = (product?.meta ?? {}) as any;
  const sub = meta?.subscription ?? null;
  if (!sub || typeof sub !== "object") return null;
  return {
    billing_interval: sub.interval ?? sub.billing_interval ?? sub.cycle ?? null,
    trial_days: sub.trial_days ?? null,
    benefits: sub.benefits ?? sub.features ?? null,
    included: sub.included ?? null,
  };
}

export function productSummary(ctx: AgentContext, product: any, categoryName?: string | null) {
  const kind = productKind(product);
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    product_type: kind,
    purchase_channel: kind === "physical" ? "messenger" : "website",
    ...(kind === "subscription" ? { subscription: subscriptionBilling(product) } : {}),
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
    gallery: Array.isArray(product.gallery)
      ? product.gallery.map((img: string) => absoluteUrl(ctx, img)).filter(Boolean)
      : [],
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

/** Lean search result: cards/links re-fetch full data by id, so the model only
 *  needs enough to pick and answer (keeps tool results ~10x smaller). */
export function compactSummary(ctx: AgentContext, product: any, categoryName?: string | null) {
  const kind = productKind(product);
  const variants = Array.isArray(product.variants)
    ? product.variants.map((v: any) => v?.label || v?.name).filter(Boolean).slice(0, 10)
    : [];
  return {
    id: product.id,
    name: product.name,
    product_type: kind,
    purchase_channel: kind === "physical" ? "messenger" : "website",
    category_name: categoryName ?? null,
    price: product.price,
    old_price: product.old_price,
    stock: product.stock,
    short_description: String(product.short_description ?? "").slice(0, 140) || undefined,
    variants: variants.length ? variants : undefined,
    image_url: firstImage(ctx, product),
  };
}

/** Store-admin configured Buy Now / order collection flow. */
export async function loadOrderFlow(storeId: string) {
  const sb = admin();
  const { data } = await sb
    .from("store_ai_agents")
    .select("order_flow")
    .eq("store_id", storeId)
    .maybeSingle();
  return normalizeOrderFlow((data as any)?.order_flow);
}

/** Payment methods a Messenger order may use for this store. */
export async function loadMessengerPaymentMethods(storeId: string) {
  const sb = admin();
  const { data } = await sb
    .from("stores")
    .select("payments_config")
    .eq("id", storeId)
    .maybeSingle();
  return messengerPaymentMethods((data as any)?.payments_config);
}

export async function getConversationSlot(conversationId: string): Promise<Record<string, any>> {
  const sb = admin();
  const { data } = await sb
    .from("ai_conversations")
    .select("psid_profile")
    .eq("id", conversationId)
    .maybeSingle();
  const profile = (data?.psid_profile ?? {}) as Record<string, any>;
  const { sanitizeSlot } = await import("./slot-validate");
  const { slot, dropped } = sanitizeSlot((profile.pending_order ?? {}) as Record<string, any>);
  if (dropped.length) {
    await sb.from("ai_conversations").update({ psid_profile: { ...profile, pending_order: slot } } as any).eq("id", conversationId);
  }
  return slot;
}

export async function updateConversationSlot(conversationId: string, patch: Record<string, any>) {
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

export async function clearConversationSlot(conversationId: string) {
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

export function normalizePhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("8801") && digits.length === 13) return `0${digits.slice(3)}`;
  if (digits.startsWith("01") && digits.length === 11) return digits;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export async function blockDuplicateMessengerToolOrder(opts: {
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

export const DEICTIC_TOKENS = [
  "this",
  "that",
  "it",
  "এটা",
  "এইটা",
  "ওটা",
  "ওইটা",
  "এই",
  "ওই",
  "সেই",
  "সেটা",
];

export const PRODUCT_SELECT_MIN =
  "product_id,name,slug,brand,product_code,sku,category_id,short_description,description,specifications,price,old_price,stock,status,product_type,meta,primary_image_url,gallery,features,variants,total_sold,rating,is_featured";

/** Short message that continues the conversation about the last product
 *  (no other product named). Pure — exposed for tests. */
export function isShortFollowUp(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t || t.length > 80) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 8) return false;
  // pure greetings / thanks are not product follow-ups
  if (/^(hi|hello|hey|salam|slm|আসসালাম|সালাম|হাই|হ্যালো|ধন্যবাদ|thanks|thank you|ok|okay|ওকে|হুম|জি|hmm)[\s!.?।]*$/i.test(t)) return false;
  return true;
}

export function normalizeCatalogProduct<T extends { product_id: string; source_created_at?: string }>(product: T) {
  const { product_id, source_created_at, ...rest } = product;
  return { ...rest, id: product_id, created_at: source_created_at };
}

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
    name,
    brand,
    sku,
    code,
    String(product.short_description ?? "").toLowerCase(),
    String(product.description ?? "").toLowerCase(),
    stringifyProductField(product.features).toLowerCase(),
    stringifyProductField(product.specifications).toLowerCase(),
    stringifyProductField(product.variants).toLowerCase(),
  ].join(" ");
  let score = 0;
  const p = phrase.toLowerCase().trim();
  if (p && name === p) score += 200; // exact name match wins
  if (p && name && name.includes(p) && p.length >= 3) score += 100;
  if (p && haystack.includes(p) && p.length >= 3) score += 40;
  for (const t of terms) {
    if (!t) continue;
    if (sku && sku === t) score += 150; // exact SKU
    if (code && code === t) score += 150; // exact product code
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
  const compact = raw.toLowerCase();
  const hasDeictic = DEICTIC_TOKENS.some((t) => compact.includes(t.toLowerCase()));
  const followUp = !hasDeictic && !!opts.conversationId && isShortFollowUp(raw) && !isBroadBrowseQuery(raw);
  if (!hasDeictic && !followUp && !isBroadBrowseQuery(raw) && searchTerms(raw).length === 0) {
    return { product: null, ambiguous: false, candidates: [] };
  }
  const sb = admin();

  // Elliptical follow-up ("কি ফুলের?", "খাঁটি তো?") → the product card sent in
  // the last 2 hours of this conversation, unless the message clearly names
  // a different product (checked after scoring below).
  let recentFocus: any = null;
  if (followUp) {
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: recs } = await sb
      .from("ai_product_recommendations")
      .select("product_id,created_at")
      .eq("store_id", opts.storeId)
      .eq("conversation_id", opts.conversationId!)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);
    const id = (recs ?? [])[0]?.product_id;
    if (id) {
      const { data: p } = await sb
        .from("ai_product_catalog")
        .select(PRODUCT_SELECT_MIN)
        .eq("store_id", opts.storeId)
        .eq("product_id", id)
        .eq("status", "active")
        .maybeSingle();
      if (p) recentFocus = normalizeCatalogProduct(p as any);
    }
  }
  const pinRecent = (): FocusProduct => ({
    product: recentFocus,
    ambiguous: false,
    candidates: [],
    canonical_caption: canonicalCaption(recentFocus as any),
  });
  if (followUp && recentFocus && searchTerms(raw).length === 0) return pinRecent();

  // 1) Deictic reference ("this / এটা / ওইটা / it") → use the last recommended
  //    product in this conversation. Pin the most recent product card the agent sent.
  if (hasDeictic && opts.conversationId) {
    const { data: recs } = await sb
      .from("ai_product_recommendations")
      .select("product_id,created_at")
      .eq("store_id", opts.storeId)
      .eq("conversation_id", opts.conversationId)
      .order("created_at", { ascending: false })
      .limit(5);
    const ids = Array.from(new Set((recs ?? []).map((r: any) => r.product_id).filter(Boolean)));
    if (ids.length > 0) {
      const { data: p } = await sb
        .from("ai_product_catalog")
        .select(PRODUCT_SELECT_MIN)
        .eq("store_id", opts.storeId)
        .eq("product_id", ids[0])
        .eq("status", "active")
        .maybeSingle();
      if (p)
        return {
          product: normalizeCatalogProduct(p as any),
          ambiguous: false,
          candidates: [],
          canonical_caption: canonicalCaption(normalizeCatalogProduct(p as any) as any),
        };
    }
    // Multiple recent products → let the search branch below try to
    // disambiguate; if it also fails, we'll return ambiguous with these ids.
  }

  // 2) Search branch: score all active products against the message text.
  const terms = searchTerms(raw);
  if (!terms.length && !hasDeictic) return { product: null, ambiguous: false, candidates: [] };

  const { data: rows } = await sb
    .from("ai_product_catalog")
    .select(PRODUCT_SELECT_MIN)
    .eq("store_id", opts.storeId)
    .eq("status", "active")
    .limit(500);
  const { data: bl } = await sb
    .from("ai_product_blacklist")
    .select("product_id")
    .eq("store_id", opts.storeId);
  const blocked = new Set((bl ?? []).map((r: any) => r.product_id));

  const scored = (rows ?? []).map((row: any) => normalizeCatalogProduct(row))
    .filter((r: any) => !blocked.has(r.id))
    .map((r: any) => ({ product: r, score: scoreProductAgainstQuery(r, terms, raw) }))
    .filter((row) => row.score >= 25)
    .sort((a, b) => b.score - a.score);

  // Follow-up: keep the recent product unless the message clearly names
  // another product (a term appears in that product's name).
  if (recentFocus) {
    const top0 = scored[0]?.product;
    const namesOther =
      top0 && top0.id !== recentFocus.id &&
      terms.some((t) => t.length >= 3 && String(top0.name ?? "").toLowerCase().includes(t));
    if (!namesOther) return pinRecent();
  }

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
      const ids = Array.from(
        new Set((recs ?? []).map((r: any) => r.product_id).filter(Boolean)),
      ).slice(0, 4);
      if (ids.length >= 2) {
        const { data: prods } = await sb
          .from("ai_product_catalog")
          .select(PRODUCT_SELECT_MIN)
          .eq("store_id", opts.storeId)
          .in("product_id", ids);
        return {
          product: null,
          ambiguous: true,
          candidates: (prods ?? []).map((row: any) => {
            const p = normalizeCatalogProduct(row);
            return ({
            id: p.id,
            name: p.name,
            price: p.price,
            primary_image_url: p.primary_image_url,
          });}),
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
        id: row.product.id,
        name: row.product.name,
        price: row.product.price,
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


export function formatFocusVariants(v: any): string {
  const out = new Set<string>();
  const add = (x: any) => { const s = typeof x === "string" ? x : x?.label || x?.name || x?.value; if (s) out.add(String(s)); };
  if (Array.isArray(v)) v.forEach(add);
  else if (v && typeof v === "object") {
    for (const o of (Array.isArray(v.options) ? v.options : [])) {
      const vals = Array.isArray(o?.values) ? o.values : [];
      if (vals.length) out.add(`${o?.name ?? "option"}: ${vals.map((x: any) => (typeof x === "string" ? x : x?.label || x?.value)).filter(Boolean).join("/")}`);
    }
    if (!out.size && Array.isArray(v.items)) v.items.forEach(add);
  }
  return [...out].slice(0, 10).join(", ");
}
