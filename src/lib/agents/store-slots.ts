/**
 * Per-isolate, per-store concurrency guard. One busy store can't hog every
 * worker slot (Workers allow only 6 outbound connections per invocation and
 * AI providers rate-limit). Waiting is bounded: after `maxWaitMs` the job runs
 * anyway, so a message is never dropped — it is only briefly smoothed.
 */
const active = new Map<string, number>();
const waiters = new Map<string, Array<() => void>>();

// Unlimited by default: each message job already runs in its own Worker
// invocation, so there is no shared cap. Callers may still pass a limit.
export const STORE_SLOT_LIMIT = Number.POSITIVE_INFINITY;

export async function acquireStoreSlot(
  storeId: string,
  limit = STORE_SLOT_LIMIT,
  maxWaitMs = 15_000,
): Promise<() => void> {
  let released = false;
  const take = () => active.set(storeId, (active.get(storeId) ?? 0) + 1);
  const release = () => {
    if (released) return;
    released = true;
    const n = (active.get(storeId) ?? 1) - 1;
    if (n <= 0) active.delete(storeId);
    else active.set(storeId, n);
    const q = waiters.get(storeId);
    const next = q?.shift();
    if (q && !q.length) waiters.delete(storeId);
    next?.();
  };
  if ((active.get(storeId) ?? 0) < limit) {
    take();
    return release;
  }
  await new Promise<void>((resolve) => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      const q = waiters.get(storeId);
      if (q) {
        const i = q.indexOf(go);
        if (i >= 0) q.splice(i, 1);
        if (!q.length) waiters.delete(storeId);
      }
      go();
    }, maxWaitMs);
    const q = waiters.get(storeId) ?? [];
    q.push(go);
    waiters.set(storeId, q);
  });
  take();
  return release;
}

export function storeSlotsInUse(storeId: string): number {
  return active.get(storeId) ?? 0;
}
