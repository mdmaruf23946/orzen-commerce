// Response validation layer: every money amount and stock claim the AI writes
// must match a backend tool result from this turn (or a fresh store-scoped
// lookup). Unverifiable amounts are removed and replaced with a safe line.
import { fetchDeliveryZones } from "./chat-order-format";
import { isStockless } from "./product-stock";

export type VerifiedFacts = {
  amounts: number[];
  stock: { qty: number; type: string | null }[];
  toolCalls: number;
};

const MONEY_KEY = /price|charge|total|subtotal|amount|delivery|cost|fee/i;
const STOCK_KEY = /^(stock|available|variant_stock)$/i;

function walk(v: any, out: VerifiedFacts, depth = 0) {
  if (v == null || depth > 6) return;
  if (Array.isArray(v)) {
    for (const x of v.slice(0, 50)) walk(x, out, depth + 1);
    return;
  }
  if (typeof v !== "object") return;
  const type = typeof v.product_type === "string" ? v.product_type : typeof v.type === "string" ? v.type : null;
  for (const [k, val] of Object.entries(v)) {
    const n = typeof val === "number" ? val : typeof val === "string" && /^\d+(\.\d+)?$/.test(val) ? Number(val) : NaN;
    if (Number.isFinite(n)) {
      if (MONEY_KEY.test(k)) out.amounts.push(n);
      if (STOCK_KEY.test(k)) out.stock.push({ qty: n, type });
    } else if (typeof val === "string" && MONEY_KEY.test(k)) {
      // e.g. total: "৳1,250"
      for (const a of extractAmounts(val)) out.amounts.push(a.value);
    } else if (typeof val === "object") walk(val, out, depth + 1);
  }
}

/** Collect every price/charge/stock number returned by tools this turn. */
export function collectVerifiedFacts(result: any): VerifiedFacts {
  const out: VerifiedFacts = { amounts: [], stock: [], toolCalls: 0 };
  for (const step of (result?.steps ?? []) as any[]) {
    for (const r of (step?.toolResults ?? []) as any[]) {
      out.toolCalls++;
      walk(r?.output ?? r?.result, out);
    }
  }
  return out;
}

const BN = "০১২৩৪৫৬৭৮৯";
function toAscii(s: string) {
  return s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));
}

const NUM = "[0-9০-৯][0-9০-৯,]*(?:\\.[0-9০-৯]+)?";
const MONEY_RE = new RegExp(
  `(?:(?:৳|tk\\.?|bdt|taka)\\s*(${NUM}))|(?:(${NUM})\\s*(?:৳|টাকা|tk\\b|taka\\b|bdt\\b|/-))`,
  "gi",
);

export function extractAmounts(text: string) {
  const out: { value: number; index: number; raw: string }[] = [];
  for (const m of text.matchAll(MONEY_RE)) {
    const raw = m[1] ?? m[2] ?? "";
    const value = Number(toAscii(raw).replace(/,/g, ""));
    if (Number.isFinite(value)) out.push({ value, index: m.index ?? 0, raw: m[0] });
  }
  return out;
}

function allowedSet(amounts: number[]) {
  const base = Array.from(new Set(amounts.filter((n) => n >= 0))).slice(0, 60);
  const set = new Set<number>(base);
  // price × qty and price(+qty) + charge combinations
  for (const a of base) {
    for (let q = 2; q <= 10; q++) set.add(a * q);
    for (const b of base) set.add(a + b);
  }
  return set;
}

const IN_STOCK_RE = /(স্টকে\s*(আছে|রয়েছে|আছেন)|স্টক\s*আছে|in\s*stock|available\s+now)/i;

export type GuardResult = { text: string; corrections: { kind: string; detail: string }[] };

