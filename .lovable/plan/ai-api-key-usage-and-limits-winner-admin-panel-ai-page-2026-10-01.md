# AI API Key usage and limits (Winner Admin Panel → AI page)

## আপনি কী পাবেন
1. **প্রতিটা key-এর কার্ডে** (Connected keys তালিকায়) নতুন একটা ঘর:
   - আজ খরচ হয়েছে: কত token
   - এই মাসে খরচ হয়েছে: কত token, কতবার ব্যবহার হয়েছে
   - বাকি আছে: কত token (একটা progress bar সহ — সবুজ / হলুদ / লাল)
   - শেষ কখন ব্যবহার হয়েছে
2. **পেজের উপরের Overview-তে** নতুন "API Key Usage" অংশ: সব connected key-এর ছোট ছোট কার্ড — প্রত্যেকটায় নাম, ব্যবহার হয়েছে, বাকি আছে, আর মোট হিসাব (সব key মিলিয়ে আজ/এই মাসে)।
3. **প্রতিটা key-এ নিজের limit বসানোর অপশন** (Edit-এর ভেতরে): "দৈনিক token limit" ও/অথবা "মাসিক token limit"। Limit শেষ হলে সেই key আপনাআপনি থেমে পরেরটা কাজ করবে, আর কার্ডে "Limit শেষ" দেখাবে।

## একটা সত্য কথা (গুরুত্বপূর্ণ)
সব কোম্পানি "আপনার কত token বাকি" সেটা জানায় না:
- **OpenRouter** — আসল বাকি ব্যালেন্স/limit সরাসরি কোম্পানি থেকে এনে দেখাব।
- **Groq** — প্রতিবার ব্যবহারের পর কোম্পানি যে "আজ বাকি" সংখ্যা পাঠায়, সেটা সেভ করে দেখাব।
- **Gemini, OpenAI, অন্যান্য** — কোম্পানি বাকি token জানায় না। তাই এখানে আমাদের নিজের গোনা "খরচ হয়েছে" দেখাবে, আর "বাকি" দেখাবে আপনি যে limit বসাবেন তার থেকে হিসাব করে। limit না বসালে "বাকি: limit সেট করা নেই" লেখা থাকবে।

প্রতিটা কার্ডে ছোট করে লেখা থাকবে সংখ্যাটা কোম্পানি থেকে এসেছে নাকি আমাদের গোনা।

## যা বদলাবে না
Key-এর ক্রম, fallback, Test/Edit/Delete — সব আগের মতো। পুরনো ব্যবহারের হিসাব key ধরে রাখা হয়নি, তাই গণনা চালু হওয়ার মুহূর্ত থেকে শুরু হবে (শুরুতে ০)।

## Technical details
- **Migration:** নতুন `ai_key_usage` টেবিল (key_id text, provider, model, prompt_tokens, completion_tokens, ok bool, created_at) + index (key_id, created_at); নতুন `ai_key_quota` টেবিল (key_id PK, remaining_tokens, limit_tokens, reset_at, source 'provider'|'header', checked_at)। দুটোতেই GRANT + RLS owner-only (`has_role(...,'owner')`), service_role লেখে। Lovable Cloud ও production দুই জায়গায় প্রয়োগ।
- **Key ডেটা:** `GeminiKey`-এ ঐচ্ছিক `daily_token_limit`, `monthly_token_limit` (gemini-keys.server.ts normalize আপডেট); add/update server fn-এ ফিল্ড।
- **রেকর্ডিং:** `ai-provider.server.ts`-এর routed fetch wrapper-এ প্রতিটা সফল কলের response থেকে `usage` (stream হলে শেষ chunk) পড়ে fire-and-forget insert — কখনো কল আটকাবে না। Groq-এর `x-ratelimit-remaining-tokens`/`reset` header পেলে `ai_key_quota` upsert।
- **Limit enforcement:** key বাছাইয়ের সময় আজ/মাসের যোগফল (৬০ সে. TTL cache) limit ছাড়ালে সেই key skip।
- **OpenRouter:** নতুন owner-only server fn `GET https://openrouter.ai/api/v1/key` (limit, usage, limit_remaining) → `ai_key_quota`, ৫ মিনিট cache।
- **UI:** নতুন `listAiKeyUsage` server fn (owner-only, key ছাড়া — শুধু masked label); `owner/ai.tsx`-এ উপরে usage কার্ড গ্রিড + প্রতিটা key কার্ডে usage ব্লক ও progress bar; Edit ফর্মে দুটো limit ঘর।
- **যাচাই:** একটা টেস্ট AI কল চালিয়ে কার্ডে সংখ্যা বাড়ে কিনা Playwright-এ দেখা, build OK, তারপর `deploy-production.sh` দিয়ে orzen.top-এ লাইভ ও চেক।
