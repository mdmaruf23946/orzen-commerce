# Phase 3: মেসেজ একত্রীকরণ (Debouncer) ও ফাস্ট-পাথ উত্তর

## লক্ষ্য
- কাস্টমার পরপর কয়েকটা ছোট মেসেজ দিলে ("ভাই", "এই শার্টটা", "দাম কত?") আলাদা আলাদা ৩টা উত্তর না দিয়ে, ~২.৫ সেকেন্ড অপেক্ষা করে সবগুলো একসাথে পড়ে একটাই গোছানো উত্তর।
- Buy Now বাটন, অর্ডার স্ট্যাটাস চেক, সাধারণ সালাম/ধন্যবাদ — এগুলোতে AI না ডেকে সরাসরি ডাটাবেজ থেকে ১ সেকেন্ডের মধ্যে উত্তর।

## ব্যবহারকারীর চোখে কী বদলাবে
- একটানা মেসেজে একটাই উত্তর; প্রশ্ন হারাবে না।
- একটা মেসেজ দিলে বাড়তি দেরি নেই বললেই চলে (শুধু অপেক্ষার সময়টুকু, সর্বোচ্চ ~২.৫ সে.)।
- মার্চেন্ট প্যানেলে আগে থেকে সেট করা "reply delay" থাকলে সেটাই মানা হবে (বেশি হলে সেটা)।
- Buy Now → সঙ্গে সঙ্গে নাম/মোবাইল/ঠিকানা চাওয়া; "আমার অর্ডার কই" / অর্ডার নম্বর → সাথে সাথে আসল স্ট্যাটাস।
- ছবি ও ভয়েস মেসেজ একত্রীকরণে আটকাবে না — আগের মতোই কাজ করবে।
- Messenger ও WhatsApp দুটোতেই একই আচরণ। মার্চেন্ট কমান্ড, Human takeover, অর্ডার ফ্লো অপরিবর্তিত।

## Technical details
1. **Debounce window**: webhook-এ job insert-এর সময় `available_at = now + max(2.5s, reply_delay_seconds)` (টেক্সট মেসেজের জন্য; BUY_/postback/quick-reply → তাৎক্ষণিক)। Worker claim করার পর একই store+sender-এর অন্য due/pending টেক্সট job গুলো (window-এর ভেতরে আসা) একসাথে "merged" হিসেবে তুলে নেবে: টেক্সট যোগ করে একটি AI কল, একটি উত্তর; বাকি job-গুলো `status='merged'`, `merged_into=<lead job id>`।
2. **Sliding extension**: claim-এর মুহূর্তে যদি শেষ মেসেজ < ১.৫ সে. আগের হয়, আরেকটু অপেক্ষা (মোট সর্বোচ্চ ৬ সে.) — যাতে টাইপ চলাকালীন উত্তর না যায়।
3. **Schema (dev + production, ডেটা মুছবে না)**: `messenger_jobs` ও `whatsapp_jobs`-এ `merged_into uuid null` কলাম; status check-এ `merged` যোগ। `claim_*` RPC অপরিবর্তিত; নতুন `claim_sender_batch_*` RPC (service_role only) একই sender-এর due pending টেক্সট job লক করে ফেরত দেয়।
4. **Fast-path router** (`src/lib/fast-path.server.ts`, দুই চ্যানেলে শেয়ার্ড), AI-এর আগে চলে:
   - `BUY_<uuid>` → বিদ্যমান Buy Now হ্যান্ডলার (Messenger `messenger-webhook.server.ts`, WhatsApp `whatsapp-webhook.server.ts:475`) — এগুলোকে debounce থেকে বাদ দেওয়া।
   - অর্ডার স্ট্যাটাস: ছোট invoice নম্বর বা "অর্ডার কই/status/track" + কাস্টমারের ফোন/conversation → store-scoped `orders` query → বিদ্যমান বাংলা status ফরম্যাটার দিয়ে উত্তর।
   - সালাম/ধন্যবাদ/ok জাতীয় একক শব্দ → নির্দিষ্ট ভদ্র টেমপ্লেট (store name সহ)।
   - নিশ্চিত না হলে (একাধিক অর্ডার, অস্পষ্ট) → AI পথে পাঠানো; কখনো অনুমান নয়।
   - প্রতিটি ফাস্ট-পাথ উত্তর `ai_messages`-এ লগ হবে ও job-এ `route: fast|ai` রেকর্ড (পরের observability phase-এর জন্য)।
5. **Safety**: merged job-এর reply একবারই পাঠানো (lead job-এর `reply_text`/`outbound_message_id` নিয়ম); lead ব্যর্থ হলে পুরো batch একসাথে retry; tenant isolation — সব query store_id দিয়ে।

## যাচাই
- টাইপচেক + বিল্ড, `scripts/deploy-production.sh` দিয়ে orzen.top-এ ডিপ্লয় + parity চেক (Lovable Publish নয়)।
- প্রোডাকশনে টেস্ট job: ৩টি টেক্সট ১ সে. ব্যবধানে → একটি উত্তর, দুটি `merged`। একটি BUY_ → দেরি ছাড়া উত্তর। অর্ডার নম্বর দিয়ে স্ট্যাটাস → AI কল ছাড়া সঠিক উত্তর।
- আপনার WhatsApp ও Messenger থেকে পরপর ৩টা মেসেজ দিয়ে আসল পরীক্ষা।