export async function guardReply(
  sb: any,
  text: string,
  facts: VerifiedFacts,
  opts: { storeId: string; focusProductId?: string | null },
): Promise<GuardResult> {
  const corrections: GuardResult["corrections"] = [];
  let out = String(text ?? "");
  if (!out.trim()) return { text: out, corrections };

  let amounts = extractAmounts(out);
  let allowed = allowedSet(facts.amounts);
  let bad = amounts.filter((a) => !allowed.has(a.value));

  // One fresh, store-scoped lookup before rejecting anything.
  if (bad.length) {
    const extra: number[] = [];
    try {
      const zones = await fetchDeliveryZones(sb, opts.storeId);
      for (const z of zones as any[]) extra.push(Number(z.charge ?? 0));
      if (opts.focusProductId) {
        const { data } = await sb
          .from("products")
          .select("price,old_price,delivery_charge")
          .eq("store_id", opts.storeId)
          .eq("id", opts.focusProductId)
          .maybeSingle();
        if (data) extra.push(Number(data.price ?? 0), Number(data.old_price ?? 0), Number(data.delivery_charge ?? 0));
      }
    } catch {
      /* fall through: keep strict */
    }
    allowed = allowedSet([...facts.amounts, ...extra]);
    bad = amounts.filter((a) => !allowed.has(a.value));
  }

  if (bad.length) {
    // Drop each sentence that carries an unverified amount.
    const sentences = out.split(/(?<=[।.!?\n])/);
    out = sentences
      .filter((s) => {
        const hit = extractAmounts(s).some((a) => !allowed.has(a.value));
        if (hit) corrections.push({ kind: "unverified_amount", detail: s.trim().slice(0, 200) });
        return !hit;
      })
      .join("")
      .trim();
    out = `${out}${out ? "\n\n" : ""}সঠিক দাম/চার্জ নিশ্চিত করে জানাচ্ছি, একটু সময় দিন। / Let me confirm the exact price for you.`;
  }

  // Stock claim against tool results: all observed physical stock is 0.
  const physical = facts.stock.filter((s) => !isStockless(s.type));
  if (IN_STOCK_RE.test(out) && physical.length && physical.every((s) => s.qty <= 0)) {
    out = out.replace(IN_STOCK_RE, "এই মুহূর্তে স্টকে নেই");
    corrections.push({ kind: "stock_claim", detail: "claimed in stock, tool stock = 0" });
  }

  amounts = [];

  // Variant (size/colour) and merchant policy firewalls — never throw.
  try {
    out = await guardVariants(sb, out, opts, corrections);
  } catch {
    /* non-fatal */
  }
  try {
    out = await guardPolicy(sb, out, opts, corrections);
  } catch {
    /* non-fatal */
  }
  return { text: out, corrections };
}

const SIZE_ALIAS: Record<string, string> = {
  "এক্সএস": "xs", "এস": "s", "এম": "m", "এল": "l", "এক্সএল": "xl", "ডাবল এক্সএল": "xxl", "২এক্সএল": "xxl", "এক্সএক্সএল": "xxl",
  "লাল": "red", "কালো": "black", "সাদা": "white", "নীল": "blue", "সবুজ": "green", "হলুদ": "yellow", "গোলাপি": "pink",
  "সোনালী": "golden", "সোনালি": "golden", "রুপালি": "silver", "খয়েরি": "brown", "বাদামি": "brown", "ধূসর": "gray", "কমলা": "orange", "বেগুনি": "purple",
};
const norm = (s: string) => {
  const t = String(s ?? "").trim().toLowerCase();
  return SIZE_ALIAS[t] ?? (t === "grey" ? "gray" : t === "gold" ? "golden" : t === "2xl" ? "xxl" : t);
};
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function guardVariants(
  sb: any,
  text: string,
  opts: { storeId: string; focusProductId?: string | null },
  corrections: GuardResult["corrections"],
) {
  if (!opts.focusProductId) return text;
  const { data } = await sb
    .from("products")
    .select("variants,stock,product_type")
    .eq("store_id", opts.storeId)
    .eq("id", opts.focusProductId)
    .maybeSingle();
  if (!data || isStockless(data.product_type)) return text;
  const v = data.variants;
  const optionDefs: { name: string; values: string[] }[] = Array.isArray(v?.options) ? v.options : [];
  const items: { options?: Record<string, string>; stock?: number | null }[] = Array.isArray(v?.items) ? v.items : [];
  if (!optionDefs.length) return text;
  const productStock = Number(data.stock ?? 0);
  // value (normalized) → available?
  const avail = new Map<string, { label: string; ok: boolean }>();
  for (const def of optionDefs) {
    for (const val of def.values ?? []) {
      const matching = items.filter((it) => String(it.options?.[def.name] ?? "") === String(val));
      const ok = matching.length
        ? matching.some((it) => (it.stock == null ? productStock > 0 : Number(it.stock) > 0))
        : productStock > 0;
      avail.set(norm(val), { label: String(val), ok });
    }
  }
  const inStock = [...avail.values()].filter((a) => a.ok).map((a) => a.label);
  const CLAIM = /(আছে|রয়েছে|পাওয়া যাবে|পাবেন|available|in stock|have)/i;
  const sentences = text.split(/(?<=[।.!?\n])/);
  let changed = false;
  const out = sentences.map((s) => {
    if (!CLAIM.test(s) || /নেই|not available|out of stock/i.test(s)) return s;
    const words = (s.match(/[A-Za-z0-9]+|[\u0980-\u09FF]+/g) ?? []).filter(
      (w) => !(w.length === 1 && /[a-z]/.test(w)),
    );
    const bad = new Set<string>();
    for (const w of words) {
      const n = norm(w);
      const hit = avail.get(n);
      if (hit && !hit.ok) bad.add(hit.label);
    }
    // Claimed a size token that doesn't exist at all for this product.
    const sizeDef = optionDefs.find((d) => /size|সাইজ/i.test(d.name));
    if (sizeDef) {
      for (const m of s.matchAll(/\b(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL)\b/g)) {
        if (!avail.has(norm(m[1]!))) bad.add(m[1]!);
      }
    }
    if (!bad.size) return s;
    changed = true;
    const list = [...bad].join(", ");
    corrections.push({ kind: "variant_claim", detail: `${list} :: ${s.trim().slice(0, 160)}` });
    const offer = inStock.length ? ` পাওয়া যাচ্ছে: ${inStock.join(", ")}।` : " এই মুহূর্তে কোনো অপশন স্টকে নেই।";
    return `${list} এই মুহূর্তে নেই।${offer}${/\n$/.test(s) ? "\n" : " "}`;
  });
  void escapeRe;
  return changed ? out.join("").trim() : text;
}

