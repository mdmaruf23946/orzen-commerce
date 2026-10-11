// Detects the writing style of a chat message (Bangla script, Banglish, English)
// so every AI channel can mirror the customer's own style.
export type ReplyStyle = "bn" | "banglish" | "en";

const BANGLISH_WORDS = new Set(
  "ami apni apnar amar tumi tomar tui ki kি keno kemon kamon achen acho achi ase ache asen asi hobe hbe hoy hoi hoise hoyeche hocche korbo korben koren koro kori korte korsi koro dibo diben dao den dien nibo niben nite nen lagbe lagbo lage dam koto kto taka tk vai bhai bro apu vaiya bhaiya bhalo valo bhai ji jii accha acha thik ase na nai nei ar r kivabe kibhabe kothay kobe kokhon jodi tahole tai eta ota oita sei ekta duita dekhan dekhao dekhi bolen bolo bolun janan jante chai chaisi chacchi pabo paben pathan pathao pathiye order delivery charge khobor khabar shuvo shubho dhonnobad thanks plz pls".split(
    /\s+/,
  ),
);

export function detectReplyStyle(text: string | null | undefined): ReplyStyle {
  const t = String(text ?? "");
  if (/[\u0980-\u09FF]/.test(t)) return "bn";
  const words = t.toLowerCase().match(/[a-z]+/g) ?? [];
  if (!words.length) return "bn";
  const hits = words.filter((w) => BANGLISH_WORDS.has(w) && !["order", "delivery", "charge", "thanks", "plz", "pls"].includes(w)).length;
  if (hits >= 1 && hits / words.length >= 0.2) return "banglish";
  return "en";
}

export function replyStyleInstruction(text: string | null | undefined): string {
  const s = detectReplyStyle(text);
  if (s === "bn") return "LANGUAGE: The customer wrote in Bangla script. Reply ONLY in natural Bangla script.";
  if (s === "banglish")
    return "LANGUAGE: The customer wrote in Banglish (Bangla in English letters, e.g. \"kemon achen\", \"dam koto\"). Reply ONLY in the same Banglish style (e.g. \"Ji, ei product er dam 500 tk.\"). Never reply in English sentences or Bangla script.";
  return "LANGUAGE: The customer wrote in English. Reply in English.";
}

export const SHORT_REPLY_RULE =
  "LENGTH: Keep every reply short — 1 to 3 short sentences (about 50 words max). No long lists, no long intros, no repeated offers. Give details only if the customer asks.";
