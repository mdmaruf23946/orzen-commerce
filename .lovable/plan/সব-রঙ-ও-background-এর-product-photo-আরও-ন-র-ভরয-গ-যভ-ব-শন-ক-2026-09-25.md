# সব রঙ ও Background-এর Product Photo আরও নির্ভরযোগ্যভাবে শনাক্ত করা

## নিশ্চিত ফলাফল

এই screenshot-এর ক্ষেত্রে সাদা product ও সাদা background-এর কারণে AI ব্যর্থ হয়নি। Live saved result-এ ছবিটি **98% confidence**-এ সঠিকভাবে চিহ্নিত হয়েছে:

- Brand: **Nécessaire**
- Product: **The Body Lotion / fragrance-free body moisturizer**
- দৃশ্যমান লেখা: **FRAGRANCE FREE, 200 ml / 6.8 fl oz**
- Packaging: সাদা squeeze tube, কালো label

ব্যর্থতা হয়েছে পরের ধাপে: যে Messenger store-এ ছবিটি পাঠানো হয়েছে, তার catalogue-এ এই lotion বা Nécessaire product নেই—active, inactive বা out-of-stock অবস্থাতেও নেই। তাই unrelated product card না পাঠিয়ে “catalogue-এ পাওয়া যায়নি” বলা সঠিক ছিল। একই সময়ে পাঠানো watch ও wallet ছবি exact catalogue photo হিসেবে 99% confidence-এ match হয়েছে। AI request-গুলোও সফল ছিল।

## যা উন্নত করা হবে

### ১. কম-contrast ছবির জন্য দ্বিতীয়বার বিশেষ পরীক্ষা

প্রথমবার product type, outline, label বা visible text কম confidence-এ এলে একই ছবির ওপর আলাদা focused inspection হবে:

- product-এর edge/outline ও background আলাদা করে দেখা;
- shadow, cap, seam, port, button, texture ও packaging shape পরীক্ষা;
- খুব হালকা/সাদা label-এর লেখা আলাদাভাবে পড়া;
- transparent, reflective, black-on-black এবং white-on-white product-এর জন্য colour-independent physical features ব্যবহার;
- lighting-এর কারণে product colour অনুমান না করে uncertain রাখা।

প্রথম analysis যথেষ্ট পরিষ্কার হলে অপ্রয়োজনীয় দ্বিতীয় AI call হবে না।

### ২. শনাক্তকরণ ও Catalogue Match আলাদা ফলাফল

Customer reply-তে দুইটি বিষয় গুলিয়ে ফেলা হবে না:

- **ছবি চেনা গেছে, কিন্তু দোকানে নেই:** product-এর সঠিক সংক্ষিপ্ত পরিচয় বলে স্পষ্টভাবে জানাবে catalogue-এ exact item নেই।
- **ছবি স্পষ্টভাবে চেনা যায়নি:** আরেকটি পরিষ্কার ছবি, label অথবা model number চাইবে।

এতে “দোকানে পাওয়া যায়নি” দেখে মনে হবে না যে AI ছবিটি দেখতে পারেনি।

### ৩. Exact Product Matching আরও শক্ত রাখা

- ছবি low-contrast হলেও brand text, label layout, package shape, cap, proportions এবং distinctive details দিয়ে store image-এর সঙ্গে তুলনা হবে।
- একই ছবি crop, resize বা compression করা হলে exact signal হিসেবে ধরা হবে।
- শুধু একই রং বা একই ধরনের container দেখে exact match হবে না।
- অন্য merchant-এর product কখনো candidate হবে না; tenant isolation অপরিবর্তিত থাকবে।
- exact evidence না থাকলে ভুল card পাঠানোর বদলে card পাঠানো হবে না।

### ৪. Confidence ও Failure Evidence সংরক্ষণ

প্রতিটি ছবির সঙ্গে আলাদা করে রাখা হবে:

- image recognition confidence;
- low-contrast/poor-light/blur/occlusion-এর মতো visibility warning;
- catalogue matching verdict ও confidence;
- exact match না হওয়ার সংক্ষিপ্ত কারণ।

এতে পরেরবার সমস্যা হলে বোঝা যাবে AI ছবিটি চিনতে পারেনি, নাকি productটি catalogue-এ নেই।

## যাচাই

1. এই Nécessaire lotion ছবিতে product পরিচয় ঠিক থাকবে এবং “ছবি বুঝিনি” বলা হবে না।
2. একই lotion catalogue-এ না থাকলে unrelated Beauty product card আসবে না।
3. একটি white-on-white catalogue product-এর exact customer photo দিলে সঠিক card আসবে।
4. black-on-black, transparent, reflective ও colourful background-এর test image-এ product type/label পরীক্ষা হবে।
5. blur বা অতিরিক্ত overexposure-এ অনুমান করে ভুল card না পাঠিয়ে ভালো ছবি চাইবে।
6. আগের watch, wallet ও jacket exact matching নষ্ট হবে না।
7. image reply retry হলেও duplicate card/message যাবে না।
8. সফল build, live deployment এবং নতুন Messenger test-এর পরেই কাজটি সম্পূর্ণ বলা হবে।

## অপরিবর্তিত থাকবে

- exact match ছাড়া product card না পাঠানোর নিয়ম;
- merchant/customer account ও order data;
- কঠোর store isolation;
- Lovable Cloud-এর dev/backup data;
- production নিজের database ও Cloudflare deployment-এই চলবে।
