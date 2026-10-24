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

  // Abusive language: 2 such messages in 10 min. Clearly off-topic requests
  // (coding, homework, politics, jokes…): 3 in 10 min. Conservative on purpose
  // so a normal shopper is never silenced by one odd message.
  let abuse = 0;
  let off = 0;
  for (const s of recent) {
    const k = classifyMessage(s.content);
    if (k === "abusive") abuse++;
    else if (k === "off_topic") off++;
  }
  if (abuse >= 2) return { abusive: true, reason: "abusive" };
  if (off >= 3) return { abusive: true, reason: "off_topic" };
  return { abusive: false };
}

const ABUSIVE_RE =
  /(চুদ|চোদ|মাগি|মাগী|খানকি|খানকী|শুয়োর|শুওর|কুত্তার বাচ্চা|হারামজাদা|হারামি|বাল ছাল|\bchod|\bchud|\bmagi\b|khanki|harami|haramjada|kuttar bacha|\bfuck|\bshit\b|bitch|bastard|asshole|motherfucker)/i;

const OFF_TOPIC_RE =
  /(write (me )?(a |an )?(code|program|essay|poem|story)|python|javascript|html code|sql query|homework|assignment|solve this|math problem|translate this|কোড লিখে|প্রোগ্রাম লিখে|রচনা লিখ|কবিতা লিখ|গল্প লিখ|হোমওয়ার্ক|অ্যাসাইনমেন্ট|অংক কর|জোকস|কৌতুক বল|\bjoke\b|politic|রাজনীতি|নির্বাচন|election|prime minister|প্রধানমন্ত্রী|who are you made by|chatgpt|gemini|তুমি কি ai|are you (a )?(bot|ai|robot))/i;

/** Pure, cheap message classifier (no AI). */
export function classifyMessage(text: string | null): "abusive" | "off_topic" | "ok" {
  const t = String(text ?? "");
  if (!t.trim()) return "ok";
  if (ABUSIVE_RE.test(t)) return "abusive";
  if (OFF_TOPIC_RE.test(t)) return "off_topic";
  return "ok";
}
