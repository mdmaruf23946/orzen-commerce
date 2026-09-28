# Phase 4: ছবি দিয়ে ১ সেকেন্ডে সঠিক পণ্য খোঁজা (WhatsApp + Messenger)

## কী হবে (সহজ ভাষায়)
- মার্চেন্ট পণ্যের ছবি আপলোড বা পরিবর্তন করলে সাথে সাথে সেই ছবির একটা "ডিজিটাল ছাপ" (ভেক্টর) তৈরি হয়ে সেভ হবে। এর জন্য আপনার Google Gemini key ব্যবহার হবে।
- কাস্টমার ছবি পাঠালে শুধু সেই দোকানের পণ্যের সাথে মেলানো হবে। স্পষ্ট মিল পেলে প্রায় ১ সেকেন্ডে পণ্যের নাম, দাম আর Buy Now দেখাবে।
- মিল স্পষ্ট না হলে সেরা ৩-৪টা পণ্য দেখিয়ে কাস্টমারকে জিজ্ঞেস করবে। কোনো অনুমান করবে না। কিছুই না মিললে একই ধরনের বিকল্প পণ্য দেখাবে।
- এখন WhatsApp-এ ছবি থেকে পণ্য খোঁজাই হয় না। এই ধাপের পর WhatsApp-এও Messenger-এর মতো কাজ করবে।
- Gemini key-র quota শেষ হলে বা কাজ না করলে এখনকার ছবি-মেলানো পদ্ধতি (fingerprint) চালু থাকবে। তাই কিছুই বন্ধ হবে না।

## ধাপগুলো
1. **ডাটাবেজ (প্রোডাকশন + dev):** `product_image_embeddings`-এ ভেক্টর কলাম দুই জায়গায় একই রকম রাখা (dev-এ `phash` কলাম নেই, সেটা যোগ হবে)। সাইজ ঠিক করা হবে Gemini-র আসল response দেখে। দ্রুত খোঁজার জন্য HNSW index বসবে। `match_product_image_embeddings` সবসময় `store_id` দিয়ে আলাদা থাকবে, আর শুধু সার্ভার এটা চালাতে পারবে।
2. **ছবির ছাপ তৈরি (`embedImageBytes`):** এখন এই অংশটা বন্ধ (key ফাঁকা)। এটা Google-এর multimodal embedding endpoint-এ চালু করা হবে। দোকানের সেভ করা Gemini key একটার পর একটা চেষ্টা হবে, আর quota বা ভুল key ধরা পড়লে বাদ যাবে (AI routing-এ যেমন হয়)। Google সরাসরি ছবি না নিলে ধাপ ১-এর আগেই লাইভ পরীক্ষা করে আপনাকে জানানো হবে, আর fingerprint পদ্ধতিই চলবে।
3. **আপলোডের সময় তৈরি:** পণ্য সেভ বা ছবি পরিবর্তন করলে (`invalidate_product_image_embedding` trigger আগে থেকেই আছে) background-এ ওই পণ্যের ভেক্টর বানানো হবে। cron এক মিনিট পরপর বাকি পণ্য সেরে নেবে (একেকবারে ৪০টা)। আর একবার সব পুরনো পণ্যের backfill হবে।
4. **কাস্টমারের ছবি খোঁজা (দুই চ্যানেলে একই কোড):** নতুন `findProductByPhoto()` আগে fingerprint দেখবে (~৫০ms)। তারপর ভেক্টর (~০.৫-১s)। মিল স্পষ্ট হলে সরাসরি উত্তর (fast path, AI লাগবে না)। অস্পষ্ট হলে সেরা প্রার্থী দেখানো হবে। শেষ উপায় হিসেবে আগের ধীর visual check শুধু এই কয়েকটা প্রার্থীর ওপর চলবে।
5. **WhatsApp:** worker-এ ছবি এলে Meta থেকে ছবি নামিয়ে `findProductByPhoto()` চালানো হবে। মিললে পণ্যের ছবি, নাম, দাম আর Buy Now button যাবে। ছবি debounce-এ আটকাবে না, সাথে সাথে চলবে।
6. **Messenger:** এখনকার fingerprint ধাপের জায়গায় একই `findProductByPhoto()` বসবে। Buy Now card আগের মতোই থাকবে।
7. **মাপার মান ঠিক করা:** আপনার দোকানের আসল ~৭৬টা পণ্যের ছবি নিয়ে (crop করা, Messenger-এর মতো compress করা) পরীক্ষা করে `similarity`/`margin`-এর সীমা ঠিক করা হবে, যাতে ভুল পণ্য না দেখায়।
8. **লগ:** প্রতিটা ছবির জন্য কোন পথে মিলল (fingerprint/vector/visual), কত সময় লাগল আর similarity কত ছিল, তা `ai_messages`-এর আগের evidence ঘরে সেভ হবে।

## যাচাই (শেষ ঘোষণার আগে)
- লাইভ ডাটাবেজে কয়টা পণ্যের ভেক্টর তৈরি হয়েছে, তার সংখ্যা।
- আসল পণ্যের ছবি পাঠিয়ে দেখা হবে উত্তর ১ সেকেন্ডের মতো সময়ে আসে কিনা আর সঠিক পণ্য দেখায় কিনা। অন্য দোকানের ছবি পাঠালে কোনো মিল দেখানো যাবে না।
- build সফল, orzen.top-এ wrangler deploy, আর parity check পাস হতে হবে।

## Technical details
- Files: `src/lib/product-image-embeddings.server.ts` (Gemini `embedContent` with `inline_data`, key rotation via existing gemini-keys helpers), new `src/lib/photo-match.server.ts` (`findProductByPhoto`), `catalog-memory.server.ts` (reuse), `messenger-webhook.server.ts` (~line 1339), `whatsapp-webhook.server.ts` (image branch in `processWhatsAppJob`, download via Graph media URL), `fast-path.server.ts` (`kind: "photo_match"`), cron route unchanged.
- Migration on both DBs: vector dimension fixed after probe, HNSW `vector_cosine_ops`, add `phash` on dev, RPC `security definer`, EXECUTE service_role only.
- Thresholds are initial (0.86 / 0.12), then recalibrated in step 7.
- Only store-scoped queries; embeddings never shared across stores.
