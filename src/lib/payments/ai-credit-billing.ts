/**
 * Merchant credits are billed on the real total AI usage of a reply:
 * input (prompt) + output (completion) tokens. 1000 tokens = 1 credit.
 */
export function billableTokens(
  promptTokens: number | null | undefined,
  completionTokens: number | null | undefined,
): number {
  const pt = Math.max(0, Math.round(Number(promptTokens) || 0));
  const ct = Math.max(0, Math.round(Number(completionTokens) || 0));
  return pt + ct;
}

/** Credits are shown to merchants with exactly 2 decimals (500 tokens → 0.50). */
export function formatCredits(v: number | null | undefined): string {
  return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Only customer chat channels are billed: Messenger, WhatsApp, Website chat, Instagram. */
const BILLED_CHANNELS = new Set(["messenger", "whatsapp", "instagram", "web", "chat", "website", "webchat"]);
export function isBilledChannel(kind: string | null | undefined): boolean {
  return BILLED_CHANNELS.has(String(kind ?? "").toLowerCase());
}
