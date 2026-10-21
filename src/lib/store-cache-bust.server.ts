// Drop every in-memory copy of a store's delivery/policy facts after the
// merchant edits them, so the next chat reply reads fresh values.
export async function bustStoreCaches(storeId: string): Promise<void> {
  try {
    const { invalidate } = await import("./ttl-cache.server");
    invalidate(`zones:${storeId}`);
    invalidate(`ctx:store:${storeId}`);
    invalidate(`ctx:agent:${storeId}`);
    const { invalidateStoreAnswers } = await import("./safe-answer-cache");
    invalidateStoreAnswers(storeId);
  } catch { /* cache bust never blocks a save */ }
}
