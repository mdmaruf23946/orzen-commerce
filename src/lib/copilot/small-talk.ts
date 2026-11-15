// Instant replies for pure greetings/small talk so the Co-pilot answers
// without calling the AI model. Returns null when the message needs the model.
const SALAM = /(আস্?সালাম[ুু]?(য়?ালাইকুম)?|সালাম|as+alam[ua]?(alaikum)?|salam|\bslm\b)/i;
const HOW = /(কেমন আছেন|কেমন আছো|কেমন আছ|kemon ach|kmn ach|kmon as|how are you)/i;
const HI = /^(hi+|hello+|hey+|hlw|helo|হাই|হ্যালো|হেলো|হেই)$/i;
const THANKS = /^(ধন্যবাদ|থ্যাংক(স|ইউ)?|thanks|thank you|thx|tnx|জাযাকাল্লাহ|jazakallah)( খায়ের| khair)?$/i;
const FILLER = /(ভাই|bhai|vai|apu|আপু|স্যার|sir|bro|জি|জ্বি|ji|আলাইকুম|alaikum|alaykum|ওয়া|রহমাতুল্লাহ|rahmatullah|বারাকাতুহ|barakatuh|[\s!.,?।]+)/gi;

export function smallTalkReply(text: string): string | null {
  const t = text.trim().toLowerCase();
  if (!t || t.length > 80) return null;
  const salam = SALAM.test(t), how = HOW.test(t);
  // Anything left after removing greeting words means a real question.
  const rest = t.replace(SALAM, "").replace(HOW, "").replace(FILLER, "").trim();
  if (salam || how) {
    if (rest && !HI.test(rest)) return null;
    const parts: string[] = [];
    if (salam) parts.push("ওয়ালাইকুম আসসালাম।");
    if (how) parts.push("আলহামদুলিল্লাহ, ভালো আছি।");
    parts.push("বলুন, আপনার ব্যবসা বা স্টোরের কোন বিষয়ে সাহায্য করতে পারি?");
    return parts.join(" ");
  }
  const bare = t.replace(/[!.,?।\s]+$/g, "");
  if (HI.test(bare)) return "হ্যালো! বলুন, আজ কোন বিষয়ে সাহায্য করতে পারি?";
  if (THANKS.test(bare)) return "আপনাকেও ধন্যবাদ! আর কিছু লাগলে বলবেন।";
  return null;
}
