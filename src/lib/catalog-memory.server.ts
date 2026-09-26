// Pre-indexed store catalogue memory ("the shopkeeper who memorised the shop").
//
// Instead of scanning the whole catalogue on every customer message, each store
// is loaded once into a compact in-process index (tokens -> products) and reused
// for the lifetime of the worker isolate. Lookups are then pure in-memory set
// intersections: a few hundred microseconds even for 10k products, with no AI
// call and no per-message full-table read.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Sb = ReturnType<typeof createClient<Database>>;

export type MemoryProduct = {
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

type IndexedProduct = {
  product: MemoryProduct;
  categoryName: string;
  haystack: string;
  nameText: string;
  tokens: Set<string>;
  hasImage: boolean;
  popularity: number;
};

export type StoreMemory = {
  storeId: string;
  loadedAt: number;
  products: IndexedProduct[];
  byId: Map<string, IndexedProduct>;
  tokenIndex: Map<string, number[]>;
  categoryNames: Map<string, string>;
};

const CATALOG_SELECT =
  "product_id,name,slug,brand,product_code,sku,category_id,short_description,description,price,old_price,stock,primary_image_url,gallery,features,specifications,variants,total_sold,rating,is_featured";

/** How long a memorised catalogue stays trusted before it is re-learned. */
const MEMORY_TTL_MS = 90_000;
const MAX_PRODUCTS = 10_000;

const STOPWORDS = new Set([
  "this", "that", "these", "those", "show", "send", "photo", "image", "picture", "pic", "please", "price", "details",
  "do", "you", "have", "any", "the", "and", "for", "with", "your", "our", "want", "need", "buy", "order", "product",
  "এটা", "এইটা", "ওটা", "এই", "ওই", "এর", "টার", "একটা", "একটি", "ছবি", "দাও", "দেন", "দেখাও", "দেখান", "কি", "কী",
  "আছে", "দাম", "কত", "ডিটেইলস", "বিস্তারিত", "প্লিজ", "আমাদের", "আপনাদের", "তোমার", "কাছে", "হবে", "লাগবে", "চাই",
]);

const SYNONYMS: Record<string, string[]> = {
  "ব্যাগ": ["bag", "backpack"],
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
  "বেডশিট": ["bedsheet"],
  "ফ্যান": ["fan"],
  "লাইট": ["light"],
  "ফুলদানি": ["vase", "flower vase"],
  "মগ": ["mug", "cup"],
  "চশমা": ["glass", "sunglass", "sunglasses"],
  "গয়না": ["jewellery", "jewelry", "ring", "necklace"],
};

const memoryCache = new Map<string, { memory: StoreMemory; expiresAt: number }>();
const inflight = new Map<string, Promise<StoreMemory>>();

function stringifyField(value: unknown): string {
  if (!value) return "";
  if (Array.isArray(value)) return value.map(stringifyField).join(" ");
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).map(stringifyField).join(" ");
  return String(value);
}

