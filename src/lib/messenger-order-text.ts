// Messenger order-detail text parsing (split from messenger-webhook.server.ts).
import { customerTexts } from "@/lib/agents/customer-style";
import { guardConversation, resolveHandoff } from "./conversation-guard.server";
import { traceTime, setTraceMeta, currentTrace } from "./telemetry.server";
import { firstSighting, forget } from "./mid-dedupe";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildSystemPrompt, generateAgentReply, loadAiContext, resolveFocusProduct } from "@/lib/ai-agent.server";
import { routedChatCompletion, routedTranscribeAudio, routedVisionText } from "@/lib/ai-provider.server";
import { getStoreMemory, recallByText } from "@/lib/catalog-memory.server";
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
  orderStatusBn,
  resolveDeliveryCharge,
  shortOrderNo,
  toBnDigits,
} from "@/lib/chat-order-format";
import {
  checkPersonName,
  cleanNameValue,
  isAffirmative,
  isLikelyAddress,
  isNegative,
  looksLikeQuestion,
  sanitizeSlot,
} from "@/lib/slot-validate";
import { isDeliveryChargeQuestion } from "@/lib/text-normalize";
import { isCatalogBrowseIntent } from "@/lib/catalog-browse-intent";


export function normalizePhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("8801") && digits.length === 13) return `0${digits.slice(3)}`;
  if (digits.startsWith("01") && digits.length === 11) return digits;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function extractPhone(text: string) {
  const bdMatch = text.match(/(?:\+?88[-\s]?)?01[3-9][\d\s-]{8,12}/);
  if (bdMatch) return normalizePhone(bdMatch[0]);
  const generic = text.match(/\+?\d[\d\s-]{7,18}\d/);
  return generic ? normalizePhone(generic[0]) : null;
}

export function normalizePaymentMethod(text: string) {
  const compact = text.toLowerCase();
  if (/\bcod\b|cash\s*on\s*delivery|cash|ক্যাশ|ডেলিভারিতে|হাতে টাকা|ক্যাশ অন ডেলিভারি/i.test(compact)) return "cod";
  if (/bkash|b-kash|বিকাশ/i.test(compact)) return "bkash";
  if (/nagad|নগদ/i.test(compact)) return "nagad";
  if (/rocket|রকেট/i.test(compact)) return "rocket";
  if (/bank|ব্যাংক/i.test(compact)) return "bank";
  return null;
}

export function extractQty(text: string) {
  const match = text.match(/(?:qty|quantity|পরিমাণ)\s*[:：-]?\s*(\d{1,2})|\b(\d{1,2})\s*(?:pcs|pieces|piece|পিস|টা|টি)\b/i);
  const qty = match ? Number(match[1] ?? match[2]) : null;
  return qty && qty > 0 && qty <= 99 ? qty : null;
}

export function isPaymentLine(line: string) {
  return !!normalizePaymentMethod(line) && line.trim().replace(/[\s.,।-]+/g, "").length <= 24;
}

export function extractEmail(text: string) {
  const m = String(text ?? "").match(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/);
  return m ? m[0].toLowerCase().slice(0, 160) : null;
}

