# চ্যাট এজেন্টকে "বুঝে নিতে" শেখানো — নাম/ঠিকানা ভুল ধরা বন্ধ

## আসলে কী হয়েছিল (লাইভ চ্যাট ও অর্ডার দেখে নিশ্চিত)
1. আপনি লিখেছিলেন "ডেলিভারি **সার্চ** কত" ("চার্জ"-এর জায়গায় "সার্চ")। বানান আলাদা হওয়ায় দ্রুত-উত্তরের নিয়মটা এটা চিনতে পারেনি, তাই প্রশ্নটা AI-এর কাছে গেছে। AI সরাসরি চার্জ না বলে ঠিকানা চেয়েছে, আর উত্তরটা এসেছে প্রায় **২ মিনিট পরে** (আপনার পরের "হেই"-এর উত্তরের সাথে এলোমেলো হয়ে)।
2. বড় সমস্যা: প্রতিটা মেসেজে একটা পুরোনো নিয়ম চলে — "কমা ছাড়া ছোট একটা লাইন থাকলেই সেটা নাম"। তাই "ডেলিভারি সার্চ কত" লাইনটা চুপচাপ **নাম হিসেবে সেভ হয়ে গেছে**। পরে Buy Now চাপলে সেই নামটাই ধরে নিয়ে শুধু ফোন নম্বর চেয়েছে, তারপর অর্ডার হয়ে গেছে।
3. ঠিকানা দেওয়ার পর (চট্টগ্রাম) বলা উচিত ছিল "ঢাকার বাইরে ডেলিভারি চার্জ ৳১২০"। সেটা না বলে জিজ্ঞেস করেছে "কোন প্রোডাক্ট নিবেন? ?" (প্রশ্নবোধক চিহ্নও দুইবার)।
4. আরেকটা ভুল পাওয়া গেছে: মার্চেন্ট প্যানেলের Order Details-এ ডেলিভারি চার্জ **দুইবার যোগ হয়ে দেখাচ্ছে** (দেখাচ্ছে ৳১২২০, আসল মোট ৳১১০০ = ৯৮০ + ১২০)। অর্ডারে সঠিক ৳১১০০-ই সেভ আছে, শুধু দেখানোটা ভুল।

## কী ঠিক হবে

### ক) কোনো কিছু আন্দাজে নাম/ঠিকানা হিসেবে সেভ হবে না
- নাম সেভ হবে শুধু তখন, যখন:
  - আপনি স্পষ্ট লিখেছেন "নাম: ...", বা
  - এজেন্ট নাম চেয়েছিল আর তার ঠিক পরের উত্তরে নামের মতো কিছু এসেছে, বা
  - অর্ডারের নম্বর দেওয়া তালিকা (১) নাম ২) নম্বর ৩) ঠিকানা) মেনে উত্তর দিয়েছেন।
- "নাম পরীক্ষা": প্রশ্ন (কত, কি, কেন, কোথায়, ?), দোকানের শব্দ (ডেলিভারি, চার্জ, দাম, অর্ডার, সাইজ, টাকা...), সালাম/হাই, সংখ্যা, লিংক বা ৪-৫ শব্দের বেশি থাকলে সেটা কখনোই নাম হবে না।
- ঠিকানার জন্যও একই কড়াকড়ি: প্রশ্ন বা সাধারণ কথা ঠিকানা হবে না।
- আগে থেকে সেভ হয়ে থাকা ভুল নাম (যেমন "ডেলিভারি সার্চ কত") Buy Now-এর সময় বাদ দেওয়া হবে, আবার নাম চাওয়া হবে।

### খ) ভুল বানান বুঝে নেবে, সন্দেহ হলে জিজ্ঞেস করবে
- সাধারণ ভুল বানানের তালিকা: সার্চ/চাজ/চার্য/চারজ → চার্জ, ডেলিবারি/ডেলিভারী → ডেলিভারি, koto/kto → কত, দাম/দাম কতো ইত্যাদি। এতে "ডেলিভারি সার্চ কত" সাথে সাথে দোকানের আসল চার্জ দিয়ে উত্তর পাবে, AI লাগবে না।
- অর্ডারের তথ্য নেওয়ার সময় যদি নিয়ম দিয়ে নিশ্চিত হওয়া না যায় (অর্ধেক লেখা, এলোমেলো লেখা), তখন একটা ছোট AI "বোঝার" ধাপ চলবে: লেখাটা নাম, ফোন, ঠিকানা, নাকি প্রশ্ন — আর কতটা নিশ্চিত।
  - নিশ্চিত হলে → সেভ করে এগোবে।
  - নিশ্চিত না হলে → জিজ্ঞেস করবে, যেমন: "আপনার নাম কি **রহিম**? নাকি অন্য কিছু বোঝাতে চেয়েছেন?"
- AI-এর নির্দেশনায় যোগ হবে: গ্রাহক ভুল বানানে লিখতে পারে, মানে বুঝে নাও; প্রশ্নকে কখনো নাম/ঠিকানা ধরবে না; সন্দেহ হলে ছোট করে জিজ্ঞেস করবে।

