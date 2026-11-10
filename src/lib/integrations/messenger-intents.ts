// Pure Messenger text-intent helpers (split from messenger-webhook.server.ts).
import { customerTexts } from "@/lib/agents/customer-style";
import { guardConversation, resolveHandoff } from "@/lib/agents/conversation-guard.server";
import { traceTime, setTraceMeta, currentTrace } from "@/lib/telemetry.server";
import { firstSighting, forget } from "@/lib/integrations/mid-dedupe";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildSystemPrompt, generateAgentReply, loadAiContext, resolveFocusProduct } from "@/lib/agents/ai-agent.server";
import { routedChatCompletion, routedTranscribeAudio, routedVisionText } from "@/lib/agents/ai-provider.server";
import { getStoreMemory, recallByText } from "@/lib/agents/catalog-memory.server";
import {
  sendProductCard,
  sendProductCarousel,
  sendQuickReplies,
  sendText,
  sendViewSiteButton,
  type ProductCardInput,
} from "@/lib/integrations/messenger-send.server";
import { checkDuplicate } from "@/lib/orders/duplicate-guard.server";
import { sanitizeOutgoingText, type PayloadFacts } from "@/lib/integrations/messenger-text";
import {
  normalizeOrderFlow,
  renderConfirmation,
  requiredSlotFields,
  type OrderFlowConfig,
} from "@/lib/integrations/messenger-order-flow";
import {
  buildBuyNowMessage,
  buildMissingFieldsMessage,
  fetchDeliveryZones,
  money,
  orderStatusBn,
  resolveDeliveryCharge,
  shortOrderNo,
  toBnDigits,
} from "@/lib/orders/chat-order-format";
import {
  checkPersonName,
  cleanNameValue,
  isAffirmative,
  isLikelyAddress,
  isNegative,
  looksLikeQuestion,
  sanitizeSlot,
} from "@/lib/agents/slot-validate";
import { isDeliveryChargeQuestion } from "@/lib/text-normalize";
import { isCatalogBrowseIntent } from "@/lib/agents/catalog-browse-intent";


export const PRODUCT_STOPWORDS = new Set([
  "this", "that", "these", "those", "show", "send", "photo", "image", "picture", "pic", "please", "price", "details", "do", "you", "have", "any",
  "এটা", "এইটা", "ওটা", "এই", "ওই", "এর", "টার", "একটা", "একটি", "ছবি", "দাও", "দেন", "দেখাও", "দেখান", "কি", "কী", "আছে", "দাম", "কত", "ডিটেইলস", "বিস্তারিত", "প্লিজ", "আমাদের", "আপনাদের", "তোমার", "কাছে", "হবে", "লাগবে",
]);
export const PRODUCT_SYNONYMS: Record<string, string[]> = {
  "টিসার্ট": ["t-shirt", "tshirt", "টি-শার্ট", "shirt"],
  "টিশার্ট": ["t-shirt", "tshirt", "টি-শার্ট", "shirt"],
  "টি-শার্ট": ["t-shirt", "tshirt", "shirt"],
  "টি-সার্ট": ["t-shirt", "tshirt", "টি-শার্ট", "shirt"],
  "tshirt": ["t-shirt", "টি-শার্ট", "shirt"],
  "t-shirt": ["tshirt", "টি-শার্ট", "shirt"],
  "গেঞ্জি": ["t-shirt", "টি-শার্ট", "tshirt"],
  "সার্ট": ["shirt", "শার্ট"],
  "মানিব্যাগ": ["wallet", "purse", "money bag"],
  "ওয়ালেট": ["wallet"],
  "পার্স": ["purse", "wallet"],
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


export function stringifyField(value: unknown): string {
  if (!value) return "";
  if (Array.isArray(value)) return value.map(stringifyField).join(" ");
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).map(stringifyField).join(" ");
  return String(value);
}

