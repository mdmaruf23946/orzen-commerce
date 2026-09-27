/**
 * Tiny per-isolate stale-while-revalidate cache for PUBLIC storefront reads.
 * Keys must always include the tenant (store id / slug) so data never crosses stores.
 * Fresh for FRESH_MS; after that the stale value is served instantly while a
 * background refresh runs; entries older than MAX_STALE_MS are refetched inline.
 */
const FRESH_MS = 20_000;
const MAX_STALE_MS = 120_000;
const MAX_ENTRIES = 2000;

type Entry = { value: unknown; at: number; pending?: Promise<unknown> };
const store = new Map<string, Entry>();

export async function swr<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (typeof window !== "undefined") return load();
  const now = Date.now();
  const hit = store.get(key);
  const refresh = () => {
    const p = load()
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
      if (!hit.pending) refresh().catch(() => {});
      return hit.value as T;
    }
  }
  return (await refresh()) as T;
}
