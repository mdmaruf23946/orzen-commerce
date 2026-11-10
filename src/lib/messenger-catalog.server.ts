// Extracted from the Messenger webhook; preserve existing channel behaviour.
import { getStoreMemory, recallByText } from "@/lib/catalog-memory.server";
import { sendProductCard, sendProductCarousel, type ProductCardInput } from "@/lib/messenger-send.server";
import { buildBuyNowMessage, fetchDeliveryZones } from "@/lib/chat-order-format";
import { productSearchTerms, isPhotoIntent, isProductIntent, isOrderStatusIntent, isOrderIntent, isReferenceIntent, isHowAreYouIntent, isGreetingIntent } from "./messenger-intents";
import { parseOrderDetailsText, looksLikeOrderDetails } from "./messenger-order-text";
import { type ProductRow, type ImageAnalysis, type VisualMatch } from "./messenger-types";
import { productPageUrl, firstProductImage } from "./messenger-product-helpers";
import { fbSend, fbSendImage, markQueuedReply, sendAndLogText } from "./messenger-transport.server";
import { getConversationPendingOrder, patchConversationPendingOrder, loadStoreOrderFlow, orderMissingFields, finalizePendingMessengerOrder, maybeBlockDuplicateMessengerOrder } from "./messenger-orders.server";
import type { MessengerClient } from "./messenger-client.server";

export async function searchDirectProducts(sb: MessengerClient, storeId: string, text: string, limit = 6) {
  const memory = await getStoreMemory(sb as any, storeId);
  // Bangla names ("মানিব্যাগ") are expanded with their English synonyms so
  // catalogue titles written in English still match. Store-scoped memory only.
  const query = Array.from(new Set([text, ...productSearchTerms(text)])).join(" ");
  return recallByText(memory, query, limit) as unknown as ProductRow[];
}

/** Short message that is only a product name — no question, order, detail or chit-chat. */
export function isNameOnlyProductQuery(text: string) {
  const t = text.trim();
  if (!t || t.length > 40 || t.includes("\n")) return false;
  if (t.split(/\s+/).length > 4) return false;
  if (/[?？]|\d{4,}/.test(t)) return false;
  if (isGreetingIntent(t) || isHowAreYouIntent(t) || /(^|\s)(অর্ডার|কিনতে|কিনব|নিতে|নিব|নেব|নিবো|buy|order|purchase|checkout)(\s|$)/i.test(t) || isOrderStatusIntent(t) || isPhotoIntent(t)) return false;
  if (/দাম|কত|কেমন|কি |কী |কোন|কেন|ডেলিভারি|delivery|চার্জ|charge|সাইজ|size|কালার|color|colour|রং|ওয়ারেন্টি|warranty|অরিজিনাল|original|ভালো|ঠিক আছে|ধন্যবাদ/i.test(t) || /\b(price|how|what|which|why|ok|okay|thanks?)\b/i.test(t)) return false;
  return productSearchTerms(t).length > 0;
}

