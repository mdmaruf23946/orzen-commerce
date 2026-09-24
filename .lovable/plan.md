# Messenger ছবির নিখুঁত Product Recognition ও ভুল Card বন্ধ করা

## নিশ্চিত সমস্যা

স্ক্রিনশটে customer একটি silver plug-in charger/adaptor ধরনের পণ্যের ছবি পাঠিয়েছেন, কিন্তু Messenger **Portable Bluetooth Speaker** দেখিয়েছে। বর্তমান ব্যবস্থায়:

- ছবির product type, brand, লেখা, connector/shape ইত্যাদি একবার বের করা হয়;
- store-এর সর্বোচ্চ ৪০টি product-এর শুধু প্রথম ছবির সঙ্গে একবারে তুলনা করা হয়;
- মাত্র `0.60` confidence পেলেই “কাছাকাছি মিল” ধরে সেই product-এর card পাঠানো হয়;
- product category/type পুরো আলাদা হলেও card আটকানোর বাধ্যতামূলক নিয়ম নেই;
- success message-এ অপ্রয়োজনীয় “আপনার product-এর সঙ্গে আমাদের product মিলেছে” লেখা হয়।

এই কারণে charger-এর মতো ছবিও speaker-এর সঙ্গে দুর্বল visual similarity পেলে ভুল card পেতে পারে।

## যা পরিবর্তন করা হবে

### ১. ছবিটি আরও গভীরভাবে শনাক্ত করা

একটি সাধারণ description-এর বদলে ছবি থেকে আলাদা করে বের করা হবে:

- product-এর মূল ধরন ও sub-type;
- brand/logo, দৃশ্যমান model number ও লেখা;
- রং, material, shape, connector/port, button, display এবং গুরুত্বপূর্ণ physical feature;
- packaging থাকলে package text/specification;
- ছবিটি product, receipt, payment screenshot নাকি অন্য কিছু;
- কোন তথ্য নিশ্চিত এবং কোনটি অনুমান—প্রতিটির confidence।

“সঠিক formula/details” ছবিতে দৃশ্যমান বা নির্ভরযোগ্যভাবে চেনা গেলে তবেই বলা হবে; অদৃশ্য specification AI বানিয়ে বলবে না।

### ২. বহু-ধাপের Catalogue Matching

একবারে একটি দুর্বল comparison-এর বদলে চার ধাপে matching হবে:

1. **Type gate:** customer image-এর product type/category-এর সঙ্গে অসামঞ্জস্য product বাদ যাবে—charger কখনো speaker candidate হবে না।
2. **Candidate search:** নাম, brand, model text, SKU/product code, description, features, specifications ও variants দিয়ে candidate বের হবে।
3. **Complete image comparison:** শুধু primary image নয়, candidate product-এর primary ও gallery image-গুলো batch করে customer image-এর সঙ্গে তুলনা হবে। বড় catalogue-এ প্রথম ৪০টির সীমায় exact product বাদ পড়বে না।
4. **Final verifier:** সেরা candidate-গুলোর customer image বনাম catalogue image আলাদাভাবে আবার যাচাই হবে—same product/model, close alternative, এবং different product তিনটি স্পষ্ট verdict থাকবে।

একই catalogue photo/customer-এর downloaded photo হলে strongest exact signal ব্যবহার হবে; crop, background বা lighting বদলালেও visual verifier কাজ করবে।

### ৩. False Positive পুরোপুরি আটকানো

- শুধু রং, shape বা সাধারণ category মিললে product card পাঠানো যাবে না।
- type/category mismatch হলে confidence যাই হোক candidate বাতিল হবে।
- exact product/model বা অত্যন্ত শক্ত visual evidence ছাড়া **কোনো single product card যাবে না**।
- মাঝারি confidence হলে card পাঠিয়ে “মিলেছে” বলা হবে না; customer-এর কাছে brand/model বা আরেকটি পরিষ্কার ছবি চাওয়া হবে।
- store-এ exact product না থাকলে সরাসরি জানাবে যে নিশ্চিতভাবে পাওয়া যায়নি; চাইলে আলাদা করে সত্যিকারের same-category alternatives দেখানো যাবে, কিন্তু সেগুলোকে exact match বলা হবে না।

