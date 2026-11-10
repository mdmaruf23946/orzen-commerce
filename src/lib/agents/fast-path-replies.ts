// Human-sounding reply variations for fast-path small talk. Pure module
// (no I/O) so it can be unit-tested. Only safe social replies live here —
// never prices, stock, delivery or order facts.

export type SmallTalkKind = "greeting" | "thanks" | "how_are_you" | "bye" | "time_greeting";

const end = "[\\s!.।,?😊🙂❤️👍]*$";
const mk = (body: string) => new RegExp(`^(?:${body})${end}`, "i");

export const SMALL_TALK: Record<SmallTalkKind, RegExp> = {
  greeting: mk(
    "hi+|hello+|hey+|hlw|helo|hii+|assalamu? ?alaikum|assalamualaikum|asalamu ?alaikum|as-?salamu ?alaikum|salam|slm|আসসালামু ?আলাইকুম|আসসালামুয়ালাইকুম|সালাম|হাই|হ্যালো|হেলো|হেই",
  ),
  // Bare "ok"/"আচ্ছা"/"ঠিক আছে" is intentionally NOT here: it can be an answer
  // to an order question, so it always goes to the AI.
  thanks: mk(
    "(?:ok+|okay|ওকে|আচ্ছা)[\\s,]+(?:thanks?|thank you|ধন্যবাদ)|thanks?(?: a lot| so much)?|thank you(?: so much| vai| bhai| apu)?|thx|tnx|ty|dhonnobad|ধন্যবাদ(?: ভাই| আপু| ভাইয়া)?|অনেক ধন্যবাদ|থ্যাংকস?|থ্যাঙ্কস|থ্যাঙ্ক ইউ|জাজাকাল্লাহ(?: খাইরান)?|jazakallah(?: khair(?:an)?)?",
  ),
  how_are_you: mk(
    "how are you|how r u|kemon achen|kmn achen|kemon acho|কেমন আছেন|কেমন আছো|ভালো আছেন|ভাল আছেন",
  ),
  bye: mk("bye+|good ?bye|allah hafez|আল্লাহ হাফেজ|বাই|খোদা হাফেজ|khoda hafez|see you"),
  time_greeting: mk("good (?:morning|evening|afternoon|night)|শুভ (?:সকাল|সন্ধ্যা|রাত্রি|দুপুর)|gm|gn"),
};

export function detectSmallTalk(text: string): SmallTalkKind | null {
  const t = text.trim();
  for (const k of Object.keys(SMALL_TALK) as SmallTalkKind[]) if (SMALL_TALK[k].test(t)) return k;
  return null;
}

type Pool = { bn: string[]; en: string[] };

// {store} → " <Store Name>-এ" (bn) / " to <Store Name>" (en), or "" when unknown.
const POOLS: Record<SmallTalkKind, Pool> = {
  greeting: {
    bn: [
      "ওয়ালাইকুম আসসালাম!{store} আপনাকে স্বাগতম। কোন পণ্যটি খুঁজছেন বলুন, বা ছবি পাঠান।",
      "ওয়ালাইকুম আসসালাম! কেমন আছেন?{store} স্বাগতম। কী খুঁজছেন জানালে সাহায্য করতে পারি।",
      "ওয়ালাইকুম আসসালাম! জি বলুন, কীভাবে সাহায্য করতে পারি? পণ্যের নাম লিখুন বা ছবি দিন।",
      "ওয়ালাইকুম আসসালাম!{store} আপনাকে পেয়ে ভালো লাগলো। কোন পণ্যটি দেখতে চান?",
    ],
    en: [
      "Hello! Welcome{store}. What are you looking for? Type a product name or send a photo.",
      "Hi there! How can I help you today? Share a product name or a photo.",
      "Hello and welcome{store}! Tell me what you're looking for and I'll help.",
    ],
  },
  thanks: {
    bn: [
      "আপনাকেও ধন্যবাদ! আর কিছু লাগলে জানাবেন।",
      "আপনাকেও অনেক ধন্যবাদ। যেকোনো প্রয়োজনে মেসেজ দিবেন।",
      "স্বাগতম! আর কোনো সাহায্য লাগলে বলবেন।",
      "ধন্যবাদ আপনাকেও! আমরা সবসময় পাশে আছি।",
    ],
    en: [
      "You're welcome! Let us know if you need anything else.",
      "Happy to help! Message us anytime.",
      "Our pleasure! Feel free to ask if you need anything more.",
    ],
  },
  how_are_you: {
    bn: [
      "আলহামদুলিল্লাহ, ভালো আছি। আপনি কেমন আছেন? কোন পণ্যটি খুঁজছেন বলুন।",
      "জি, ভালো আছি, ধন্যবাদ! আপনাকে কীভাবে সাহায্য করতে পারি?",
      "আলহামদুলিল্লাহ ভালো। আপনার জন্য কী করতে পারি বলুন?",
    ],
    en: [
      "I'm doing well, thank you! How can I help you today?",
      "All good, thanks for asking! What are you looking for?",
    ],
  },
  bye: {
    bn: [
      "আল্লাহ হাফেজ! আবার আসবেন।",
      "ধন্যবাদ, আল্লাহ হাফেজ! প্রয়োজনে যেকোনো সময় মেসেজ দিবেন।",
      "ভালো থাকবেন! আবার কথা হবে।",
    ],
    en: ["Goodbye! Hope to see you again.", "Take care! Message us anytime.", "Bye! Have a great day."],
  },
  time_greeting: {
    bn: [
      "আপনাকেও শুভেচ্ছা!{store} স্বাগতম। কীভাবে সাহায্য করতে পারি?",
      "শুভেচ্ছা রইলো! কোন পণ্যটি খুঁজছেন বলুন।",
    ],
    en: ["Same to you! Welcome{store}. How can I help?", "Hello, same to you! What are you looking for?"],
  },
};

