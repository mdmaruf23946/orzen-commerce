// Server side of the global phrasebook (see global-phrasebook.ts for the safety model).
import { intentFromToolCalls, phraseKey, promote, type PhraseIntent, type PhraseStat } from "@/lib/global-phrasebook";

let cache: { at: number; map: Map<string, PhraseIntent> } | null = null;
const TTL_MS = 60_000;

async function storeHash(storeId: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`orzen-phrase:${storeId}`));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function promotedMap(sb: any): Promise<Map<string, PhraseIntent>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  const { data, error } = await sb.rpc("global_phrase_stats");
  const map = error ? (cache?.map ?? new Map()) : promote((data ?? []) as PhraseStat[]);
  cache = { at: Date.now(), map };
  return map;
}

export async function lookupGlobalIntent(sb: any, text: string): Promise<PhraseIntent | null> {
  try {
    const key = phraseKey(text);
    if (!key) return null;
    return (await promotedMap(sb)).get(key) ?? null;
  } catch {
    return null;
  }
}

/** Fire-and-forget: record what an AI turn meant. Never throws. */
export async function learnFromAiTurn(
  sb: any,
  opts: { storeId: string; text: string; toolCalls: { name: string; args?: any }[] },
): Promise<void> {
  try {
    const key = phraseKey(opts.text);
    const intent = intentFromToolCalls(opts.toolCalls);
    if (!key || !intent) return;
    await sb.rpc("learn_global_phrase", { p_key: key, p_intent: intent, p_store: await storeHash(opts.storeId) });
  } catch {
    /* learning never blocks replies */
  }
}
