# ধাপ ৪: কল হিস্ট্রি ও অ্যানালিটিক্স

সব কাজ AI Call Center-এর ভেতরেই হবে। নতুন কোনো মেনু যোগ হবে না।

## ১. Overview-এ অ্যানালিটিক্স কার্ড
উপরে একটা সময়ের বাছাই থাকবে: আজ / ৭ দিন / ৩০ দিন / নিজে তারিখ বেছে নেওয়া। তার নিচে ৪টা কার্ড:
- **মোট কল:** সব কল, পাশে ছোট করে লেখা থাকবে কতগুলো অটো কল আর কতগুলো হাতে করা কল।
- **Confirmed Rate %:** অটো কলে যত অর্ডারে কল গেছে, তার মধ্যে কত শতাংশ ১ চেপে কনফার্ম করেছে।
- **Cancelled / Failed %:** ২ চেপে বাতিল, অথবা ফোন ধরেনি, ব্যস্ত ছিল বা কল যায়নি।
- **আনুমানিক কল খরচ:** মোট কথা বলার মিনিট × আপনার দেওয়া প্রতি মিনিটের রেট (প্রতিটা কলের মিনিট উপরের দিকে রাউন্ড করে)। ePBX খরচের হিসাব পাঠায় না, তাই কার্ডে "আনুমানিক" লেখা থাকবে।
- Settings-এ নতুন একটা ঘর থাকবে: **"Call rate (৳ per minute)"**। খালি থাকলে খরচের কার্ডে লেখা থাকবে "Set your call rate in Settings"।
- কার্ডের নিচে একটা ছোট বার: Answered / No answer / Busy / Failed কোনটা কতগুলো।

## ২. Calls & History-তে বিস্তারিত কল লগ
একটাই তালিকা, যেখানে প্রতিটা কলের জন্য একটা লাইন থাকবে:
- অর্ডার নম্বর (চাপলে অর্ডার খুলবে), কাস্টমারের নাম ও ফোন।
- তারিখ ও সময় (বাংলাদেশ সময়)।
- কলের ধরন: Auto verification / Manual / Retry (কততম চেষ্টা)।
- কল রিসিভ হয়েছে কিনা: রঙিন ব্যাজে Answered / No answer / Busy / Failed / Calling।
- কতক্ষণ কথা হয়েছে (যেমন "০:২৩")।
- কোন বোতাম চাপা হয়েছে: "1 — Confirmed", "2 — Cancelled", অথবা "—"।
- রেকর্ডিং থাকলে লাইনেই একটা ছোট প্লে বোতাম, চাপলে অডিও বাজবে। রেকর্ডিং আগের মতোই সুরক্ষিত লিংকে চলবে, যা ২ ঘণ্টা পর বন্ধ হয়ে যায়।
- ফিল্টার: সময়, অবস্থা, কলের ধরন, শুধু রেকর্ডিং আছে এমন কল, আর ফোন বা অর্ডার নম্বর দিয়ে খোঁজা।
- একবারে ৫০টা কল দেখাবে, নিচে "আরও দেখুন" বোতাম।
- CSV ডাউনলোড বোতাম, যাতে পুরো তালিকা ফাইলে নামিয়ে নিতে পারেন।

## যাচাই
- আগে টেস্ট সিস্টেমে কয়েকটা নকল কল বসিয়ে দেখব কার্ডের সংখ্যা, শতাংশ আর খরচ ঠিক আসে কিনা। টেস্ট ডেটা পরে মুছে দেব।
- কোড চেক করা, orzen.top-এ চালু করা, আর লাইভ পেজ খুলছে কিনা দেখা।
- লগইন করে পেজটা চোখে দেখতে পেরেছি কিনা, শেষে স্পষ্ট করে জানাব।
- আপনার অ্যাকাউন্টে এখনো কোনো আসল কল হয়নি, তাই লাইভে তালিকা খালি দেখাবে।

## Technical details
- Migration (Cloud + prod): `voice_automation_settings.call_rate_per_min numeric` (nullable) + index `calls(store_id, created_at desc)`.
- New `src/lib/voice-analytics.functions.ts` (requireSupabaseAuth, owned-store scoped):
  - `getCallAnalytics({from,to})`: aggregates `calls` for the store/range: totals by status and call_type; confirmed% = auto calls with result order_confirmed / distinct auto-call orders; cost = Σ ceil(duration_sec/60) × rate.
  - `listCallLogs({from,to,status?,type?,hasRecording?,q?,offset})`: joins `orders(invoice_no)`, returns dtmf, duration, retry_count, and a signed recording URL via the existing `/api/public/voice/recording` signer for rows with `recording_ref`.
- UI: `CallAnalyticsCards` in Overview, `CallLogTable` in Calls & History (replaces the duplicate AutomatedOrderCalls placement there; Overview keeps the retry view). Settings form + zod: `call_rate_per_min` (0–100, optional).
- CSV built client-side from paged fetches (max 2000 rows).
