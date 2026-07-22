import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildSystemPrompt, generateAgentReply, loadAiContext } from "@/lib/ai-agent.server";
import {
  sendProductCard,
  sendProductCarousel,
  type ProductCardInput,
} from "@/lib/messenger-send.server";

const PUBLIC_MESSENGER_ORIGIN = "https://orzen-commerce.lovable.app";
const PRODUCT_STOPWORDS = new Set([
  "this", "that", "these", "those", "show", "send", "photo", "image", "picture", "pic", "please", "price", "details", "do", "you", "have", "any",
  "এটা", "এইটা", "ওটা", "এই", "ওই", "এর", "টার", "একটা", "একটি", "ছবি", "দাও", "দেন", "দেখাও", "দেখান", "কি", "কী", "আছে", "দাম", "কত", "ডিটেইলস", "বিস্তারিত", "প্লিজ", "আমাদের", "আপনাদের", "তোমার", "কাছে", "হবে", "লাগবে",
]);
const PRODUCT_SYNONYMS: Record<string, string[]> = {
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
  return /প্রোডাক্ট|পণ্য|দেখান|দেখাও|কী আছে|কি আছে|দাম|কত|কিনতে|অর্ডার|product|item|price|buy|order|show/i.test(text);
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
  const explicitProductIntent = isProductIntent(text);
  if (!photoIntent && !explicitProductIntent && !terms.length) return false;

  let products = photoIntent
    ? await getRecentRecommendedProducts(sb, storeId, conversationId, 3)
    : [];
  if (!products.length) products = await searchDirectProducts(sb, storeId, text, 6);

  if (!products.length && !photoIntent && !explicitProductIntent) return false;

  if (!products.length) {
    const noResult = "দুঃখিত, এই মুহূর্তে এই প্রোডাক্টটি স্টকে পাচ্ছি না। অন্য কোনো প্রোডাক্ট খুঁজতে চাইলে নাম লিখুন।";
    await sendAndLogText(sb, token, psid, conversationId, noResult);
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
              const preview = parsed.text.slice(0, 200) || `[${parsed.message_type}]`;

              await sb.from("ai_messages").insert({
                conversation_id: conv!.id,
                role: "user",
                direction: "in",
                message_type: parsed.message_type,
                content: parsed.text || preview,
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
              if (parsed.message_type !== "text" && parsed.message_type !== "quick_reply") continue;

              const { data: storeRow } = await sb
                .from("stores")
                .select("slug")
                .eq("id", integ.store_id)
                .maybeSingle();

              const directHandled = await maybeSendDirectProductReply({
                sb,
                storeId: integ.store_id,
                storeSlug: (storeRow as any)?.slug,
                conversationId: conv!.id,
                psid: senderId,
                token,
                text: parsed.text,
              });
              if (directHandled) {
                await sb
                  .from("messenger_integrations")
                  .update({ last_error: null } as any)
                  .eq("id", (integ as any).id);
                continue;
              }

              const { store, agent } = await loadAiContext(integ.store_id);
              const useHistory = (integ as any).conversation_history !== false;
              const history = useHistory
                ? (
                    await sb
                      .from("ai_messages")
                      .select("role,content,message_type")
                      .eq("conversation_id", conv!.id)
                      .in("message_type", ["text", "quick_reply", "postback"])
                      .order("created_at", { ascending: true })
                      .limit(12)
                  ).data ?? []
                : [];
              const messages = history
                .filter((m: any) => m.role === "user" || m.role === "assistant")
                .map((m) => ({ role: m.role as any, content: m.content }));
              const reply = await generateAgentReply({
                ctx: {
                  storeId: integ.store_id,
                  storeSlug: (store as any).slug,
                  conversationId: conv!.id,
                  psid: senderId,
                  pageToken: token,
                },
                messages,
                system: buildSystemPrompt(store, agent),
                fast: true,
              });

              const replyText = (reply ?? "").trim();
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
