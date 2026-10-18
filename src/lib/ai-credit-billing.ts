/** Max tokens billed to a merchant's AI credits for one customer reply. */
export const MAX_BILLED_TOKENS_PER_REPLY = 100;

/**
 * Merchant credits are billed only on the reply the AI writes (completion
 * tokens), with no minimum and a ceiling of 100 per reply. Background prompt
 * tokens (catalogue, rules, tools) are platform overhead, never billed.
 * The model itself is never truncated — the cap applies to billing only.
 */
export function billableTokens(completionTokens: number | null | undefined): number {
  const ct = Math.max(0, Math.round(Number(completionTokens) || 0));
  return Math.min(ct, MAX_BILLED_TOKENS_PER_REPLY);
}
