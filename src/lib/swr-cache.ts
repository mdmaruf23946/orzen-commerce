/**
 * Small stale-while-revalidate cache for PUBLIC storefront reads.
 * Keys must always include the tenant (store id / slug) so data never crosses stores.
 *
 * Layer 1: per-isolate memory (fresh FRESH_MS, stale served up to MAX_STALE_MS
 * while a background refresh runs).
 * Layer 2: Cloudflare per-datacenter edge cache (EDGE_TTL_SEC), so brand-new
 * Worker isolates (very frequent on Cloudflare) don't each hit the database.
 * Never use for customer, order, payment or stock-verification data.
 */
const FRESH_MS = 20_000;
const MAX_STALE_MS = 120_000;
const MAX_ENTRIES = 2000;
const EDGE_TTL_SEC = 60;

type Entry = { value: unknown; at: number; pending?: Promise<unknown> };
const store = new Map<string, Entry>();

function edgeCache(): Cache | null {
  try {
    return (globalThis as any).caches?.default ?? null;
  } catch {
    return null;
  }
}

const edgeKey = (key: string) => `https://edge-cache.internal/swr/${encodeURIComponent(key)}`;

async function edgeGet(key: string): Promise<{ hit: boolean; value?: unknown }> {
  const c = edgeCache();
  if (!c) return { hit: false };
  try {
    const res = await c.match(edgeKey(key));
    if (!res) return { hit: false };
    return { hit: true, value: await res.json() };
  } catch {
    return { hit: false };
  }
}

function edgePut(key: string, value: unknown) {
  const c = edgeCache();
  if (!c || value === undefined) return;
  try {
    c.put(
      edgeKey(key),
      new Response(JSON.stringify(value), {
        headers: { "content-type": "application/json", "cache-control": `public, max-age=${EDGE_TTL_SEC}` },
      }),
    ).catch(() => {});
  } catch {
    /* ignore */
  }
}

export async function swr<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (typeof window !== "undefined") return load();
  const now = Date.now();
  const hit = store.get(key);
  const refresh = (useEdge: boolean) => {
    const p = (async () => {
      if (useEdge) {
        const e = await edgeGet(key);
        if (e.hit) return e.value as T;
      }
      const v = await load();
      edgePut(key, v);
      return v;
    })()
      .then((v) => {
        store.set(key, { value: v, at: Date.now() });
        if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
        return v;
      })
      .catch((e) => {
        if (hit) hit.pending = undefined;
        throw e;
      });
    if (hit) hit.pending = p;
    return p;
  };
  if (hit) {
    const age = now - hit.at;
    if (age < FRESH_MS) return hit.value as T;
    if (age < MAX_STALE_MS) {
      if (!hit.pending) refresh(true).catch(() => {});
      return hit.value as T;
    }
  }
  return (await refresh(true)) as T;
}
