// Customer Style Memory + Universal Persona layer.
// Derives a stable style profile from the customer's own recent messages so
// every agent/drawer replies in ONE consistent voice. Pure, no I/O, no tokens.
import { detectReplyStyle, type ReplyStyle } from "../reply-language";

export type AddressTerm = "bhaiya" | "apu" | "sir" | "madam" | "neutral";
export type Formality = "respectful" | "casual";

export type CustomerStyle = {
  language: ReplyStyle;
  address: AddressTerm;
  formality: Formality;
  usesEmoji: boolean;
  brief: boolean;
};

const EMOJI = /\p{Extended_Pictographic}/u;

function textOf(m: unknown): string {
  if (typeof m === "string") return m;
  const c = (m as any)?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join(" ");
  return "";
}

/** Extract the customer's own texts (latest last) from a chat message list. */
export function customerTexts(messages: unknown[] | null | undefined, limit = 8): string[] {
  const out: string[] = [];
  for (const m of messages ?? []) {
    if ((m as any)?.role && (m as any).role !== "user") continue;
    const t = textOf(m).trim();
    if (t) out.push(t.slice(0, 400));
  }
  return out.slice(-limit);
}

function detectAddress(t: string): AddressTerm | null {
  const s = t.toLowerCase();
  if (/(আপু|apu\b|sister|বোন)/.test(s)) return "apu";
  if (/(ভাইয়া|ভাই|bhaiya|vaiya|\bbhai\b|\bvai\b|\bbro\b)/.test(s)) return "bhaiya";
  if (/(স্যার|\bsir\b)/.test(s)) return "sir";
  if (/(ম্যাডাম|madam|ma'?am)/.test(s)) return "madam";
  return null;
}

const CASUAL = /(\btui\b|\btumi\b|\btomar\b|তুমি|তোমার|তুই|তোর)/i;

/**
 * Latest message decides language (customers switch scripts mid-chat), while
 * address term / formality / emoji are remembered from the whole history so
 * the voice never jumps between messages.
 */
export function deriveCustomerStyle(history: string[], latest?: string | null): CustomerStyle {
  const texts = [...history];
  const last = (latest ?? "").trim();
  if (last && texts[texts.length - 1] !== last) texts.push(last);
  const recent = texts.slice(-8);
  const langSource = last || recent[recent.length - 1] || "";
  let address: AddressTerm = "neutral";
  for (let i = recent.length - 1; i >= 0; i--) {
    const a = detectAddress(recent[i]);
    if (a) { address = a; break; }
  }
  const avgLen = recent.length ? recent.reduce((n, t) => n + t.length, 0) / recent.length : 0;
  return {
    language: detectReplyStyle(langSource),
    address,
    formality: recent.some((t) => CASUAL.test(t)) ? "casual" : "respectful",
    usesEmoji: recent.some((t) => EMOJI.test(t)),
    brief: avgLen > 0 && avgLen < 40,
  };
}

const ADDRESS_WORD: Record<ReplyStyle, Record<Exclude<AddressTerm, "neutral">, string>> = {
  bn: { bhaiya: "ভাইয়া", apu: "আপু", sir: "স্যার", madam: "ম্যাডাম" },
  banglish: { bhaiya: "bhaiya", apu: "apu", sir: "sir", madam: "madam" },
  en: { bhaiya: "brother", apu: "sister", sir: "sir", madam: "madam" },
};

/** One compact persona block shared by every agent — the single voice. */
export function personaInstruction(style: CustomerStyle, opts?: { allowEmoji?: boolean }): string {
  const lines: string[] = [];
  if (style.language === "bn") lines.push("LANGUAGE: Reply ONLY in natural Bangla script.");
  else if (style.language === "banglish")
    lines.push('LANGUAGE: Reply ONLY in Banglish (Bangla in English letters, e.g. "Ji, dam 500 tk."). Never English sentences or Bangla script.');
  else lines.push("LANGUAGE: Reply in English.");
  if (style.address !== "neutral")
    lines.push(`ADDRESS: The customer prefers "${ADDRESS_WORD[style.language][style.address]}" — use it occasionally, never every sentence.`);
  lines.push(
    style.language === "bn"
      ? "TONE: Always use respectful আপনি form; warm, same voice every message."
      : "TONE: Polite, warm, same voice every message.",
  );
  const emoji = (opts?.allowEmoji ?? true) && style.usesEmoji;
  lines.push(emoji ? "EMOJI: At most one light emoji, matching the customer." : "EMOJI: No emojis.");
  if (style.brief) lines.push("The customer writes briefly — keep replies short.");
  lines.push("PERSONA: You are one consistent shop assistant; never mention agents, systems, transfers or AI internals.");
  return lines.join(" ");
}
