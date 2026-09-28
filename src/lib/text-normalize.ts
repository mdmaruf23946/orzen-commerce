// Typo-tolerant normalisation for customer chat text (Bangla, Banglish, English).
// Customers often misspell key words ("ডেলিভারি সার্চ কত", "dlvry charj koto").
// This maps common misspellings of the words our deterministic rules rely on
// to one canonical spelling, so fast-path rules and slot validators see the
// intended meaning. It never changes names, numbers or addresses in storage —
// it is only used for matching.

const DELIVERY_BN = /^(?:ডেলিভারি|ডেলিভারী|ডেলিবারি|ডেলিবারী|ডেলেভারি|ডেলিভেরি|ডিলিভারি|ডিলেভারি|ডেলভারি|দেলিভারি|ডেলিভার|ডেলিভারির|ডেলিভারিতে)$/;
const DELIVERY_EN = /^(?:delivery|deliveri|delivary|dilivery|delivey|delevery|dlvry|delivry|dlivery|deliver|delivari|dilevery|delivery's)$/i;

const CHARGE_WORDS = [
  "চার্জ", "চাজ", "চার্য", "চারজ", "চার্চ", "চাজ্জ", "চার্জ্জ", "সার্চ", "সার্জ", "চাৰ্জ", "চার্জে", "চার্জটা", "চাজর্",
  "charge", "charj", "chrg", "chrge", "carge", "chage", "charg", "charze", "sarj", "sarch", "charges", "cahrge",
];
const QTY_WORDS: Record<string, string> = {
  "কতো": "কত", "কত্তো": "কত", "কতু": "কত", "কোতো": "কত", "কতো?": "কত",
  koto: "কত", kto: "কত", kot: "কত", kuto: "কত", ktoo: "কত", kotto: "কত",
};

/** Levenshtein distance, early exit above `max`. */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]!;
  }
  return prev[b.length]!;
}

function isDeliveryWord(w: string) {
  return DELIVERY_BN.test(w) || DELIVERY_EN.test(w) || editDistance(w.toLowerCase(), "delivery", 2) <= 2 || editDistance(w, "ডেলিভারি", 2) <= 2;
}

function isChargeWord(w: string) {
  const lw = w.toLowerCase();
  if (CHARGE_WORDS.includes(lw)) return true;
  return editDistance(lw, "charge", 2) <= 2 || editDistance(w, "চার্জ", 2) <= 2;
}

/**
 * Normalise a short customer message for intent matching.
 * "ডেলিভারি সার্চ কতো" → "ডেলিভারি চার্জ কত", "dlvry charj koto" → "delivery charge কত".
 */
export function normalizeIntentText(text: string): string {
  const raw = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return raw;
  const tokens = raw.split(" ");
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    const bare = tok.replace(/[?？!।.,]+$/g, "");
    const tail = tok.slice(bare.length);
    const lw = bare.toLowerCase();
    let next = bare;
    if (isDeliveryWord(bare)) {
      next = /[\u0980-\u09FF]/.test(bare) ? "ডেলিভারি" : "delivery";
    } else if (i > 0 && /^(?:ডেলিভারি|delivery)$/.test(out[out.length - 1]!.replace(/[?？!।.,]+$/g, "")) && isChargeWord(bare)) {
      // Only fix "charge" right after a delivery word, so "সার্চ" elsewhere stays.
      next = /[\u0980-\u09FF]/.test(bare) ? "চার্জ" : "charge";
    } else if (QTY_WORDS[lw]) {
      next = QTY_WORDS[lw]!;
    }
    out.push(next + tail);
  }
  return out.join(" ");
}

/** True when the text is (a possibly misspelt) delivery-charge question. */
export function isDeliveryChargeQuestion(text: string): boolean {
  const n = normalizeIntentText(text).toLowerCase();
  return /(ডেলিভারি|delivery)\s*(চার্জ|charge|খরচ|cost|fee|কত)/i.test(n);
}