/** Stable-but-varied index: differs per conversation and over time. */
export function pickIndex(len: number, seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return Math.abs(h) % len;
}

export function smallTalkReply(
  kind: SmallTalkKind,
  opts: { bn: boolean; storeName?: string | null; seed: string },
): string {
  const pool = opts.bn ? POOLS[kind].bn : POOLS[kind].en;
  const raw = pool[pickIndex(pool.length, opts.seed)];
  const name = (opts.storeName ?? "").trim();
  const store = name ? (opts.bn ? ` ${name}-এ` : ` to ${name}`) : "";
  return raw.replace("{store}", store).replace(/\s+([,!.])/g, "$1").replace(/\s{2,}/g, " ").trim();
}

export const SMALL_TALK_POOL_SIZES = Object.fromEntries(
  (Object.keys(POOLS) as SmallTalkKind[]).map((k) => [k, POOLS[k].bn.length + POOLS[k].en.length]),
);

// ---- No-data chit-chat agent: answers social messages that need NO store
// facts, without any AI call (0 tokens). Returns null when the message has
// any commerce intent so it never hides a real question.
const COMMERCE = /(দাম|price|dam|daam|টাকা|tk|stock|স্টক|অর্ডার|order|অডার|ডেলিভারি|delivery|চার্জ|charge|কালার|color|রং|সাইজ|size|পণ্য|প্রোডাক্ট|product|ছবি|photo|pic|আছে কি|আছে\?|ache|track|ট্র্যাক|ফেরত|return|বিকাশ|bkash|নগদ|nagad|ঠিকানা|address|নাম্বার|\d{4,}|[০-৯]{4,})/i;
const CHAT: Array<[RegExp, string]> = [
  [/(কেমন আছ|কেমন আছেন|কেমন আছো|kemon ach|kmn ach|kmon as|how are you|how r u)/i, "আলহামদুলিল্লাহ ভালো আছি, ধন্যবাদ 😊 আপনি কেমন আছেন? বলুন, কীভাবে সাহায্য করতে পারি?"],
  [/(কি খবর|কী খবর|ki khobor|ki obostha|কি অবস্থা|কী অবস্থা|what'?s up|wassup)/i, "আলহামদুলিল্লাহ সব ভালো 😊 বলুন, আপনার জন্য কী করতে পারি?"],
  [/(কি কর|কী কর|ki koro|ki korcho|ki koren)/i, "আপনার মতো কাস্টমারদের সাহায্য করছি 😊 বলুন, কী খুঁজছেন?"],
  [/(তুমি কে|আপনি কে|tumi ke|apni ke|who are you|bot|রোবট|robot)/i, "আমি এই স্টোরের সহকারী 😊 পণ্য, দাম, ডেলিভারি বা অর্ডার — যেকোনো বিষয়ে জিজ্ঞেস করুন।"],
  [/^(ভালো আছি|ভাল আছি|valo achi|bhalo achi|alhamdulillah|আলহামদুলিল্লাহ)[\s!.।😊🙂]*/i, "শুনে ভালো লাগলো 😊 বলুন, কীভাবে সাহায্য করতে পারি?"],
  [/^(hm+|হুম+|ওহ|oh|wow|nice|good|great|বাহ|সুন্দর|😊|🙂|👍|❤️|😍)[\s!.।]*$/i, "😊 আর কিছু জানতে চাইলে বলুন।"],
];
export function noDataChatReply(text: string): string | null {
  const t = (text ?? "").trim();
  if (!t || t.length > 60 || COMMERCE.test(t)) return null;
  const kind = detectSmallTalk(t);
  if (kind) return smallTalkReply(kind, { bn: /[\u0980-\u09FF]/.test(t) || !/[a-z]/i.test(t), seed: t });
  for (const [re, reply] of CHAT) if (re.test(t)) return reply;
  return null;
}
