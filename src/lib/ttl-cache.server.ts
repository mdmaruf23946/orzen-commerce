// Tiny per-isolate TTL cache with in-flight de-duplication.
// Only for shared, non-private store data (store profile, agent settings,
// delivery zones). Never cache customer data, orders, payments, stock checks.
const store = new Map<string, { value: unknown; expiresAt: number }>();
const inflight = new Map<string, Promise<unknown>>();
const MAX = 2000;

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = loader()
    .then((value) => {
      if (store.size >= MAX) store.delete(store.keys().next().value as string);
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function invalidate(prefix: string) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
