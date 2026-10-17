// Who may buy extra AI credits: only stores on a paid, active plan whose
// package includes an AI chat channel (AI agent / Messenger AI / WhatsApp).
export const AI_CREDIT_FEATURE_FLAGS = ["ai_agent", "ai_messenger", "whatsapp", "web_chat"] as const;

export type CreditEligibilityInput = {
  pkg: { is_trial?: boolean | null; features?: Record<string, unknown> | null } | null;
  expiresAt?: string | null;
  now?: Date;
};

export function canBuyAiCredits({ pkg, expiresAt, now = new Date() }: CreditEligibilityInput): { ok: boolean; reason?: string } {
  if (!pkg) return { ok: false, reason: "no_plan" };
  if (pkg.is_trial) return { ok: false, reason: "trial" };
  if (expiresAt && new Date(expiresAt) <= now) return { ok: false, reason: "expired" };
  const f = (pkg.features ?? {}) as Record<string, unknown>;
  if (!AI_CREDIT_FEATURE_FLAGS.some((k) => f[k] === true)) return { ok: false, reason: "no_ai" };
  return { ok: true };
}
