// Channel-neutral abuse/flood detection. Pure decision logic lives here so it
// is testable; `conversation-guard.server.ts` loads messages and applies it.

export type InboundSample = { content: string | null; created_at: string };

export type AbuseVerdict = { abusive: false } | { abusive: true; reason: string };

export const ABUSE_RULES = {
  burstWindowSec: 60,
  burstMax: 8, // more than 8 customer messages in 60s
  repeatWindowSec: 600,
  repeatMax: 4, // same text 4+ times in 10 min
  floodWindowSec: 600,
  floodMax: 30, // 30+ messages in 10 min
};

const norm = (s: string | null) =>
  String(s ?? "").toLowerCase().replace(/\s+/g, " ").replace(/[!?.।,]+$/g, "").trim();

export function detectAbuse(samples: InboundSample[], now = Date.now()): AbuseVerdict {
  const ageSec = (s: InboundSample) => (now - new Date(s.created_at).getTime()) / 1000;
  const burst = samples.filter((s) => ageSec(s) <= ABUSE_RULES.burstWindowSec);
  if (burst.length > ABUSE_RULES.burstMax) return { abusive: true, reason: "burst" };

  const recent = samples.filter((s) => ageSec(s) <= ABUSE_RULES.repeatWindowSec);
  const counts = new Map<string, number>();
  for (const s of recent) {
    const k = norm(s.content);
    if (!k) continue;
    const n = (counts.get(k) ?? 0) + 1;
    counts.set(k, n);
    if (n >= ABUSE_RULES.repeatMax) return { abusive: true, reason: "repeat" };
  }

  const flood = samples.filter((s) => ageSec(s) <= ABUSE_RULES.floodWindowSec);
  if (flood.length >= ABUSE_RULES.floodMax) return { abusive: true, reason: "flood" };
  return { abusive: false };
}
