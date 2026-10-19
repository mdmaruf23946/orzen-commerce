// Validators for order details collected in chat (name / address).
// A question, greeting or product talk must NEVER be stored as the customer's
// name or address — e.g. "ডেলিভারি সার্চ কত" was once saved as a name.
import { normalizeIntentText } from "@/lib/text-normalize";

const QUESTION_WORDS = [
  "কত", "কতো", "কি", "কী", "কেন", "কোথায়", "কোথায়", "কবে", "কিভাবে", "কীভাবে", "কোনটা", "কোন", "নাকি",
  "koto", "kto", "ki", "keno", "kothay", "kobe", "kivabe", "kemne", "naki",
  "how", "what", "when", "where", "why", "which", "who", "is", "are", "can", "do", "does",
];
const COMMERCE_WORDS = [
  "ডেলিভারি", "চার্জ", "দাম", "মূল্য", "অর্ডার", "অডার", "প্রোডাক্ট", "প্রডাক্ট", "পণ্য", "টাকা", "সাইজ", "কালার", "রং", "রঙ",
  "স্টক", "ক্যাশ", "বিকাশ", "নগদ", "রকেট", "কিনব", "কিনতে", "নিব", "নিবো", "নেব", "লাগবে", "চাই", "দেন", "দিন", "পাঠান",
  "ছবি", "অফার", "ডিসকাউন্ট", "রিটার্ন", "ফেরত", "পেমেন্ট", "বাতিল", "ক্যান্সেল", "কুরিয়ার", "পার্সেল", "ইনভয়েস",
  "delivery", "charge", "price", "order", "product", "size", "color", "colour", "stock", "taka", "tk", "cod", "bkash",
  "nagad", "rocket", "buy", "photo", "pic", "picture", "offer", "discount", "return", "payment", "cancel", "courier",
  "parcel", "invoice", "available", "টিসার্ট", "টিশার্ট", "শার্ট", "সার্ট", "গেঞ্জি", "মানিব্যাগ", "ব্যাগ", "জুতা", "ঘড়ি", "tshirt", "shirt", "wallet", "bag", "ache", "ase", "lagbe", "chai", "din", "den", "pathan",
];
const CHITCHAT_WORDS = [
  "হাই", "হেই", "হ্যালো", "হেলো", "সালাম", "আসসালামু", "আলাইকুম", "ধন্যবাদ", "ঠিক", "আছে", "আচ্ছা", "ওকে", "হ্যাঁ", "হা", "না", "জি", "জ্বি",
  "hi", "hey", "hello", "hlw", "salam", "assalamu", "alaikum", "thanks", "thank", "ok", "okay", "yes", "no", "ji", "accha",
];
const PLACE_WORDS = [
  "জেলা", "থানা", "উপজেলা", "ইউনিয়ন", "গ্রাম", "রোড", "বাসা", "বাড়ি", "বাড়ি", "মহল্লা", "সেক্টর", "ব্লক", "ফ্ল্যাট", "বাজার", "পাড়া", "পাড়া",
  "ঢাকা", "ঢাকার", "চট্টগ্রাম", "সিলেট", "রাজশাহী", "খুলনা", "বরিশাল", "রংপুর", "ময়মনসিংহ", "কুমিল্লা", "গাজীপুর", "নারায়ণগঞ্জ", "মিরপুর", "উত্তরা",
  "house", "road", "rd", "district", "upazila", "thana", "village", "union", "sector", "block", "flat", "bazar", "para", "lane",
  "dhaka", "chittagong", "chattogram", "sylhet", "rajshahi", "khulna", "barishal", "barisal", "rangpur", "mymensingh",
  "comilla", "cumilla", "gazipur", "narayanganj", "mirpur", "uttara", "dhanmondi", "banani", "gulshan", "savar",
];

