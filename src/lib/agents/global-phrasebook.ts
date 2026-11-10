// Global phrasebook: platform-wide learning of HOW customers phrase simple
// questions, shared by every store (new stores benefit from day one).
//
// Safety model — it learns only "this wording means intent X", never answers:
// - Stored text is a short normalised phrase; anything with digits, links,
//   emails or more than 6 words is never stored (no phones, order numbers,
//   addresses or names).
// - Stores are recorded only as one-way hashes, never ids or customer data.
// - Intents map to deterministic handlers that read the CURRENT store's own
//   fresh data (its products / its delivery zones). No price, stock or order
//   fact is ever learned or copied between stores.
// - A phrase is used only after 3+ different stores agreed with ≥90% share;
//   any doubt → normal AI path.
import { normalizeIntentText } from "@/lib/text-normalize";

export type PhraseIntent = "catalog_browse" | "delivery_charge";
export const PHRASE_INTENTS: PhraseIntent[] = ["catalog_browse", "delivery_charge"];
export const MIN_STORES = 3;
export const MIN_SHARE = 0.9;

export function phraseKey(text: string): string | null {
  const raw = String(text ?? "").trim();
  if (!raw || raw.length > 60 || raw.includes("\n")) return null;
  if (/[0-9০-৯]|https?:|www\.|@/i.test(raw)) return null;
  const k = normalizeIntentText(raw)
    .toLowerCase()
    .replace(/[?？!।.,;:'"“”‘’()\[\]{}…~*_\-]+/g, " ")
    .replace(/\p{Extended_Pictographic}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (k.length < 3 || k.length > 40) return null;
  if (k.split(" ").length > 6) return null;
  return k;
}

type ToolCall = { name: string; args?: Record<string, unknown> | null };

/** Learn only from unambiguous single-purpose AI turns. */
export function intentFromToolCalls(calls: ToolCall[]): PhraseIntent | null {
  if (!calls.length) return null;
  const names = new Set(calls.map((c) => c.name));
  if (names.size !== 1) return null;
  const [only] = [...names];
  if (only === "listCategories") return "catalog_browse";
  if (only === "getDeliveryCharge") {
    const generic = calls.every((c) => {
      const a = c.args ?? {};
      return !String(a.area ?? "").trim() && !a.productId && !a.product_id && !a.productIds;
    });
    return generic ? "delivery_charge" : null;
  }
  return null;
}

export type PhraseStat = { phrase_key: string; intent: string; stores: number; hits: number };

/** Promoted phrase → intent map from raw stats (pure; mirrors the SQL rule). */
export function promote(stats: PhraseStat[]): Map<string, PhraseIntent> {
  const byKey = new Map<string, PhraseStat[]>();
  for (const s of stats) byKey.set(s.phrase_key, [...(byKey.get(s.phrase_key) ?? []), s]);
  const out = new Map<string, PhraseIntent>();
  for (const [key, rows] of byKey) {
    const total = rows.reduce((n, r) => n + r.hits, 0);
    const best = [...rows].sort((a, b) => b.hits - a.hits)[0]!;
    if (!PHRASE_INTENTS.includes(best.intent as PhraseIntent)) continue;
    if (best.stores >= MIN_STORES && total > 0 && best.hits / total >= MIN_SHARE) {
      out.set(key, best.intent as PhraseIntent);
    }
  }
  return out;
}