export function productSearchTerms(raw: string) {
  const compact = raw.toLowerCase().replace(/[.,!?;:()\[\]{}"'`~|/\\]+/g, " ");
  const terms = new Set<string>();
  for (const token of compact.split(/\s+/).map((t) => t.trim()).filter(Boolean)) {
    if (token.length < 2 || PRODUCT_STOPWORDS.has(token)) continue;
    terms.add(token);
    for (const synonym of PRODUCT_SYNONYMS[token] ?? []) terms.add(synonym.toLowerCase());
  }
  // Longest names first, and consume them: "মানিব্যাগ" must not also match "ব্যাগ".
  let rest = compact;
  for (const [bn, synonyms] of Object.entries(PRODUCT_SYNONYMS).sort((a, b) => b[0].length - a[0].length)) {
    if (rest.includes(bn)) {
      terms.add(bn);
      synonyms.forEach((s) => terms.add(s.toLowerCase()));
      rest = rest.split(bn).join(" ");
    }
  }
  if (compact.includes("মানিব্যাগ")) ["ব্যাগ", "bag", "school bag", "backpack"].forEach((t) => terms.delete(t));
  return Array.from(terms);
}

export function isPhotoIntent(text: string) {
  return /ছবি|ফটো|ইমেজ|photo|image|picture|pic/i.test(text);
}

export function isProductIntent(text: string) {
  return /প্রোডাক্ট|পণ্য|দেখান|দেখাও|কী আছে|কি আছে|দাম|কত|বিস্তারিত|ডিটেইলস|product|item|price|show|details/i.test(text);
}

export function isOrderStatusIntent(text: string) {
  // Tracking, status, cancel, return, refund — must be handled by the AI agent (trackOrder tool), not the buy flow.
  return /(where.*(is|are).*(my )?order|track.*order|order.*(status|track)|cancel.*order|return.*order|refund|when.*(arrive|deliver|get)|(order|parcel|percel).{0,15}(koi|kothay|kobe|kokhon|pabo|ashbe|asbe|pathaisen|pathiyechen)|(অর্ডার|অডার|পার্সেল|পারসেল|প্রোডাক্ট|জিনিস|মাল).{0,20}(কোথায়|কই|কবে|কখন|পাব|পাবো|আসবে|আসবো|পাঠা|পাঠানো|ডেলিভারি|খবর|অবস্থা|আপডেট|ট্র্যাক|ট্রাক|স্ট্যাটাস|স্টেটাস|status)|(কবে|কখন).{0,12}(পাব|পাবো|আসবে|ডেলিভারি)|ডেলিভারি (হয়েছে|হইছে|হবে কবে|কবে)|অর্ডার (বাতিল|ক্যান্সেল|cancel)|রিটার্ন|ফেরত)/i.test(text);
}

export function isOrderIntent(text: string) {
  if (isOrderStatusIntent(text)) return false;
  // Bangla verbs need word edges: "মানিব্যাগ" contains "নিব" but is a product.
  return /অর্ডার|কিনতে|নিতে চাই|(^|\s)(নিব|নেব|নিবো|নেবো)(\s|$|[।!?])|buy now|buy|order|purchase|checkout/i.test(text);
}

export function isReferenceIntent(text: string) {
  return /এটা|এইটা|ওটা|এই|ওই|this|that|it|same/i.test(text);
}

/** True only when the person actually asked about our wellbeing. */
export function isHowAreYouIntent(text: string) {
  const compact = text.trim().toLowerCase().replace(/[।!?.,\s]+$/u, "");
  return /(কেমন আছেন|কেমন আছো|কেমন আছিস|কি অবস্থা|কী অবস্থা|কি খবর|কী খবর|how are you|how r u|how'?s it going|what'?s up|whats up)/i.test(
    compact,
  );
}

export function isSalamIntent(text: string) {
  return /(আসসালামু|আসসালাম|সালাম|assalam|salam)/i.test(text);
}

export function isGreetingIntent(text: string) {
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

export function isSmallTalkIntent(text: string) {
  return isGreetingIntent(text) || isHowAreYouIntent(text);
}

/** The reply must match what was actually said — never volunteer "ভালো আছি" for a plain "হেই". */
export function smallTalkReply(text: string) {
  const salam = isSalamIntent(text);
  const asked = isHowAreYouIntent(text);
  if (salam && asked) return "ওয়ালাইকুম আসসালাম। আলহামদুলিল্লাহ ভালো আছি। বলুন, কীভাবে সাহায্য করতে পারি?";
  if (salam) return "ওয়ালাইকুম আসসালাম। বলুন, কীভাবে সাহায্য করতে পারি?";
  if (asked) return "আলহামদুলিল্লাহ ভালো আছি, ধন্যবাদ। বলুন, কীভাবে সাহায্য করতে পারি?";
  return "হ্যালো! বলুন, কীভাবে সাহায্য করতে পারি?";
}

export function sanitizeMessengerReply(reply: string, latestText: string) {
  const text = reply.trim();
  if (!text) return text;
  // Only replace replies that leak internal identifiers — word-bounded so
  // normal Bangla/English text is never swallowed.
  if (/\b(productId|product_id|must_use_focus_product|focusProductId|undefined|null)\b/.test(text)) {
    const cleaned = text
      .split(/\n+/)
      .filter((l) => !/\b(productId|product_id|must_use_focus_product|focusProductId|undefined|null)\b/.test(l))
      .join("\n")
      .trim();
    if (cleaned.length >= 8) return cleaned;
    if (isSmallTalkIntent(latestText)) return smallTalkReply(latestText);
    return "দুঃখিত, আপনার কথাটা বুঝেছি—কোন প্রোডাক্টটি চান সেটার নাম আরেকবার লিখলে আমি ঠিকভাবে ছবিসহ দেখাচ্ছি।";
  }
  return text;
}

// Answers from the store's memorised catalogue (see catalog-memory.server.ts):
// no per-message full-table read, no AI call — an in-memory index lookup.
