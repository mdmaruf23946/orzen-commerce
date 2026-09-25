# সব Store-এর Messenger Product Photo Matching নির্ভরযোগ্য করা

## নিশ্চিত কারণ

ORZEN/mdmaruf-এর **Vitamin C Serum** product card-এ customer-এর পাঠানো একই Nécessaire lotion photo রয়েছে। AI customer photo-কে সঠিকভাবে “Nécessaire Body Lotion” চিনেছে, কিন্তু merchant-এর product নাম “Vitamin C Serum” হওয়ায় বর্তমান প্রথম ধাপ productটিকে candidate list থেকে বাদ দিয়েছে। ফলে একই catalogue photo থাকা সত্ত্বেও card পাঠানো হয়নি।

## যা পরিবর্তন হবে

### ১. Image-first exact matching
- Customer photo-র সঙ্গে merchant-এর নিজস্ব active, in-stock catalogue photos আগে মিলবে।
- একই photo crop, resize, compression বা Messenger re-encoding হলেও exact-photo signal হিসেবে ধরা হবে।
- Product title, category, brand বা description ভুল/অসম্পূর্ণ হলেও exact visual match বাদ যাবে না।

### ২. Text metadata শুধু সহায়ক হবে
- নাম/category/type candidate সাজাতে সাহায্য করবে, কিন্তু visual comparison-এর আগে কোনো image-bearing product স্থায়ীভাবে বাদ দেবে না।
- প্রথম shortlist-এ exact match না এলে বাকি catalogue images নিরাপদ ছোট batch-এ পরীক্ষা হবে।
- বড় catalogue হলে batch processing থাকবে, যাতে কোনো product বাদ না পড়ে এবং request অতিরিক্ত বড় না হয়।

### ৩. ভুল card আটকানো থাকবে
- শুধুমাত্র একই store-এর product পরীক্ষা হবে; অন্য merchant-এর product কখনো candidate হবে না।
- Exact visual evidence ছাড়া শুধু একই রং, shape বা category দেখে card যাবে না।
- Exact নিশ্চিত না হলে আগের মতো card না পাঠিয়ে পরিষ্কারভাবে আরও তথ্য/ছবি চাইবে।

### ৪. সব Channel ও ভবিষ্যৎ Store-এর জন্য সাধারণ নিয়ম
- কোনো নির্দিষ্ট product ID, store বা image hard-code করা হবে না।
- প্রতিটি নতুন merchant, নতুন catalogue এবং ভিন্ন ধরনের product একই matching flow ব্যবহার করবে।
- Messenger-এর product-card format আগের সফল cardগুলোর মতোই থাকবে।

## যাচাই

1. এই screenshot দিলে ORZEN/mdmaruf-এর **Vitamin C Serum** card আসবে, কারণ catalogue-এ এই exact photo-ই সংরক্ষিত।
2. Watch, wallet, jacketসহ আগে সফল exact matches ঠিক থাকবে।
3. ভুল নাম/category-সহ exact catalogue photo card পাঠাবে।
4. দেখতে কাছাকাছি কিন্তু আলাদা model/product card পাঠাবে না।
5. অন্য store-এর exact-looking productও tenant boundary অতিক্রম করবে না।
6. বড় catalogue-এ শেষের product পর্যন্ত matching coverage থাকবে।
7. সফল build, live Cloudflare deployment এবং live Messenger verification-এর পরেই কাজ সম্পূর্ণ বলা হবে।

## অপরিবর্তিত থাকবে

- Merchant/customer/order data মুছবে না।
- Lovable Cloud-এর dev/backup data অপরিবর্তিত থাকবে।
- Production নিজের database ও Cloudflare-এই চলবে।
