// Per-isolate TTL cache of recently seen Meta message ids (mid). Meta often
// re-delivers the same webhook within milliseconds; this drops the repeat
// before any database work. The DB unique key (page_id,message_id) remains
// the cross-isolate guarantee — this cache is only the fast first line.
const TTL_MS = 15 * 60_000;
const MAX = 5000;
const seen = new Map<string, number>();

/** Returns true the first time a key is seen (within TTL), false for repeats. */
export function firstSighting(key: string, now = Date.now()): boolean {
  if (!key) return true;
  const at = seen.get(key);
  if (at !== undefined && now - at < TTL_MS) return false;
  seen.delete(key);
  seen.set(key, now);
  if (seen.size > MAX) {
    for (const k of seen.keys()) {
      seen.delete(k);
      if (seen.size <= MAX) break;
    }
  }
  return true;
}

/** Forget a key so a failed durable write can be retried by Meta. */
export function forget(key: string) {
  seen.delete(key);
}

const inflight = new Set<string>();
/** Claim exclusive in-isolate processing of a job; false if already running here. */
export function claimInflight(id: string): boolean {
  if (inflight.has(id)) return false;
  inflight.add(id);
  return true;
}
export function releaseInflight(id: string) {
  inflight.delete(id);
}