async function guardPolicy(
  sb: any,
  text: string,
  opts: { storeId: string; focusProductId?: string | null },
  corrections: GuardResult["corrections"],
) {
  const DELIV = /(ডেলিভারি|ডেলিভারী|delivery|পৌঁছ|হাতে পাবেন)/i;
  const RET = /(রিটার্ন|ফেরত|এক্সচেঞ্জ|বদল|return|exchange|refund)/i;
  const DAYS = /([0-9০-৯]+)\s*(?:-|–|থেকে|to)?\s*(?:[0-9০-৯]+)?\s*(?:দিন|day|days|কর্মদিবস|working)/gi;
  if (!(DELIV.test(text) || RET.test(text)) || !/[0-9০-৯]\s*(?:-|–|থেকে|to)?\s*[0-9০-৯]*\s*(দিন|day|কর্মদিবস|working)/i.test(text)) {
    // Still block "returns accepted" when the store disabled returns.
    if (!RET.test(text)) return text;
  }
  const { loadStorePolicy, allowedDelivery, allowedReturn, returnPolicyText } = await import("./store-policy.server");
  const p = await loadStorePolicy(sb, opts.storeId, opts.focusProductId);
  const okD = allowedDelivery(p);
  const okR = allowedReturn(p);
  const bnDigits = (s: string) => Number(s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))));
  let changed = false;
  const bn = /[\u0980-\u09FF]/.test(text);
  const sentences = text.split(/(?<=[।.!?\n])/).map((s) => {
    const isRet = RET.test(s);
    const isDel = !isRet && DELIV.test(s);
    if (!isRet && !isDel) return s;
    if (isRet && p.returns.configured && !p.returns.accepts_returns && !p.returns.exchange && !/(নেই|না|not|no)\b/i.test(s)) {
      changed = true;
      corrections.push({ kind: "policy_return_disabled", detail: s.trim().slice(0, 160) });
      return (returnPolicyText(p, bn) ?? "") + " ";
    }
    const nums = [...s.matchAll(DAYS)].map((m) => bnDigits(m[1]!));
    if (!nums.length) return s;
    const allowed = isRet ? okR : okD;
    if (nums.every((n) => allowed.has(n))) return s;
    changed = true;
    corrections.push({ kind: isRet ? "policy_return_days" : "policy_delivery_days", detail: s.trim().slice(0, 160) });
    if (isRet) return (returnPolicyText(p, bn) ?? (bn ? "রিটার্নের নিয়ম দোকান থেকে নিশ্চিত করে জানাচ্ছি।" : "Let me confirm the return policy with the store.")) + " ";
    const rows = p.delivery.filter((z) => z.eta);
    if (rows.length) return (bn ? "ডেলিভারি সময়: " : "Delivery time: ") + rows.map((z) => `${z.zone} ${z.eta}`).join(", ") + (bn ? "। " : ". ");
    if (p.product_delivery_days != null) return bn ? `ডেলিভারি সময় প্রায় ${p.product_delivery_days} দিন। ` : `Delivery takes about ${p.product_delivery_days} days. `;
    return bn ? "ডেলিভারি সময় দোকান থেকে নিশ্চিত করে জানাচ্ছি। " : "Let me confirm the delivery time with the store. ";
  });
  return changed ? sentences.join("").replace(/\s+\n/g, "\n").trim() : text;
}

/** Records guard corrections for review; never throws. */
export async function logGuardCorrections(sb: any, conversationId: string | null, g: GuardResult, original: string) {
  if (!conversationId || !g.corrections.length) return;
  try {
    await sb.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "system",
      direction: "out",
      message_type: "guard",
      content: JSON.stringify({ corrections: g.corrections, original: original.slice(0, 1500) }).slice(0, 4000),
    });
  } catch {
    /* non-fatal */
  }
}
