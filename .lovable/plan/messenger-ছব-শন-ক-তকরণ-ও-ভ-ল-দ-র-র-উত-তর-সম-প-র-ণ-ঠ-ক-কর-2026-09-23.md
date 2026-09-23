# Messenger ছবি শনাক্তকরণ ও ভুল/দেরির উত্তর সম্পূর্ণ ঠিক করা

## নিশ্চিত সমস্যা
- ২৩ সেপ্টেম্বরের লাইভ রেকর্ডে প্রথম ছবির উত্তর একবার পাঠানোর পর একই কাজ retry হয়ে প্রায় ৪ মিনিট পরে দ্বিতীয় উত্তর পাঠিয়েছে। অর্থাৎ customer নতুন message না দিলেও পুরোনো ছবির উত্তর আবার গেছে।
- দ্বিতীয় ছবির কাজটি ১৫:১১:৫০-এ তৈরি হলেও processing শুরু/শেষ হয়েছে প্রায় আড়াই মিনিট পরে; তাই ছবির সঙ্গে সঙ্গে উত্তর আসেনি।
- দ্বিতীয় ছবিটি website-এর **Denim Jacket** হলেও বর্তমান ব্যবস্থা শুধু ছবির লেখা-ভিত্তিক বর্ণনা (`olive green utility jacket`) দিয়ে catalogue search করেছে। Website-এর আসল product image-এর সঙ্গে customer image সরাসরি তুলনা করেনি, তাই একই পণ্য চিনতে ব্যর্থ হয়েছে।
- পরে পাঠানো “হেই” আলাদা greeting হিসেবে সঠিকভাবে উত্তর পেয়েছে; কিন্তু delayed পুরোনো job-এর উত্তর কথোপকথনকে বিভ্রান্ত করেছে।

## যা পরিবর্তন করা হবে

### ১. একই message-এর একটির বেশি উত্তর স্থায়ীভাবে বন্ধ
- প্রতিটি Facebook message ID-এর জন্য processing claim ও reply completion আলাদা করে নিরাপদভাবে চিহ্নিত করা হবে।
- কোনো text/card ইতিমধ্যে সফলভাবে পাঠানো থাকলে retry সেই message আর AI-তে পাঠাবে না এবং দ্বিতীয় উত্তরও পাঠাবে না।
- reply পাঠানোর পর logging বা অন্য পরের ধাপ ব্যর্থ হলেও পুরো customer message পুনরায় process হবে না।
- failed/retry recovery শুধু সত্যিই unanswered message-এ চলবে।

### ২. নতুন ছবি সবসময় সর্বশেষ প্রসঙ্গ হবে
- প্রতিটি image turn-এর নিজস্ব message ID, বিশ্লেষণ ও selected product থাকবে; আগের ছবির result নতুন ছবিতে ব্যবহার হবে না।
- “এটা আছে?”, “দেখান”, “কিনব” ধরনের পরের ছোট message শুধু সর্বশেষ image/product turn-কে ধরবে।
- নতুন ছবি আসলে পুরোনো pending image context ও stale product focus বাদ যাবে।
- একাধিক job এলে একই conversation-এ chronological processing নিশ্চিত হবে, যাতে পুরোনো job নতুন ছবির পরে উত্তর না দেয়।

### ৩. ছবির বিস্তারিত ও নির্ভুল বিশ্লেষণ
- customer-এর Facebook image server থেকে নিয়ে AI-কে full-resolution inline image হিসেবে দেওয়া হবে।
- শুধু এক বাক্যের description নয়; structured analysis-এ নেওয়া হবে: product type, category, primary/secondary colour, material, style, shape, pattern, visible text/logo/brand, distinctive parts এবং confidence।
- আলো/ছায়ার কারণে colour নিশ্চিত না হলে AI অনুমানকে সত্য হিসেবে বলবে না; confidence কম হলে neutral wording বা ছোট confirmation question ব্যবহার করবে।
- receipt, screenshot, person/model এবং actual sale item আলাদা করবে—model-এর পোশাক হলে পোশাককেই product subject হিসেবে ধরবে।

### ৪. Website catalogue-এর ছবির সঙ্গে সরাসরি visual matching
- আগে text/metadata দিয়ে সম্ভাব্য catalogue products shortlist করা হবে।
- তারপর customer photo-এর সঙ্গে shortlisted products-এর primary/gallery images সরাসরি একই multimodal comparison-এ মিলিয়ে ranking করা হবে।
- একই/খুব কাছাকাছি ছবি পাওয়া গেলে সেই exact database product pin হবে এবং তার official নাম, দাম, stock ও card পাঠাবে।
- মাঝারি confidence হলে “আপনি কি এই product-টি বোঝাচ্ছেন?” বলে ১–৩টি বাস্তব candidate card দেখাবে।
- low confidence বা match না থাকলে “এই product আমাদের catalogue-এ নিশ্চিতভাবে পাওয়া যায়নি” বলবে; ভুল product বা ভুল colour নিশ্চিতভাবে বলবে না।

### ৫. পেশাদার reply rules
- সর্বশেষ customer message/image-ই প্রথমে উত্তর পাবে; আগের product-এর কথা নিজে থেকে টেনে আনবে না।
- match না হলে কেবল catalogue-এ বাস্তবে থাকা কাছাকাছি product দেখাবে; কোনো invented category, colour, stock বা product name নয়।
- এক turn-এ text এবং card-এর বক্তব্য একই product-এর হবে।
- AI analysis ব্যর্থ হলেও নীরব থাকবে না—ছবিটি আরেকবার পরিষ্কারভাবে দিতে বা product name/model লিখতে বলবে।

## টেকনিক্যাল বাস্তবায়ন
- Messenger queue-তে per-message reply idempotency guard এবং conversation-level ordered claim যোগ হবে।
- `ai_messages` attachment metadata-তে detailed visual attributes, confidence, matched product ID এবং match confidence রাখা হবে, যাতে follow-up message সঠিক latest image ধরে।
- image analyser বর্তমান loose JSON parsing-এর বদলে validated structured result ব্যবহার করবে।
- product resolver image turn-এর জন্য text-only score বাদ দিয়ে visual reranking result-কে authoritative focus হিসেবে নেবে।
- বর্তমান tenant isolation অপরিবর্তিত থাকবে: শুধু ওই Messenger Page-এর store catalogue-ই search/compare হবে।

## যাচাই
1. Website থেকে **Denim Jacket** image download করে Messenger-এ পাঠিয়ে exact Denim Jacket card, সঠিক official তথ্য ও stock আসে কি না পরীক্ষা।
2. Store-এ নেই এমন charger image পাঠিয়ে “not available” আসে, কিন্তু Denim Jacket বা আগের product মিশে যায় না—পরীক্ষা।
3. পরপর দুই ভিন্ন ছবি পাঠিয়ে প্রতিটির উত্তর সঠিক order-এ এবং একবার করে আসে—পরীক্ষা।
4. ছবি পাঠিয়ে পরে “এটা আছে?” দিলে শুধু সর্বশেষ ছবির product ধরা হয়—পরীক্ষা।
5. আলো/ছায়ায় ambiguous colour-এর ছবি দিয়ে ভুল colour confidently না বলে safe clarification দেয়—পরীক্ষা।
6. retry/recovery চালিয়ে একই Facebook message-এর দ্বিতীয় automatic reply যায় না—লাইভ record দিয়ে নিশ্চিত করা।
7. TypeScript check, production deployment, তারপর orzen.top-এর A9N Ai Page-এ বাস্তব end-to-end test।
