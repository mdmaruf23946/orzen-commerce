# Messenger-এর ছবি না বোঝার আসল কারণ ঠিক করা

## লাইভ রেকর্ডে নিশ্চিত ফল
- ২৪ সেপ্টেম্বর ১১:০৫ UTC-তে A9N Ai Page-এ পাঠানো ছবিটি ঠিকভাবে Messenger job ও conversation-এ সংরক্ষিত হয়েছে; Facebook image URL-ও রেকর্ডে আছে।
- ওই job পাঁচবার চেষ্টা করেছে এবং প্রায় ছয় মিনিট পরে “ছবিটি ঠিকমতো বোঝা যাচ্ছে না” উত্তর দিয়েছে।
- একই সময় কোনো image-analysis AI request gateway-তে পৌঁছায়নি। তাই ভুলটি product matching-এ নয়; তার আগের **Facebook image download / image validation / AI configuration / request-start** ধাপের কোনো একটিতে হয়েছে।
- বর্তমান code এই ধাপগুলোর error ধরে `null` করে দেয়; ফলে live record-এ কোন ধাপ ও কেন ব্যর্থ হয়েছে তা লেখা নেই।
- সংরক্ষিত একই Facebook URL এখন সরাসরি পরীক্ষা করলে `200 image/jpeg` এবং 49,554 bytes পাওয়া যাচ্ছে। অর্থাৎ ছবিটি বৈধ; সাময়িক fetch/runtime failure হলেও system-এর recovery থাকা দরকার।

## যা পরিবর্তন করা হবে

### ১. প্রতিটি image-processing ধাপের নির্দিষ্ট ফল সংরক্ষণ
- Facebook download status, content type, byte size, AI request status, response parsing এবং catalogue comparison—প্রতিটি ধাপ আলাদা safe status/error code হিসেবে job-এ রাখা হবে।
- কোনো secret, customer identity বা raw image data log করা হবে না।
- `catch { return null }` সরিয়ে আসল failure category queue retry logic-এ পৌঁছানো হবে।

### ২. Facebook image download নির্ভরযোগ্য করা
- Messenger attachment URL প্রথমে প্রয়োজনীয় image request headers সহ download হবে।
- সাময়িক network/5xx/429 failure হলে bounded delay দিয়ে retry হবে; invalid/expired URL হলে Facebook Graph attachment lookup দিয়ে fresh URL নেওয়া হবে।
- MIME type, empty body ও size limit আলাদা করে যাচাই হবে; valid bytes পেলে সেগুলো inline image হিসেবেই AI-তে যাবে।

### ৩. AI analysis শুরু না হলে generic reply বন্ধ
- image analyzer চালু হওয়ার আগে AI key/config অনুপস্থিত থাকলে সেটি স্পষ্ট configuration failure হবে—“ছবি বুঝিনি” বলে customer-কে ভুল তথ্য দেওয়া হবে না।
- analysis request gateway-তে পৌঁছেছে এবং valid structured result দিয়েছে—এটি নিশ্চিত না হওয়া পর্যন্ত generic conversational AI-তে image turn পাঠানো হবে না।
- retry exhausted হলে একবার মাত্র honest temporary-failure message যাবে; একই ছবির জন্য বারবার reply যাবে না।

### ৪. Structured response ও catalogue matching শক্ত করা
- SSE parser সম্পূর্ণ event stream পড়বে এবং terminal error/refusal/empty-answer আলাদা করবে।
- analysis result schema দিয়ে validate হবে; malformed JSON হলে retryable parse failure হিসেবে ধরা হবে।
- সফল analysis-এর পরেই current image-টি ওই store-এর product images-এর সঙ্গে compare হবে; exact/close/no-match confidence নিয়ম আগের মতো থাকবে।

### ৫. Queue timing ও duplicate safety
- image job processing চলাকালে সেটি নতুন greeting/text job-এর পিছনে stale হয়ে যাবে না।
- retry কেবল উত্তর না-পাওয়া job-এ হবে; outbound text/card record থাকলে আর AI বা Facebook send হবে না।
- text এবং product card একই source message ID-এর সঙ্গে বাঁধা থাকবে।

## লাইভ যাচাই
1. বর্তমান failed Facebook image URL replay করে download → analysis → product identification প্রতিটি stage সফল হওয়া যাচাই।
2. A9N Ai Messenger-এ নতুন jacket photo পাঠিয়ে type, visible colour/style এবং catalogue match বাস্তবে যাচাই।
3. catalogue-এ নেই এমন photo পাঠিয়ে সঠিক “পাওয়া যায়নি” উত্তর একবার আসে কি না দেখা।
4. image-এর সঙ্গে দ্রুত “এটা আছে?” পাঠিয়ে order ও latest-image context ঠিক থাকা যাচাই।
5. temporary download failure simulation করে bounded retry এবং একবারের বেশি reply না যাওয়া যাচাই।
6. live gateway request, saved visual attributes, matched product ID, queue completion এবং Facebook outbound ID—সব একই message-এর সঙ্গে মিলিয়ে দেখা।
7. TypeScript check ও guarded Cloudflare deployment সম্পূর্ণ সফল হওয়ার পরেই কাজটি সমাধান হয়েছে বলা হবে।

## টেকনিক্যাল নোট
- পরিবর্তন মূলত Messenger image downloader/analyser, queue processor এবং safe diagnostic fields-এ সীমিত থাকবে।
- tenant isolation অপরিবর্তিত: Page ID থেকে store নির্ধারিত হবে এবং শুধু সেই store-এর catalogue compare হবে।
- production নিজের database ও Cloudflare deployment-এই থাকবে; Lovable Cloud-এর data পরিবর্তন বা delete করা হবে না।