/** Strip a leading serial marker like "1." / "১)" / "৩-" from a line. */
export const SERIAL_RE = /^\s*[(\[]?[\d০-৯]{1,2}\s*[).:\-–।]\s*/;

export function stripSerial(line: string) {
  return line.replace(SERIAL_RE, "").trim();
}

export type ParseCtx = {
  /** We asked this customer for their name (Buy Now started, name still missing). */
  awaitingName?: boolean;
  /** We asked this customer for their address. */
  awaitingAddress?: boolean;
};

export function parseOrderDetailsText(text: string, ctx: ParseCtx = {}) {
  return parseOrderDetailsTextEx(text, ctx).patch;
}

/**
 * Pull order details out of a customer message. A name or address is taken
 * ONLY when it is clearly labelled, part of a numbered answer, or we asked for
 * it — and it must pass the name/address checks. Questions, greetings and
 * product talk are never stored ("ডেলিভারি সার্চ কত" is not a name).
 * `leftover` = text we could not place while waiting for details (for the AI
 * understanding step).
 */
export function parseOrderDetailsTextEx(text: string, ctx: ParseCtx = {}) {
  const rawLines = text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const phone = extractPhone(text);
  const email = extractEmail(text);
  const qty = extractQty(text);
  const detailsMessage = looksLikeOrderDetails(text);
  const mayTakeName = !!ctx.awaitingName || detailsMessage;
  const mayTakeFreeAddress = !!ctx.awaitingAddress || detailsMessage;

  const nameOk = (v?: string | null) => {
    const c = cleanNameValue(v);
    return c && checkPersonName(c).ok ? c : undefined;
  };
  const addressOk = (v?: string | null, lenient = false) => {
    const a = String(v ?? "").trim();
    return a && isLikelyAddress(a, { lenient }) ? a : undefined;
  };

  const patch: Record<string, any> = {};

  // Customers answer the numbered prompt: 1) name 2) phone 3) email 4) address 5) note
  const serialLines = rawLines.filter((l) => SERIAL_RE.test(l));
  if (serialLines.length >= 2) {
    const parts = serialLines.map(stripSerial).filter(Boolean);
    const [p1, p2, p3, p4, p5] = parts;
    const nonPhone = (v?: string) => (v && !extractPhone(v) && !extractEmail(v) ? v : undefined);
    const name = nameOk(nonPhone(p1));
    if (name) patch.customer_name = name.slice(0, 120);
    const addressCandidates = [p4, p5, p3]
      .filter((v): v is string => !!v && !extractPhone(v) && !extractEmail(v))
      .filter((v) => v !== p1)
      .filter((v) => !!addressOk(v, true));
    if (addressCandidates.length) patch.full_address = addressCandidates[0]!.slice(0, 500);
    const note = p5 && p5 !== patch.full_address && !extractEmail(p5) && !extractPhone(p5) ? p5 : null;
    if (note) patch.note = note.slice(0, 300);
    if (!patch.full_address && p2 && !extractPhone(p2) && addressOk(p2, true)) patch.full_address = p2.slice(0, 500);
  }

  const cleanedLines = rawLines
    .map((line) => stripSerial(line))
    .map((line) => (phone ? line.replace(/(?:\+?88[-\s]?)?01[3-9][\d\s-]{8,12}/g, "") : line))
    .map((line) => (email ? line.replace(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/g, "") : line))
    .map((line) => line.replace(/^[\s,;:|.-]+|[\s,;:|-]+$/g, "").trim())
    .filter((line) => line && !isPaymentLine(line));

  let customer_name: string | undefined = patch.customer_name;
  let full_address: string | undefined = patch.full_address;

  // Explicit labels are always honoured (still checked).
  const nameMatch = text.match(/(?:^|\n|\b)(?:name|নাম)\s*(?:হলো|হল|হচ্ছে|is)?\s*[:：-]?\s*([^\n,;|]+)/i);
  if (!customer_name && nameMatch?.[1]) customer_name = nameOk(nameMatch[1]);
  const addressMatch = text.match(/(?:address|ঠিকানা|এড্রেস)\s*[:：-]?\s*([^|]+)/i);
  if (!full_address && addressMatch?.[1]) full_address = addressOk(addressMatch[1], true);

  const used = new Set<string>();
  // Labelled lines are already handled; never feed them to the AI step.
  for (const line of cleanedLines) {
    if (/^(?:name|নাম|address|ঠিকানা|এড্রেস)\s*(?:হলো|হল|is)?\s*[:：-]/i.test(line)) used.add(line);
  }
  if (!customer_name && mayTakeName) {
    const firstNameLike = cleanedLines.find((line) => !!nameOk(line));
    if (firstNameLike) {
      customer_name = nameOk(firstNameLike);
      used.add(firstNameLike);
    }
  }

  if (!full_address) {
    const addressLines = cleanedLines.filter((line) => !used.has(line) && line !== customer_name);
    const joined = addressLines.join(", ");
    // A clear address (commas / place names) is remembered even before Buy Now;
    // a plain answer is accepted only when we asked for the address.
    const clear = addressOk(joined);
    const lenient = mayTakeFreeAddress ? addressOk(joined, true) : undefined;
    const addr = clear ?? lenient;
    if (addr) {
      full_address = addr;
      addressLines.forEach((l) => used.add(l));
    }
  }

  if (customer_name) patch.customer_name = customer_name.slice(0, 120);
  if (phone) patch.phone = phone;
  if (email) patch.email = email;
  if (full_address) patch.full_address = full_address.slice(0, 500);
  if (qty) patch.qty = qty;

  const leftover = cleanedLines
    .filter((l) => !used.has(l) && l !== customer_name && l !== full_address)
    .join(" ")
    .trim();
  return { patch, leftover };
}

export function looksLikeOrderDetails(text: string) {
  const hasPhone = !!extractPhone(text);
  const hasPayment = !!normalizePaymentMethod(text);
  const hasAddress = /,|address|ঠিকানা|এড্রেস|গ্রাম|ইউনিয়ন|উপজেলা|জেলা|চট্টগ্রাম|ঢাকা|house|road|village|district|upazila/i.test(text);
  return (hasPhone && (hasPayment || hasAddress)) || (hasPayment && hasAddress);
}