বাস্তব ছবির ক্ষেত্রে ১০০% নিশ্চয়তা সবসময় প্রযুক্তিগতভাবে সম্ভব নয়; তাই লক্ষ্য হবে **ভুল product দেখানোর বদলে অনিশ্চিত হলে card না পাঠানো**।

### ৪. Messenger Reply সহজ করা

Exact match হলে:

1. সঙ্গে সঙ্গে product card যাবে;
2. ছোট message যাবে: **“এই প্রোডাক্টটি নিতে চান?”**
3. “আপনার product-এর সঙ্গে আমাদের product মিলেছে”, confidence, internal comparison বা technical wording customer দেখবে না।

Exact match না হলে:

- product-এর সংক্ষিপ্ত সঠিক পরিচয় জানাবে;
- catalogue-এ নিশ্চিত match নেই বলবে;
- প্রয়োজন হলে model/brand বা পরিষ্কার ছবি চাইবে;
- ভুল বা unrelated card পাঠাবে না।

### ৫. Context ও Duplicate Safety

- প্রতিটি image result শুধু সেই Messenger image ID-এর সঙ্গে যুক্ত থাকবে;
- নতুন ছবিতে আগের ছবির product/card ব্যবহার হবে না;
- text ও card একই source image-এর সঙ্গে বাঁধা থাকবে;
- retry হলেও একবারের বেশি message/card যাবে না;
- customer পরে “এটা আছে?” বললে সর্বশেষ সফল image analysis-ই ব্যবহার হবে।

## Technical implementation

- বর্তমান `describeImageAttachment` output-এ structured identity, OCR/model text, connector/feature signals ও per-field confidence যোগ হবে।
- `visuallyMatchProduct` একক ৪০-image request থেকে staged candidate generation, chunked gallery comparison এবং final pairwise verification-এ যাবে।
- matching result হবে `exact | close | none`; product-type compatibility এবং final verification ছাড়া `exact` সম্ভব হবে না।
- card sender শুধু `exact` verdict গ্রহণ করবে; পুরোনো `0.60` close-match card path বাদ যাবে।
- stored attachment metadata-তে safe analysis/match evidence থাকবে, কিন্তু secret বা raw image থাকবে না।
- AI error/status handling, bounded retry এবং tenant isolation অপরিবর্তিত ও বাধ্যতামূলক থাকবে।

## যাচাই

1. বর্তমান charger/adaptor ছবিতে speaker card আর না আসা।
2. store-এর exact product photo দিলে সঠিক card ও শুধু “এই প্রোডাক্টটি নিতে চান?” আসা।
3. crop/background/lighting বদলানো exact product photo দিয়েও সঠিক match।
4. একই category কিন্তু different model দিলে exact card না আসা।
5. catalogue-এ নেই এমন product দিলে unrelated card না আসা।
6. brand/model text, colour, connector এবং visible details সঠিকভাবে save হওয়া।
7. পরপর দুইটি আলাদা ছবি দিলে দ্বিতীয়টির উত্তরে প্রথমটির card না আসা।
8. retry simulation-এ duplicate message/card না যাওয়া।
9. production AI request, saved match verdict, product ID এবং Facebook outbound message একই source image ID-এর সঙ্গে মিলিয়ে দেখা।
10. TypeScript check, build, এবং guarded Cloudflare deployment সম্পূর্ণ সফল হওয়ার পরেই সমাধান সম্পন্ন বলা হবে।

## অপরিবর্তিত থাকবে

- merchant/customer account ও order data;
- store isolation;
- Lovable Cloud-এর dev/backup data;
- production নিজের database ও Cloudflare deployment-এই চলবে।
