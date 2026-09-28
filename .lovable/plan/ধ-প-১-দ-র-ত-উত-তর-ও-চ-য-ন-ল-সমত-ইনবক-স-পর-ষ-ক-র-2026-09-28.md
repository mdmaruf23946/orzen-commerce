# ধাপ ১: দ্রুত উত্তর ও চ্যানেল সমতা + ইনবক্স পরিষ্কার

## লক্ষ্য
- Messenger-এও WhatsApp-এর মতো সালাম, ধন্যবাদ, অর্ডার স্ট্যাটাস এবং সাধারণ ডেলিভারি চার্জের প্রশ্নে AI ছাড়াই সঙ্গে সঙ্গে উত্তর যাবে।
- মার্চেন্টের Messenger ও WhatsApp চ্যাট স্ক্রিনে ভেতরের সিস্টেম নোট (উত্তর যাচাইয়ের নোট) আর দেখা যাবে না।

## কী করা হবে
1. **Messenger দ্রুত উত্তর** — Messenger-এর লেখা মেসেজের ধাপে, AI চালু হওয়ার আগেই WhatsApp-এর মতো একই দ্রুত-উত্তরের ব্যবস্থা চলবে। নিশ্চিত না হলে আগের মতোই AI উত্তর দেবে (কিছু ভাঙবে না)। Human takeover, মার্চেন্ট-পরিচয়, ছবি, Buy Now — এসবের পরে এই ধাপ চলবে, তাই আগের নিয়ম বদলাবে না।
2. **ডেলিভারি চার্জের দ্রুত উত্তর (দুই চ্যানেলেই)** — "ডেলিভারি চার্জ কত" জাতীয় প্রশ্নে দোকানের সংরক্ষিত ডেলিভারি চার্জ থেকে সরাসরি উত্তর। শুধু তখনই, যখন দাম স্পষ্ট (যেমন ঢাকার ভেতর/বাইরে দুটো নির্দিষ্ট চার্জ)। এলাকা অস্পষ্ট বা চার্জ সেট না থাকলে AI-এর কাছে যাবে — কোনো দাম বানানো হবে না।
3. **ইনবক্স পরিষ্কার** — Messenger ও WhatsApp ইনবক্সে মেসেজ লোড করার সময় সিস্টেম-যাচাই নোট বাদ দেওয়া হবে। নোটগুলো ডাটাবেজে থাকবে (Owner-এর Performance পাতায় ও তদন্তে কাজে লাগবে), শুধু মার্চেন্টের চ্যাটে দেখাবে না। ইনবক্সের শেষ-মেসেজ প্রিভিউতেও সেগুলো আসবে না।

## যাচাই
- বিল্ড সফল হওয়া।
- দুই চ্যানেলের দ্রুত-উত্তর ফাংশন সরাসরি পরীক্ষা: "Hi", "আসসালামু আলাইকুম", "ok thank you", "ডেলিভারি চার্জ কত", অস্পষ্ট প্রশ্ন (AI-তে যাওয়া উচিত)।
- Messenger কাজের রেকর্ডে route = fast দেখা ও সময় মাপা।
- ইনবক্সে সিস্টেম নোট আর না দেখা।
- তারপর orzen.top-এ wrangler পদ্ধতিতে deploy ও লাইভ চেক (Lovable Publish নয়)।

## Technical details
- `src/lib/messenger-webhook.server.ts`: text branch-এ AI context load-এর আগে `tryFastPath(sb, { storeId, conversationId, text, customerPhone })` (Messenger-এ phone = conversation/customer memory থেকে জানা থাকলে); hit হলে বিদ্যমান send+log helper দিয়ে পাঠানো, `messenger_jobs.reply_text` ও `route: fast:<kind>` আপডেট, `setTraceMeta("route","fast")`। try/catch → fall through to AI।
- `src/lib/fast-path.server.ts`: নতুন `delivery_charge` kind; ডেটা আসবে সেই একই store-scoped উৎস থেকে যা `getDeliveryCharge` tool ব্যবহার করে (reply-guard নিয়ম মেনে)। অস্পষ্ট হলে `null`।
- `src/lib/messenger-inbox.functions.ts` ও `src/lib/whatsapp-inbox.functions.ts`: message list ও last-message query-তে `.neq("message_type","guard")` (null-safe: `or(message_type.is.null,message_type.neq.guard)`)।
- DB schema পরিবর্তন নেই।
