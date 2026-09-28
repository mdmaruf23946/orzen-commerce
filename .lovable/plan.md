# ধাপ ৩: ডিপ রেসপন্স ফায়ারওয়াল ও কনভারসেশনাল অর্ডার ইঞ্জিন

## যাচাই করা বর্তমান অবস্থা
- সাইজ/কালার আলাদা টেবিলে নেই — প্রতিটা পণ্যের ভেতরেই `variants` তালিকায় থাকে। `checkStock` টুল ভ্যারিয়েন্ট স্টক দেখতে পারে, কিন্তু উত্তর পাঠানোর আগের গার্ড (reply guard) শুধু টাকা আর সাধারণ "স্টকে আছে" মেলায় — সাইজ/কালার মেলায় না।
- "store_settings" নামে কিছু নেই। সত্য তথ্যের উৎস: ডেলিভারি এলাকা (চার্জ + সময় `eta`), পণ্যের নিজস্ব `delivery_time_days` / `return_policy`, আর দোকানের রিটার্ন সেটিংস।
- Buy Now: কোন তথ্য বাকি তা হিসাব করা হয় (`missing`), কিন্তু মেসেজে সেটা ব্যবহার হয় না — তাই ফোন/ঠিকানা আগে দেওয়া থাকলেও আবার সব চাওয়া হয়। Messenger-এ অন্তত ২ জায়গায় এটা ঘটে।

## কী তৈরি হবে

### ১. সাইজ/কালার ফায়ারওয়াল
- উত্তরে যে পণ্যের কথা হচ্ছে, তার আসল ভ্যারিয়েন্ট তালিকা দোকানের ডাটা থেকে আনা হবে (শুধু সেই দোকানের)।
- AI যদি বলে "M সাইজ আছে" অথচ M নেই বা স্টক ০ → সেই বাক্য বদলে "M এই মুহূর্তে নেই, পাওয়া যাচ্ছে: L, XL" ধরনের সঠিক লাইন।
- বাংলা/ইংরেজি দুই রকম লেখাই ধরবে (লাল/Red, এম/M, এক্সএল/XL)। ডিজিটাল/সার্ভিস পণ্য বাদ।

### ২. ডেলিভারি সময় ও রিটার্ন পলিসি গার্ড
- নতুন টুল `getStorePolicy` (ডেলিভারি সময় + রিটার্ন নিয়ম), দোকানের আসল সেটিংস থেকে।
- AI যদি টুল ছাড়া "২ দিনে ডেলিভারি" বা "৭ দিনের রিটার্ন" বলে আর তা সেটিংসের সাথে না মেলে → সেই বাক্য সরিয়ে সঠিক তথ্য বসানো; তথ্য সেট না থাকলে "দোকান থেকে নিশ্চিত করে জানাচ্ছি"। রিটার্ন বন্ধ থাকলে কখনো "রিটার্ন দেওয়া যাবে" বলবে না।
- সাধারণ "ডেলিভারি কতদিনে লাগে?" / "রিটার্ন দেওয়া যায়?" প্রশ্নে AI ছাড়াই দ্রুত উত্তর (fast path), দুই চ্যানেলেই।

### ৩. স্মার্ট Buy Now (শুধু বাকি তথ্য চাওয়া)
- আগে দেওয়া নাম/ফোন/ঠিকানা/এলাকা মনে রেখে, মেসেজে শুধু যা বাকি সেটাই চাওয়া হবে ("শুধু আপনার ঠিকানাটা দিন")।
- যা পেয়েছি তা ছোট করে দেখানো হবে যাতে কাস্টমার ভুল ধরতে পারেন।
- সব থাকলে সরাসরি "কনফার্ম করতে হ্যাঁ লিখুন"। Messenger ও WhatsApp দুটোতেই।

## যা বদলাবে না
অর্ডার তৈরি, স্টক রিজার্ভ, ডুপ্লিকেট ব্লক, দামের গার্ড, ছবি মেলানো, কিউ — আগের মতো।

## পরীক্ষা
- গার্ডে জোর করে ভুল সাইজ/ভুল রিটার্ন-দিন দিয়ে দেখা যে ঠিক হয়।
- Buy Now: শুধু ফোন দেওয়া থাকলে শুধু ঠিকানা চাইছে কিনা।
- বিল্ড চেক, wrangler দিয়ে orzen.top-এ ডিপ্লয়, parity check। আসল চ্যানেলে যা পরীক্ষা হয়নি তা স্পষ্ট জানানো হবে।

## Technical details
- `reply-guard.server.ts`: `guardVariants(text, variants)` — parse `products.variants` (array of {name/options, stock}), normalize bn/en size+color tokens, rewrite claimed-but-absent/0-stock options; loads focus product store-scoped. `guardPolicy(text, policy)` — regex for day counts near ডেলিভারি/delivery and রিটার্ন/return/exchange; compare with zone `eta`, product `delivery_time_days`, `store_return_settings` (enabled, window).
- `ai-agent.server.ts`: add `getStorePolicy` tool; its output feeds `collectVerifiedFacts` (new `policy` field).
- `fast-path.server.ts`: delivery-time + return-policy intents.
- `chat-order-format.ts`: `buildBuyNowMessage` accepts `missing` + `known`; call sites in `messenger-webhook.server.ts` (~1653, ~1785) and WhatsApp equivalents pass them.
- No schema change. Update `AGENTS.md` guard rule.
