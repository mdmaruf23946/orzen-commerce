# Phase 2: WhatsApp-কে Messenger-এর মতো কিউ সিস্টেমে আনা

## লক্ষ্য
WhatsApp webhook এখন মেসেজ পাওয়ার পর একই রিকোয়েস্টের ভেতরে AI উত্তর তৈরি ও পাঠানো শেষ করে। AI ধীর হলে Meta অপেক্ষা করে টাইমআউট দেয়, আবার পাঠায় — ফলে দেরি, ডুপ্লিকেট বা হারানো উত্তর হয়। Messenger আগে থেকেই কিউ ব্যবহার করে; WhatsApp-কেও একই পদ্ধতিতে আনা হবে।

## কী বদলাবে (ব্যবহারকারীর চোখে)
- Meta সঙ্গে সঙ্গে (১ সেকেন্ডের কম) "পেয়েছি" উত্তর পাবে — টাইমআউট থাকবে না।
- প্রতিটি কাস্টমারের মেসেজ ক্রমানুসারে উত্তর পাবে; এক কাস্টমারের ধীর উত্তর অন্য কাস্টমারকে আটকাবে না।
- একই মেসেজ Meta দুবার পাঠালেও উত্তর একবারই যাবে।
- সাময়িক সমস্যায় (AI/Meta/ডাটাবেজ) নিজে থেকে আবার চেষ্টা; স্থায়ী ব্যর্থতায় কাস্টমার একটি ভদ্র বাংলা/ইংরেজি বার্তা পাবেন এবং প্যানেলে আসল কারণ দেখা যাবে।
- Messenger, Buy Now, অর্ডার, মার্চেন্ট ভেরিফিকেশন, Human takeover — সব আগের মতোই চলবে।

## Technical details

1. **Queue টেবিল (reuse)**: বিদ্যমান `messenger_jobs`-এ `channel` কলাম (`messenger` default | `whatsapp`) যোগ; WhatsApp-এর জন্য `page_id` = phone_number_id, `message_id` = wamid — বিদ্যমান unique `(page_id, message_id)` idempotency দেয়। `claim_messenger_job` RPC অপরিবর্তিত পুনর্ব্যবহার।
2. **Webhook (`api/public/whatsapp/webhook.ts`)**: HMAC যাচাই + integration খোঁজা আগের মতো। status আপডেট ইনলাইনে থাকবে (হালকা)। প্রতিটি inbound message → conversation upsert + `logInbound` + job insert (ignoreDuplicates) → তারপর background-এ worker চালু (`ctx.waitUntil`-সমতুল্য, self-fetch নয় — Cloudflare 522 এড়াতে in-process কল) → তাৎক্ষণিক 200।
3. **Worker লজিক**: বর্তমান AI অংশ (merchant router, BUY_ হ্যান্ডলিং, `generateAgentReply`, `sendAndLog`) একটি `processWhatsAppJob(job)` ফাংশনে সরানো। `process.ts`-এর claim → run → sent/retry/failed + per-sender draining + backoff [5,15,45,120,300]s + ৫ বার পর failed ও fallback — channel অনুযায়ী dispatch।
4. **পুনরায় পাঠানো রোধ**: job-এ `reply_text`/`outbound_message_id` রেকর্ড হলে আর পাঠানো হবে না (Messenger-এর নিয়ম)।
5. **Recovery**: বিদ্যমান এক-মিনিটের recovery sweep WhatsApp job-ও তুলবে (stuck `processing` সহ)।
6. **Diagnostics**: `last_error`-এ generic "WhatsApp request failed" বদলে job-এর আসল কারণ।
7. **Migration**: Lovable Cloud (dev) ও production Supabase দুটোতেই; ডেটা মুছবে না।

## যাচাই
- টাইপচেক + বিল্ড, তারপর `scripts/deploy-production.sh` দিয়ে orzen.top-এ ডিপ্লয় (Lovable Publish নয়) ও parity চেক।
- সাইন-সহ নকল webhook পাঠিয়ে: ACK সময় <১s, একই wamid দুবার → এক job, job sent হয়।
- আসল টেস্ট: আপনার WhatsApp থেকে টেস্ট নম্বরে মেসেজ — উত্তর আসা ও ডাটাবেজে job `sent` নিশ্চিত করা। Messenger-এও একটি মেসেজ দিয়ে রিগ্রেশন চেক।
