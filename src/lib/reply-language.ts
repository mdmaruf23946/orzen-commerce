// Detects the writing style of a chat message (Bangla script, Banglish, English)
// so every AI channel can mirror the customer's own style.
export type ReplyStyle = "bn" | "banglish" | "en";

const BANGLISH_WORDS = new Set(
  "ami apni apnar amar tumi tomar tui ki keno kemon kamon achen acho achi ase ache asen asi hobe hbe hoy hoi hoise hoyeche hocche korbo korben koren koro kori korte korsi koro dibo diben dao den dien nibo niben nite nen lagbe lagbo lage dam koto kto taka tk vai bhai bro apu vaiya bhaiya bhalo valo bhai ji jii accha acha thik ase na nai nei ar r kivabe kibhabe kothay kobe kokhon jodi tahole tai eta ota oita sei ekta duita dekhan dekhao dekhi bolen bolo bolun janan jante chai chaisi chacchi pabo paben pathan pathao pathiye order delivery charge khobor khabar shuvo shubho dhonnobad thanks plz pls".split(
    /\s+/,
  ),
);

// Common English words. Used to spot "broken English" messages like
// "customise number need" — these are written by Bangla speakers in roman
// letters, so the reply should be Banglish, not formal English.
const COMMON_ENGLISH = new Set(
  "a an the is are was were am be been being i you he she it we they me him her us them my your his its our their this that these those there here what when where who whom which why how can could will would shall should may might must do does did done have has had not no yes and or but if then else so too very just only also of in on at by for with about into over under again once more most other some any each few all both same own than as out up down off to from hello hi hey ok okay please thank yes yeah nope need needs wanted want get got give take make made buy buying sell price cost send sent pay paid payment cash cod bkash nagad number mobile phone address name home inside outside dhaka chittagong sylhet product products item items color colour size red blue black white green new old good bad nice best cheap stock available unavailable now today tomorrow yesterday sir madam help support account login password email page website link photo picture image video call do ship shipping internationally return refund policy exchange warranty guarantee much many long far near available".split(
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
  // Mixed / broken-English messages (e.g. "customise number need"): when most
  // words are not common English, the writer is almost always a Bangla
  // speaker typing in roman letters — answer in Banglish, not formal English.
  const englishHits = words.filter((w) => COMMON_ENGLISH.has(w)).length;
  if (words.length >= 2 && englishHits / words.length < 0.75) return "banglish";
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
