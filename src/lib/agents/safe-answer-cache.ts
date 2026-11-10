// Store-isolated cache for SAFE informational AI replies only.
// A cached answer must never carry a price, stock count, delivery fee, order
// status, phone or payment fact — those always come from fresh lookups.
const store = new Map<string, { text: string; expiresAt: number }>();
const MAX = 3000;
const TTL_MS = 10 * 60_000;

const RISKY_REPLY = /[0-9০-৯৳$]|টাকা|tk\b|taka|stock|স্টক|স্টকে|delivery|ডেলিভারি|charge|চার্জ|order|অর্ডার|payment|পেমেন্ট|বিকাশ|নগদ|bkash|nagad|price|দাম|status|স্ট্যাটাস|http/i;
const RISKY_QUESTION = /[0-9০-৯]|দাম|price|koto|কত|stock|স্টক|delivery|ডেলিভারি|order|অর্ডার|track|ট্র্যাক|payment|পেমেন্ট|address|ঠিকানা|phone|ফোন|cancel|বাতিল/i;

export function normalizeQuestion(text: string): string {
  return text.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, " ").trim();
}

export function cacheKey(storeId: string, channel: string, question: string): string | null {
  const q = normalizeQuestion(question);
  if (!storeId || q.length < 2 || q.length > 120 || RISKY_QUESTION.test(q)) return null;
  return `${storeId}|${channel}|${q}`;
}

export function isCacheableReply(reply: string, usedTools: boolean): boolean {
  if (usedTools) return false;
  const r = reply.trim();
  return r.length > 0 && r.length <= 400 && !RISKY_REPLY.test(r);
}

export function getSafeAnswer(key: string | null): string | null {
  if (!key) return null;
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) { store.delete(key); return null; }
  return hit.text;
}

export function putSafeAnswer(key: string | null, reply: string, usedTools: boolean): void {
  if (!key || !isCacheableReply(reply, usedTools)) return;
  if (store.size >= MAX) store.delete(store.keys().next().value as string);
  store.set(key, { text: reply.trim(), expiresAt: Date.now() + TTL_MS });
}

/** Call when a store's products/policy/FAQ change. */
export function invalidateStoreAnswers(storeId: string): void {
  for (const k of store.keys()) if (k.startsWith(`${storeId}|`)) store.delete(k);
}