function tokens(text: string) {
  return normalizeIntentText(text)
    .toLowerCase()
    .split(/[\s,./|()\-–:;!?？।"'`]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function hasWord(toks: string[], list: string[]) {
  return toks.some((t) =>
    list.some((w) => t === w || (/[\u0980-\u09FF]/.test(w) && w.length >= 3 && t.startsWith(w))),
  );
}

/** A question: ends with "?" or contains a question word. */
export function looksLikeQuestion(text: string) {
  const t = String(text ?? "").trim();
  if (!t) return false;
  if (/[?？]/.test(t)) return true;
  return hasWord(tokens(t), QUESTION_WORDS.filter((w) => !["is", "are", "can", "do", "does"].includes(w)));
}

export type NameCheck = { ok: true } | { ok: false; hard: boolean; reason: string };

/**
 * Could this text be a person's name?
 * hard=true  → definitely not a name (question, product talk, greeting, digits, link)
 * hard=false → unusual (long / odd) — worth asking the customer to confirm.
 */
export function checkPersonName(value: string | null | undefined): NameCheck {
  const v = String(value ?? "").trim();
  if (v.length < 2) return { ok: false, hard: true, reason: "empty" };
  if (/https?:|www\.|@/i.test(v)) return { ok: false, hard: true, reason: "link" };
  if (/[\d০-৯]/.test(v)) return { ok: false, hard: true, reason: "digits" };
  if (/[?？]/.test(v)) return { ok: false, hard: true, reason: "question" };
  const toks = tokens(v);
  if (!toks.length) return { ok: false, hard: true, reason: "empty" };
  if (hasWord(toks, QUESTION_WORDS.filter((w) => !["is", "are", "can", "do", "does"].includes(w))))
    return { ok: false, hard: true, reason: "question" };
  if (hasWord(toks, COMMERCE_WORDS)) return { ok: false, hard: true, reason: "product_talk" };
  if (toks.length <= 3 && toks.every((t) => CHITCHAT_WORDS.includes(t))) return { ok: false, hard: true, reason: "chitchat" };
  if (hasWord(toks, PLACE_WORDS) || /,/.test(v)) return { ok: false, hard: true, reason: "address" };
  if (v.length > 50 || toks.length > 4) return { ok: false, hard: false, reason: "too_long" };
  if (toks.some((t) => CHITCHAT_WORDS.includes(t))) return { ok: false, hard: false, reason: "mixed" };
  return { ok: true };
}

export function isLikelyPersonName(value: string | null | undefined) {
  return checkPersonName(value).ok;
}

/** Could this text be a delivery address? Questions and product talk never are. */
export function isLikelyAddress(value: string | null | undefined, opts: { lenient?: boolean } = {}) {
  const v = String(value ?? "").trim();
  if (v.length < 4 || v.length > 500) return false;
  if (/https?:|www\./i.test(v)) return false;
  if (looksLikeQuestion(v)) return false;
  const toks = tokens(v);
  if (hasWord(toks, COMMERCE_WORDS.filter((w) => !["din", "den", "ache", "ase"].includes(w)))) return false;
  if (toks.length <= 3 && toks.every((t) => CHITCHAT_WORDS.includes(t))) return false;
  if (hasWord(toks, PLACE_WORDS)) return true;
  if (/,/.test(v) && toks.length >= 2) return true;
  // Asked for the address and got a plain multi-word answer (e.g. "Sandeep Mushapur").
  return !!opts.lenient && toks.length >= 2;
}

/** Drop stored name/address values that are clearly not a name/address. */
export function sanitizeSlot<T extends Record<string, any>>(slot: T): { slot: T; dropped: string[] } {
  const next: Record<string, any> = { ...(slot ?? {}) };
  const dropped: string[] = [];
  if (next.customer_name) {
    const c = checkPersonName(next.customer_name);
    if (!c.ok && c.hard) {
      delete next.customer_name;
      dropped.push("customer_name");
    }
  }
  if (next.full_address && !isLikelyAddress(next.full_address, { lenient: true })) {
    delete next.full_address;
    dropped.push("full_address");
  }
  return { slot: next as T, dropped };
}

const YES = /^(?:হ্যাঁ|হ্যা|হা|হাঁ|জি|জ্বি|জী|ঠিক|ঠিক আছে|সঠিক|হুম|হ্যাঁ ঠিক|yes|ya|yeah|yep|ha|haa|hya|ji|jee|ok|okay|right|correct|sure)[\s!.।]*$/i;
const NO = /^(?:না|নাহ|ভুল|ঠিক না|no|na|nah|nope|wrong|vul|bhul)[\s!.।]*$/i;
export function isAffirmative(text: string) {
  return YES.test(String(text ?? "").trim());
}
export function isNegative(text: string) {
  return NO.test(String(text ?? "").trim());
}

/** "আমার নাম রহিম" / "my name is Rahim" / "নাম: রহিম" → "রহিম". */
export function cleanNameValue(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/^(?:আমার\s+নাম(?:\s+হলো|\s+হল|\s+হচ্ছে)?|নাম(?:\s+হলো|\s+হল)?|আমি|my\s+name\s+is|my\s+name|name\s+is|name|i\s+am|i'm|this\s+is|amar\s+nam(?:\s+holo)?|ami)\s*[:：\-]?\s+/i, "")
    .replace(/[\s.।!]+$/g, "")
    .trim();
}
