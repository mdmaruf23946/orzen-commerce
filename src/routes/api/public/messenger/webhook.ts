import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildSystemPrompt, generateAgentReply, loadAiContext, resolveFocusProduct } from "@/lib/ai-agent.server";
import {
  sendProductCard,
  sendProductCarousel,
  type ProductCardInput,
} from "@/lib/messenger-send.server";
import { checkDuplicate } from "@/lib/duplicate-guard.server";

const PUBLIC_MESSENGER_ORIGIN = "https://orzen-commerce.lovable.app";
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
  if (value.startsWith("/api/img/")) return `${PUBLIC_MESSENGER_ORIGIN}${value}`;
  const clean = value.replace(/^\/+/, "");
  return `${PUBLIC_MESSENGER_ORIGIN}/api/img/${clean}`;
}

function productPageUrl(storeSlug: string | null | undefined, product: ProductRow) {
  const slug = storeSlug || "store";
  return `${PUBLIC_MESSENGER_ORIGIN}/store/${slug}/product/${product.id}`;
}

function firstProductImage(product: ProductRow) {
  if (product.primary_image_url) return publicImageUrl(product.primary_image_url);
  const gallery = Array.isArray(product.gallery) ? product.gallery : [];
  return publicImageUrl(gallery.find(Boolean));
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

function isGreetingIntent(text: string) {
  const compact = text.trim().toLowerCase();
  return /^(হাই|হাই+|হ্যালো|হেলো|hello|hi|hey|assalamu alaikum|আসসালামু আলাইকুম|সালাম|কেমন আছেন|তোমার কি খবর|কি খবর)[।!?.\s]*$/i.test(compact);
}

function isSmallTalkIntent(text: string) {
  return isGreetingIntent(text) || /^(তোমার|আপনার)?\s*(কি|কী)\s*খবর[।!?.\s]*$/i.test(text.trim()) || /(কেমন আছেন|কেমন আছো|কী অবস্থা|কি অবস্থা|how are you|what'?s up)/i.test(text.trim());
}

function smallTalkReply(text: string) {
  if (/আসসালামু|সালাম/i.test(text)) {
    return "ওয়ালাইকুম আসসালাম। আলহামদুলিল্লাহ ভালো আছি। আপনার কী প্রয়োজন বলুন, আমি সাহায্য করছি।";
  }
  return "আলহামদুলিল্লাহ ভালো আছি। আপনার কী খবর? এই মুহূর্তে কী প্রয়োজন বলুন, আমি সাহায্য করছি।";
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
    "id,name,slug,brand,product_code,sku,category_id,short_description,description,price,old_price,stock,primary_image_url,gallery,features,specifications,variants,total_sold,rating,is_featured";
  const [{ data: products }, { data: categories }, { data: blocked }] = await Promise.all([
    sb.from("products").select(productSelect).eq("store_id", storeId).eq("status", "active").gt("stock", 0).limit(150),
    sb.from("categories").select("id,name").eq("store_id", storeId),
    sb.from("ai_product_blacklist").select("product_id").eq("store_id", storeId),
  ]);
  const blockedIds = new Set((blocked ?? []).map((r: any) => r.product_id));
  const cats = new Map((categories ?? []).map((c: any) => [c.id, c.name]));
  const terms = productSearchTerms(text);
  const phrase = text.toLowerCase().trim();
  const scored = ((products ?? []) as ProductRow[])
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

function orderMissingFields(slot: Record<string, any>) {
  const missing: string[] = [];
  if (!slot.customer_name) missing.push("নাম");
  if (!slot.phone) missing.push("ফোন নম্বর");
  if (!slot.full_address) missing.push("সম্পূর্ণ ঠিকানা");
  if (!slot.payment_method) missing.push("পেমেন্ট মেথড (COD/bKash/Nagad)");
  return missing;
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

function parseOrderDetailsText(text: string) {
  const lines = text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const phone = extractPhone(text);
  const payment_method = normalizePaymentMethod(text);
  const qty = extractQty(text);

  const cleanedLines = lines
    .map((line) => (phone ? line.replace(/(?:\+?88[-\s]?)?01[3-9][\d\s-]{8,12}/g, "") : line).trim())
    .filter((line) => line && !isPaymentLine(line));

  let customer_name: string | undefined;
  let full_address: string | undefined;

  const nameMatch = text.match(/(?:^|\n|\b)(?:name|নাম)\s*[:：-]?\s*([^\n,;|]+)/i);
  if (nameMatch?.[1]) customer_name = nameMatch[1].trim();
  const addressMatch = text.match(/(?:address|ঠিকানা|এড্রেস)\s*[:：-]?\s*([^|]+)/i);
  if (addressMatch?.[1]) full_address = addressMatch[1].trim();

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

  const patch: Record<string, any> = {};
  if (customer_name) patch.customer_name = customer_name.slice(0, 120);
  if (phone) patch.phone = phone;
  if (full_address) patch.full_address = full_address.slice(0, 500);
  if (payment_method) patch.payment_method = payment_method;
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
  const missing = orderMissingFields(slot);
  if (!slot.product_id) missing.unshift("প্রোডাক্ট");
  if (missing.length) {
    await sendAndLogText(sb, token, psid, conversationId, `অর্ডার কনফার্ম করতে ${missing.join(", ")} দিন।`);
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
  const delivery = Number((product as any).delivery_charge ?? 0);
  const total = subtotal + delivery;
  const { data: invoiceNo } = await sb.rpc("generate_invoice_no", { _store_id: storeId } as any);
  const { data: order, error: orderError } = await sb
    .from("orders")
    .insert({
      store_id: storeId,
      customer_name: String(slot.customer_name).trim(),
      phone: normalizePhone(slot.phone) ?? String(slot.phone).trim(),
      address: String(slot.full_address).trim(),
      area: [slot.village, slot.union, slot.upazila, slot.district].filter(Boolean).join(", ") || null,
      payment_method: slot.payment_method,
      subtotal: total,
      delivery_amount: delivery,
      discount_amount: 0,
      status: "pending",
      invoice_no: invoiceNo || null,
      notes: "Placed via Messenger AI Sales Agent",
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

  const confirmation = [
    `আপনার অর্ডার কনফার্ম হয়েছে ✅`,
    `অর্ডার নম্বর: ${order.invoice_no || order.id}`,
    `প্রোডাক্ট: ${product.name} × ${qty}`,
    `মোট: ৳${total.toFixed(0)}`,
    `পেমেন্ট: ${String(slot.payment_method).toUpperCase()}`,
    "আমাদের টিম দ্রুত আপনার সাথে যোগাযোগ করবে।",
  ].join("\n");
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
  const slot = Object.keys(details).length
    ? await patchConversationPendingOrder(sb, conversationId, { ...current, ...details })
    : current;
  if (!slot.product_id) return false;
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


function productCardInput(storeSlug: string | null | undefined, product: ProductRow): ProductCardInput {
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

async function sendAndLogText(sb: ReturnType<typeof admin>, token: string, psid: string, conversationId: string, text: string) {
  try {
    const sent = await fbSend(token, psid, text);
    await logOutgoingText(sb, conversationId, text, sent.message_id ?? null);
    return true;
  } catch (e) {
    await logOutgoingText(sb, conversationId, text, null, (e as Error).message);
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
    const missing = orderMissingFields(slot);
    if (!missing.length) {
      await logProductRecommendations(sb, storeId, conversationId, [product], text);
      return finalizePendingMessengerOrder({ sb, storeId, conversationId, psid, token });
    }
    const textReply = missing.length
      ? `ঠিক আছে, ${product.name} অর্ডার শুরু করলাম। অর্ডার কনফার্ম করতে ${missing.join(", ")} দিন।`
      : `ঠিক আছে, ${product.name} অর্ডারের তথ্য পেয়েছি। কনফার্ম করার আগে আর কিছু যোগ করতে চান?`;
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
  await sendAndLogText(sb, token, psid, conversationId, intro);

  const cards = products.map((p) => productCardInput(storeSlug, p));
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

async function handleBuyPostback(opts: {
  sb: ReturnType<typeof admin>;
  storeId: string;
  conversationId: string;
  psid: string;
  token: string;
  payload: string;
}) {
  const { sb, storeId, conversationId, psid, token, payload } = opts;
  const productId = payload.replace(/^BUY_/, "");
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return false;
  const { data: product } = await sb
    .from("products")
    .select("id,name,stock,status")
    .eq("store_id", storeId)
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.status !== "active" || Number(product.stock) <= 0) {
    await sendAndLogText(sb, token, psid, conversationId, "দুঃখিত, এই প্রোডাক্টটি এখন স্টকে নেই। চাইলে কাছাকাছি অন্য প্রোডাক্ট দেখাতে পারি।");
    return true;
  }
  const current = await getConversationPendingOrder(sb, conversationId);
  const slot = await patchConversationPendingOrder(sb, conversationId, {
    ...current,
    product_id: product.id,
    qty: current.qty ?? 1,
  });
  const missing = orderMissingFields(slot);
  const reply = missing.length
    ? `ঠিক আছে, ${product.name} অর্ডার শুরু করলাম। কনফার্ম করতে ${missing.join(", ")} দিন।`
    : `ঠিক আছে, ${product.name} অর্ডারের তথ্য পেয়েছি। কনফার্ম করার আগে আর কিছু যোগ করতে চান?`;
  await sendAndLogText(
    sb,
    token,
    psid,
    conversationId,
    reply,
  );
  return true;
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
      `https://graph.facebook.com/v19.0/${encodeURIComponent(psid)}?fields=first_name,last_name,profile_pic,locale,timezone&access_token=${encodeURIComponent(token)}`,
    );
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
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

export const Route = createFileRoute("/api/public/messenger/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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
      },
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);
        if (!body || (body.object !== "page" && body.object !== "instagram")) {
          return new Response("ok");
        }
        const sb = admin();
        for (const entry of body.entry ?? []) {
          const pageId = String(entry.id);
          const { data: integ } = await sb
            .from("messenger_integrations")
            .select(
              "id,store_id,page_access_token,page_access_token_encrypted,ai_auto_reply,human_takeover,conversation_history,delivery_failures",
            )
            .eq("page_id", pageId)
            .maybeSingle();
          if (!integ) continue;
          const token =
            (await decryptToken((integ as any).page_access_token_encrypted)) ||
            (integ as any).page_access_token;

          // Handle standby events (log only)
          for (const _st of entry.standby ?? []) {
            // no-op, we don't have thread control
          }

          for (const ev of entry.messaging ?? []) {
            const senderId = ev.sender?.id;
            if (!senderId) continue;

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
                  ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null
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
              } else if (
                token &&
                (!conv.psid_profile || Object.keys(conv.psid_profile as any).length === 0)
              ) {
                const profile = await fetchPsidProfile(token, senderId);
                if (profile) {
                  await sb
                    .from("ai_conversations")
                    .update({
                      psid_profile: profile,
                      customer_name:
                        [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null,
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
              if (msg.mid) {
                const { data: existingMessage } = await sb
                  .from("ai_messages")
                  .select("id")
                  .eq("mid", msg.mid)
                  .maybeSingle();
                if (existingMessage) continue;
              }
              const parsed = parseMessage(msg);

              // Voice notes: transcribe upstream so the LLM sees text, not "[audio]".
              let effectiveText = parsed.text;
              if (parsed.message_type === "audio") {
                const audioUrl = (parsed.attachments?.[0]?.url as string) || "";
                const transcript = await transcribeAudioAttachment(audioUrl);
                if (transcript) effectiveText = transcript;
              }

              const preview = effectiveText.slice(0, 200) || `[${parsed.message_type}]`;

              await sb.from("ai_messages").insert({
                conversation_id: conv!.id,
                role: "user",
                direction: "in",
                message_type: parsed.message_type,
                content: effectiveText || preview,
                attachments: parsed.attachments,
                mid: msg.mid ?? null,
              });
              await sb
                .from("ai_conversations")
                .update({
                  last_message_at: new Date().toISOString(),
                  last_message_preview: preview,
                  unread_count: (conv!.unread_count ?? 0) + 1,
                })
                .eq("id", conv!.id);

              // AI reply gate
              const handoff = (conv as any)!.handoff_mode ?? "ai";
              if (handoff !== "ai") continue;
              if ((integ as any).human_takeover || (integ as any).ai_auto_reply === false) continue;
              if (!token) continue;
              // Only text-shaped inputs go to the LLM. Audio was transcribed above; other
              // attachments (image, sticker, file) fall through until vision is wired in.
              if (
                parsed.message_type !== "text" &&
                parsed.message_type !== "quick_reply" &&
                parsed.message_type !== "audio"
              ) continue;
              if (!effectiveText.trim()) continue;

              if (isSmallTalkIntent(effectiveText)) {
                await sendAndLogText(sb, token, senderId, conv!.id, smallTalkReply(effectiveText));
                await sb
                  .from("messenger_integrations")
                  .update({ last_error: null } as any)
                  .eq("id", (integ as any).id);
                continue;
              }

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

              const { store, agent, settings } = await loadAiContext(integ.store_id);

              const useHistory = (integ as any).conversation_history !== false;
              const history = useHistory
                ? (
                    await sb
                      .from("ai_messages")
                      .select("role,content,message_type")
                      .eq("conversation_id", conv!.id)
                      .in("message_type", ["text", "quick_reply", "postback", "audio"])
                      .order("created_at", { ascending: false })
                      .limit(30)
                  ).data ?? []
                : [];
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

              // Build conversation-state block so the model always sees what's already collected.
              const pending = await getConversationPendingOrder(sb, conv!.id);
              const { data: convStateRow } = await sb
                .from("ai_conversations")
                .select("psid_profile")
                .eq("id", conv!.id)
                .maybeSingle();
              const lastOrder = ((convStateRow as any)?.psid_profile as any)?.last_order ?? null;
              const { data: recentRecs } = await sb
                .from("ai_product_recommendations")
                .select("product_id")
                .eq("conversation_id", conv!.id)
                .order("created_at", { ascending: false })
                .limit(3);
              const recentIds = Array.from(
                new Set((recentRecs ?? []).map((r: any) => r.product_id).filter(Boolean)),
              );

              const focus = await resolveFocusProduct({
                storeId: integ.store_id,
                conversationId: conv!.id,
                text: effectiveText,
              });

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
                  state: { pending_order: pending, last_order: lastOrder, recent_product_ids: recentIds },
                  focus,
                  latestUserText: effectiveText,
                }),
                fast: true,
              });



              const replyText = sanitizeMessengerReply(reply ?? "", effectiveText);
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
              await sb
                .from("messenger_integrations")
                .update({ last_error: (e as Error).message } as any)
                .eq("id", (integ as any).id);
            }
          }
        }
        return new Response("ok");
      },
    },
  },
});