export async function getRecentRecommendedProducts(sb: MessengerClient, storeId: string, conversationId: string, limit = 5) {
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

/** "টিসার্ট কছে?" → "টিসার্ট": drop a trailing availability ask so the name fast path can run. */
export function availabilityStripped(text: string) {
  return text
    .trim()
    .replace(/[?？!।.\s]+$/u, "")
    .replace(/\s+(আছে|আসে|কছে|কাছে|এছে|আছ|ache|ase|ase ki|ache ki)(\s*(কি|কী|কিনা|ki|kina))?$/iu, "")
    .trim();
}

export function friendlyItemName(a: ImageAnalysis): string {
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

export async function sendVisualProductResult(opts: {
  sb: MessengerClient;
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
    await Promise.all([
      markQueuedReply(sb, queuedJobId, text, sent.message_id),
      sb.from("ai_messages").insert({
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
      } as any),
    ]);
    return;
  }

  // Speed: the customer only waits for the card itself. Building the card and
  // logging the recommendation happen together, and the follow-up line plus the
  // two conversation records are written while the card is already on its way.
  const [card] = await Promise.all([
    productCardInput(storeSlug, match.product, storeId, psid),
    logProductRecommendations(sb, storeId, conversationId, [match.product], `image:${sourceMid ?? "unknown"}`)
      .catch(() => undefined),
  ]);
  const cardSent = await sendProductCard(token, psid, card);
  const askList = [
    "জি, এটা আমাদের কাছে আছে 😊 নিতে চাইলে বলুন, অর্ডার করে দিচ্ছি।",
    "পেয়ে গেছি! এটাই তো আমাদের এই প্রোডাক্টটা। নিবেন?",
    "হ্যাঁ, এটা আমাদের কাছে পাওয়া যাচ্ছে। অর্ডার করতে চাইলে জানান 😊",
  ];
  const text = askList[Math.floor(Math.random() * askList.length)];
  // Ordering happens through the card's own "Buy Now" postback button, so no
  // separate quick reply is attached below the message.
  const [sent] = await Promise.all([
    fbSend(token, psid, text),
    sb.from("ai_messages").insert({
      conversation_id: conversationId, role: "assistant", direction: "out", message_type: "product_card",
      content: `[card] ${card.title}`,
      attachments: [{ type: "product_card", product_id: match.product.id, element: card, in_reply_to_mid: sourceMid }],
      mid: cardSent.message_id ?? null, delivery_status: "sent",
    } as any),
  ]);
  await Promise.all([
    markQueuedReply(sb, queuedJobId, text, sent.message_id),
    sb.from("ai_messages").insert({
      conversation_id: conversationId, role: "assistant", direction: "out", message_type: "text",
      content: text,
      attachments: [{ in_reply_to_mid: sourceMid, product_id: match.product.id, visual_match_confidence: match.confidence, match_verdict: match.verdict }],
      mid: sent.message_id ?? null, delivery_status: "sent",
    } as any),
  ]);
}

export async function productCardInput(
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

export async function logProductRecommendations(sb: MessengerClient, storeId: string, conversationId: string, products: ProductRow[], context: string) {
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

export async function sendCatalogBrowseReply(opts: {
  sb: MessengerClient;
  storeId: string;
  conversationId: string;
  psid: string;
  token: string;
}) {
  const { sb, storeId, conversationId, psid, token } = opts;
  const cols = "id,name,slug,brand,product_code,sku,category_id,short_description,description,price,old_price,stock,primary_image_url,gallery,features,specifications,variants,total_sold,rating,is_featured";
  const [{ data: prods }, { data: slugRow }, { data: cats }] = await Promise.all([
    sb.from("products").select(cols).eq("store_id", storeId).eq("status", "active").gt("stock", 0)
      .order("is_featured", { ascending: false }).order("total_sold", { ascending: false, nullsFirst: false }).limit(4),
    sb.from("stores").select("slug").eq("id", storeId).maybeSingle(),
    sb.from("categories").select("name").eq("store_id", storeId).limit(6),
  ]);
  const products = (prods ?? []) as ProductRow[];
  if (!products.length) return false;
  await sendAndLogText(sb, token, psid, conversationId, "জি, আমাদের জনপ্রিয় কিছু প্রোডাক্ট দেখুন 😊", { hasCard: true });
  const storeSlug = (slugRow as any)?.slug ?? null;
  const cards = await Promise.all(products.map((p) => productCardInput(storeSlug, p, storeId, psid)));
  const result = cards.length === 1 ? await sendProductCard(token, psid, cards[0]) : await sendProductCarousel(token, psid, cards);
  await sb.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    direction: "out",
    message_type: cards.length === 1 ? "product_card" : "product_carousel",
    content: `[carousel] ${cards.length} products`,
    attachments: cards.map((card, i) => ({ type: "product_card", product_id: products[i].id, element: card })),
    mid: result.message_id ?? null,
    delivery_status: "sent",
  } as any);
  await logProductRecommendations(sb, storeId, conversationId, products, "catalog browse");
  const names = ((cats ?? []) as any[]).map((c) => c.name).filter(Boolean).slice(0, 5);
  const follow = names.length
    ? `আমাদের আরও কালেকশন আছে: ${names.join(", ")}। কোনটি দেখতে চান, অথবা প্রোডাক্টের নাম লিখুন — খুঁজে দিচ্ছি।`
    : "আরও প্রোডাক্ট আছে। আপনার পছন্দের প্রোডাক্টের নাম লিখুন — খুঁজে দিচ্ছি।";
  await sendAndLogText(sb, token, psid, conversationId, follow);
  return true;
}

export async function maybeSendDirectProductReply(opts: {
  sb: MessengerClient;
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
      missing,
      known: slot,
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
