# Phase 8: Multi-tier Caching & AI Provider Routing

## লক্ষ্য
- প্রতিটা মেসেজে দোকানের তথ্য, AI সেটিং আর পণ্য তালিকা বারবার ডাটাবেজ থেকে না এনে অল্প সময়ের জন্য মেমোরিতে রাখা — উত্তর দ্রুত হবে।
- Gemini ধীর/বন্ধ হলে কাস্টমার অপেক্ষায় না থেকে কয়েক সেকেন্ডের মধ্যে আপনার অন্য key (Groq/OpenAI) দিয়ে উত্তর যাবে।

## বর্তমান অবস্থা (যাচাই করা)
- **আছে:** Gemini key একটার পর একটা চেষ্টা হয়; একই key-তে বিকল্প Gemini মডেল; শেষে OpenAI key (থাকলে)। পণ্য তালিকা ৯০ সেকেন্ড মেমোরিতে থাকে।
- **নেই:**
  - প্রতিটা চেষ্টার সময়সীমা নেই — Gemini ঝুলে থাকলে কাস্টমার অনেকক্ষণ অপেক্ষা করে।
  - "Gemini এখন ডাউন" মনে রাখার ব্যবস্থা (circuit breaker) নেই — প্রতিটা মেসেজ আবার নষ্ট মডেলগুলো চেষ্টা করে সময় নষ্ট করে।
  - দোকান + AI এজেন্ট + গ্লোবাল AI সেটিং প্রতিটা মেসেজে ৩টা ডাটাবেজ কল; ডেলিভারি এলাকাও প্রতিবার।
- Lovable AI ইচ্ছাকৃতভাবে ব্যাকআপে নেই (সাইট আপনার নিজের key-তে চলবে) — সেটাই থাকবে।

## কী তৈরি হবে

### ১. ক্যাশ (শুধু পাবলিক/দোকানের তথ্য)
| কী | কতক্ষণ |
|---|---|
| দোকানের তথ্য + AI এজেন্ট সেটিং + মার্চেন্ট পলিসি | ৬০ সেকেন্ড |
| গ্লোবাল AI সেটিং (key তালিকা বাদে বাকি) | ৩০ সেকেন্ড |
| ডেলিভারি এলাকা ও চার্জ | ৬০ সেকেন্ড |
| পণ্য তালিকা (আগে থেকেই) | ৯০ সেকেন্ড |
- প্রতিটা ক্যাশ দোকান অনুযায়ী আলাদা — এক দোকানের তথ্য অন্য দোকানে যাবে না।
- কাস্টমারের ব্যক্তিগত তথ্য, অর্ডার, পেমেন্ট, **স্টক ও দাম যাচাই** কখনো ক্যাশ হবে না (অর্ডার আর দাম-যাচাই সবসময় সরাসরি ডাটাবেজ)।
- মার্চেন্ট প্যানেলে AI সেটিং/ডেলিভারি বদলালে সর্বোচ্চ ১ মিনিটের মধ্যে কার্যকর হবে।
- একই দোকানের একসাথে অনেক মেসেজ এলে ডাটাবেজে একটাই অনুরোধ যাবে।

### ২. AI প্রোভাইডার রাউটিং
- **সময়সীমা:** প্রতিটা চেষ্টায় সর্বোচ্চ ~১২ সেকেন্ড; উত্তর না এলে পরের মডেল/key।
- **Circuit breaker:** কোনো মডেল/key পরপর ৩ বার ব্যর্থ (5xx/টাইমআউট/ওভারলোড) হলে ২ মিনিট সেটাকে এড়িয়ে সরাসরি পরেরটায়; ২ মিনিট পর একবার পরীক্ষা করে ঠিক থাকলে আবার চালু।
- **ব্যাকআপ ক্রম:** সচল Gemini key-গুলো → আপনার Groq key (ORZEN 3) → OpenAI key (থাকলে)। Groq বর্তমানে চেইনে আছে কিনা বাস্তবায়নের সময় যাচাই করে না থাকলে যোগ হবে।
- **দ্রুত মডেল সহজ প্রশ্নে:** ফাস্ট-পাথে না পড়া ছোট প্রশ্নে হালকা (flash-lite) মডেল — বর্তমান `fast` সেটিং মেনে।
- কোন প্রোভাইডার উত্তর দিল আর কেন সুইচ হলো তা লগে থাকবে।

## যা বদলাবে না
Key যোগ/মুছার পদ্ধতি, প্রতিদিনের key-বিরতি নিয়ম, দাম-যাচাই (Phase 6), অর্ডার লক (Phase 7), কিউ/ডিবাউন্স।

## পরীক্ষা (লাইভে)
- একই দোকানে পরপর মেসেজে ডাটাবেজ কল কমেছে কিনা ও উত্তরের সময় আগে-পরে মাপা।
- ইচ্ছাকৃত ভুল Gemini মডেল/ঝুলে থাকা ঠিকানা দিয়ে (শুধু পরীক্ষার ক্ষেত্রে) দেখা যে Groq-এ সুইচ হয় আর দ্বিতীয় মেসেজে সরাসরি Groq যায়।
- আসল WhatsApp কথোপকথনে এক রাউন্ড উত্তর।
- বিল্ড চেক, প্রোডাকশন ডিপ্লয়, parity check।

## Technical details
- New `src/lib/ttl-cache.server.ts`: `cached(key, ttlMs, loader)` with in-flight dedupe, per-isolate `Map`, max ~2000 entries (LRU trim).
- `ai-agent.server.ts` `loadAiContext`: store+agent under `ctx:${storeId}` (60s), global settings under `ai_settings` (30s); agent enabled/global enabled checks still applied on cached values.
- `chat-order-format.ts` `fetchDeliveryZones`: optional cached variant for chat reads (`getDeliveryCharge`, `guardReply`); `create_chat_order`/`resolveDeliveryCharge` in finalizeOrder keep live read.
- `ai-provider.server.ts` `makeRoutedFetch`: `AbortSignal.any([init.signal, AbortSignal.timeout(12000)])` per attempt; module-level breaker `Map<string /*label|model*/, {fails, openUntil}>` — open after 3 retryable failures, 120s half-open; skip open entries unless all are open (then try anyway). Timeouts count as retryable. `buildCandidates`: include non-Gemini saved keys (groq/openai-compatible from `gemini_api_keys` entries with provider) after Gemini.
- Log switch events via existing `onUse` + `console.warn("[ai-route]", …)`.
- Record rule in `AGENTS.md`.