export function tokenize(raw: string): string[] {
  const compact = String(raw ?? "").toLowerCase().replace(/[.,!?;:()\[\]{}"'`~|/\\_-]+/g, " ");
  const out = new Set<string>();
  for (const token of compact.split(/\s+/)) {
    const value = token.trim();
    if (value.length < 2 || STOPWORDS.has(value)) continue;
    out.add(value);
    for (const synonym of SYNONYMS[value] ?? []) out.add(synonym.toLowerCase());
  }
  for (const [bn, synonyms] of Object.entries(SYNONYMS)) {
    if (compact.includes(bn)) {
      out.add(bn);
      synonyms.forEach((s) => out.add(s.toLowerCase()));
    }
  }
  return Array.from(out);
}

async function loadMemory(sb: Sb, storeId: string): Promise<StoreMemory> {
  const [{ data: rows }, { data: categories }, { data: blocked }] = await Promise.all([
    sb.from("ai_product_catalog").select(CATALOG_SELECT).eq("store_id", storeId).eq("status", "active").gt("stock", 0).limit(MAX_PRODUCTS),
    sb.from("categories").select("id,name").eq("store_id", storeId),
    sb.from("ai_product_blacklist").select("product_id").eq("store_id", storeId),
  ]);
  const blockedIds = new Set((blocked ?? []).map((r: any) => String(r.product_id)));
  const categoryNames = new Map<string, string>((categories ?? []).map((c: any) => [String(c.id), String(c.name ?? "")]));

  const products: IndexedProduct[] = [];
  const byId = new Map<string, IndexedProduct>();
  const tokenIndex = new Map<string, number[]>();

  for (const raw of (rows ?? []) as any[]) {
    const id = String(raw.product_id);
    if (blockedIds.has(id)) continue;
    const product: MemoryProduct = { ...raw, id } as MemoryProduct;
    const categoryName = categoryNames.get(String(product.category_id ?? "")) ?? "";
    const haystack = [
      product.name,
      product.brand,
      product.sku,
      product.product_code,
      categoryName,
      product.short_description,
      String(product.description ?? "").slice(0, 600),
      stringifyField(product.features).slice(0, 300),
      stringifyField(product.specifications).slice(0, 300),
      stringifyField(product.variants).slice(0, 200),
    ].filter(Boolean).join(" ").toLowerCase();
    const entry: IndexedProduct = {
      product,
      categoryName,
      haystack,
      nameText: String(product.name ?? "").toLowerCase(),
      tokens: new Set(tokenize(haystack)),
      hasImage: Boolean(product.primary_image_url) || (Array.isArray(product.gallery) && product.gallery.length > 0),
      popularity: Math.min(Number(product.total_sold) || 0, 50) / 10 + Math.min(Number(product.rating) || 0, 5),
    };
    const position = products.length;
    products.push(entry);
    byId.set(id, entry);
    for (const token of entry.tokens) {
      const bucket = tokenIndex.get(token);
      if (bucket) bucket.push(position);
      else tokenIndex.set(token, [position]);
    }
  }

  return { storeId, loadedAt: Date.now(), products, byId, tokenIndex, categoryNames };
}

/** Memorised catalogue for a store, loaded at most once per TTL per isolate. */
export async function getStoreMemory(sb: Sb, storeId: string): Promise<StoreMemory> {
  const cached = memoryCache.get(storeId);
  if (cached && cached.expiresAt > Date.now()) return cached.memory;
  const pending = inflight.get(storeId);
  if (pending) return pending;
  const task = loadMemory(sb, storeId)
    .then((memory) => {
      memoryCache.set(storeId, { memory, expiresAt: Date.now() + MEMORY_TTL_MS });
      return memory;
    })
    .finally(() => inflight.delete(storeId));
  inflight.set(storeId, task);
  return task;
}

/** Drop a store's memory so the next message re-learns the catalogue. */
export function forgetStoreMemory(storeId: string) {
  memoryCache.delete(storeId);
}

function scoreEntry(entry: IndexedProduct, terms: string[], phrase: string) {
  let score = 0;
  if (phrase && entry.haystack.includes(phrase)) score += 60;
  for (const term of terms) {
    if (entry.tokens.has(term) || entry.haystack.includes(term)) score += 25;
    if (entry.nameText.includes(term)) score += 20;
    if (entry.categoryName.toLowerCase().includes(term)) score += 15;
  }
  if (entry.hasImage) score += 12;
  if (entry.product.is_featured) score += 6;
  return score + entry.popularity;
}

/** Instant text lookup against the memorised catalogue. */
export function recallByText(memory: StoreMemory, text: string, limit = 6): MemoryProduct[] {
  const terms = tokenize(text);
  const phrase = String(text ?? "").toLowerCase().trim();
  const candidates = new Set<number>();
  for (const term of terms) for (const position of memory.tokenIndex.get(term) ?? []) candidates.add(position);
  // Phrase-only queries (or unindexed spellings) still get a bounded scan.
  const pool = candidates.size
    ? Array.from(candidates, (position) => memory.products[position]!)
    : memory.products.slice(0, 1500);
  const scored = pool
    .map((entry) => ({ entry, score: scoreEntry(entry, terms, phrase) }))
    .filter((row) => (terms.length ? row.score >= 25 : true));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((row) => row.entry.product);
}

/** Products the memory considers plausible for a photo description. */
export function recallForImage(
  memory: StoreMemory,
  signals: { type?: string | null; subtype?: string | null; category?: string | null; brand?: string | null; keywords?: string[]; text?: string[] },
  limit = 8,
): MemoryProduct[] {
  const query = [
    signals.type,
    signals.subtype,
    signals.category,
    signals.brand,
    ...(signals.keywords ?? []),
    ...(signals.text ?? []),
  ].filter(Boolean).join(" ");
  const hits = recallByText(memory, query, limit);
  if (hits.length >= Math.min(limit, 4)) return hits;
  // Nothing memorable matched the words: fall back to the shop's best sellers
  // with photos so the visual check still has something to compare against.
  const filler = memory.products
    .filter((entry) => entry.hasImage && !hits.some((p) => p.id === entry.product.id))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit - hits.length)
    .map((entry) => entry.product);
  return [...hits, ...filler];
}

/** Same-category alternatives, for "we don't have it, but…" replies. */
export function recallAlternatives(memory: StoreMemory, hintText: string, limit = 3): MemoryProduct[] {
  const hits = recallByText(memory, hintText, limit * 2).filter((p) => Boolean(p.primary_image_url));
  if (hits.length) return hits.slice(0, limit);
  return memory.products
    .filter((entry) => entry.hasImage)
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit)
    .map((entry) => entry.product);
}

export function memoryCategoryName(memory: StoreMemory, categoryId: string | null | undefined) {
  return memory.categoryNames.get(String(categoryId ?? "")) ?? "";
}