### গ) অর্ডার করার আগে তথ্য দেখিয়ে নিশ্চিত করা
- সব তথ্য আন্দাজে না, সরাসরি গ্রাহকের কাছ থেকে এলে আগের মতোই সাথে সাথে অর্ডার হবে।
- কোনো তথ্য নিয়ে সন্দেহ থাকলে অর্ডারের আগে একবার দেখাবে: "নাম: … / মোবাইল: … / ঠিকানা: … / মোট: ৳… — সব ঠিক থাকলে 'হ্যাঁ' লিখুন, ভুল থাকলে ঠিকটা লিখে দিন।"

### ঘ) আগের প্রশ্ন মনে রাখা
- ডেলিভারি চার্জ জিজ্ঞেস করার পর ঠিকানা দিলে, সেই এলাকার আসল চার্জ বলে দেবে (যেমন "চট্টগ্রাম — ঢাকার বাইরে, চার্জ ৳১২০"), তারপর পণ্যের কথা জিজ্ঞেস করবে।
- উত্তরে দুইবার "? ?" বা এরকম ছোটখাটো গোলমাল পরিষ্কার করা হবে।

### ঙ) মার্চেন্ট প্যানেলের মোট টাকা ঠিক করা
- Order Details-এ দেখাবে: পণ্যের দাম ৳৯৮০, ডেলিভারি ৳১২০, মোট ৳১১০০। অর্ডারের তথ্যে কোনো পরিবর্তন লাগবে না।

### চ) দেরির কারণ খুঁজে দেখা
- "ডেলিভারি সার্চ কত"-এর উত্তর ২ মিনিট দেরিতে কেন এসেছে (কোন AI কী ধীর বা ব্যস্ত ছিল) লগ দেখে বের করা হবে। সহজে ঠিক করা গেলে এখানেই করা হবে, না হলে কারণসহ জানানো হবে।

## যাচাই
- পুরো ঘটনাটা আবার চালানো হবে (লাইভ ডেটাবেস, টেস্ট মোডে — আসল মেসেজ কাউকে যাবে না): হেই → ডেলিভারি সার্চ কত → ঠিকানা → ছবি → Buy Now → ফোন। প্রত্যাশা: চার্জ সঠিক বলবে, নাম চাইবে, প্রশ্নটা নাম হবে না।
- আরও কিছু ভুল বানান ও অর্ধেক লেখা দিয়ে পরীক্ষা; সন্দেহজনক লেখায় "এটা কি বোঝাতে চেয়েছেন?" জিজ্ঞেস করে কিনা।
- WhatsApp-এও একই পরীক্ষা।
- বিল্ড + প্যারিটি চেক, তারপর আগের নিয়মে orzen.top-এ ডেপ্লয়। Lovable Cloud-এর ডেটায় হাত দেওয়া হবে না।
- আপনার আগের টেস্ট অর্ডারের নাম "ডেলিভারি সার্চ কত" — আপনি চাইলে সেটা ঠিক করে দেব, না হলে যেমন আছে থাকবে।

## Technical details
- `src/lib/messenger-webhook.server.ts` `parseOrderDetailsText`: remove the `firstNameLike` fallback for unsolicited text; accept name only from label match, numbered list, or when `pending_order.awaiting === "customer_name"` (set when the bot asks). Same gating for the free-text address fallback (`awaiting` includes address, or `looksLikeOrderDetails`).
- New shared `src/lib/slot-validate.ts`: `isLikelyPersonName`, `isLikelyAddress`, `sanitizeSlot` (drops invalid stored values). Used by Messenger parser, `collectOrderInfo` tool in `ai-agent.server.ts`, WhatsApp `patchPendingOrder`, and before `buildBuyNowMessage` / `finalizePendingMessengerOrder` / AI `finalizeOrder`.
- New `src/lib/text-normalize.ts`: Bangla/Banglish typo map + small edit-distance match for key terms; `tryFastPath` matches on normalized text (DELIVERY_Q, DELIVERY_TIME_Q, RETURN_Q).
- AI extraction fallback: `routedChatCompletion` (store's own keys, fast tier) returning `{kind, name, phone, address, confidence}` via JSON, only when awaiting details and rules are unsure; low confidence → confirmation question stored as `pending_order.confirm`. Failure → ask plainly, never guess.
- `buildSystemPrompt`: short rule block on typos/ambiguity; state block marks unconfirmed fields. When `last_question = delivery_charge` and a new address arrives, call `getDeliveryCharge` via `resolveDeliveryCharge`.
- Reply post-processing: collapse repeated `?`/`।` in the send path.
- `src/components/admin/OrderDetailsDrawer.tsx`: `orders.subtotal` stores the grand total (storefront, quick order and chat all do this); show items total from `items`, delivery, and Total = `order.subtotal`.
- Latency: inspect `messenger_jobs.timings` + provider breaker state for job 12:02:14 UTC.
- Record the name/address gating rule in `AGENTS.md`.
