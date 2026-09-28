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
  return { text: out, corrections };
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
