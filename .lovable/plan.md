# নতুন অ্যাকাউন্টে Store Panel ও Domains ঠিক করার পরিকল্পনা

## নিশ্চিত সমস্যা

- লাইভ ডাটাবেজে নতুন `mdmaruf01623@gmail.com` অ্যাকাউন্টটি যাচাইকৃত অবস্থায় আছে এবং তার চাওয়া দোকান `Qwerty`, সাবডোমেইন `qwerty`; কিন্তু তার কোনো store record তৈরি হয়নি। আগের `meshkatmd16@gmail.com` অ্যাকাউন্টটিরও একই অবস্থা।
- দোকান তৈরির fallback শুধু Merchant Panel-এর sidebar থেকে চলে। Dashboard, access check ও Domains একই সময়ে আলাদা অনুরোধ পাঠায়—তাই দোকান তৈরির আগে তারা “দোকান নেই” ফল পেতে পারে।
- Dashboard সেই পুরোনো ফল ৩০ সেকেন্ড ধরে রাখে; ফলে মোবাইলে “View Store” বোতাম দেখা যায় না।
- Domains-এর অনুরোধ ব্যর্থ হলে পেজ error দেখায় না; `data` না থাকায় চিরকাল “Loading…” দেখাতে থাকে।

## পরিবর্তন

### 1. দোকান তৈরি এক জায়গায় নির্ভরযোগ্য করা
- একটি shared, idempotent “ensure merchant store” server helper তৈরি করব।
- যাচাইকৃত বর্তমান ব্যবহারকারীর ID server-side session থেকেই নেওয়া হবে; browser থেকে পাঠানো owner ID গ্রহণ করা হবে না।
- আগে দোকান থাকলে সেটিই ফেরত দেবে; না থাকলে signup-এ রাখা store name/subdomain দিয়ে একবারই তৈরি করবে।
- একই সময়ে একাধিক অনুরোধ এলে duplicate store হবে না; subdomain সংঘর্ষ হলে নিরাপদ বিকল্প তৈরি করবে।
- Store template, default theme, trial, merchant code ও initial setup বর্তমান নিয়মেই থাকবে।

### 2. সব Merchant Panel প্রবেশপথ একই নিশ্চয়তা ব্যবহার করবে
- panel layout আগে store নিশ্চিত করবে, তারপর access/navigation এবং child pages চালাবে।
- Dashboard overview, Domains এবং store-access checks একই shared ফল ব্যবহার করবে; sidebar query-এর timing-এর ওপর আর নির্ভর করবে না।
- সফল store creation-এর পর সংশ্লিষ্ট cached তথ্য refresh হবে, তাই “View Store” বোতাম সঙ্গে সঙ্গে দেখা যাবে।

### 3. Domains-এর অনন্ত Loading বন্ধ করা
- loading, error এবং no-store—তিনটি অবস্থা আলাদা করব।
- সাময়িক ব্যর্থতায় স্পষ্ট বাংলা বার্তা ও “আবার চেষ্টা করুন” বোতাম থাকবে; আর অনন্ত Loading থাকবে না।
- store নিশ্চিত হওয়ার পর subdomain ও domain তথ্য load হবে।

### 4. ইতিমধ্যে আটকে থাকা অ্যাকাউন্ট উদ্ধার
- `Qwerty/qwerty` এবং `meshkat/meshkat` অ্যাকাউন্টের metadata থেকেই নিরাপদভাবে store তৈরি করব; অন্য কোনো merchant data পরিবর্তন হবে না।
- তৈরি হওয়া store-এ owner, trial/subscription, merchant code, default theme এবং subdomain সঠিকভাবে বসেছে কিনা যাচাই করব।

### 5. ভবিষ্যৎ প্রতিরোধ ও লাইভ যাচাই
- নতুন test account দিয়ে signup → store creation → Dashboard → View Store → Domains পুরো ধাপ চালাব।
- একই account দিয়ে একসঙ্গে/বারবার store নিশ্চিত করার চেষ্টা করে প্রমাণ করব duplicate তৈরি হয় না।
- caller-supplied অন্য owner ID দিয়ে ownership বদলানো যায় না—এটি যাচাই করব।
- production deployment gate-এ নতুন account-এর auth-user-without-store অবস্থা শনাক্ত করার check যোগ করব।
- নিরাপদ production-only Cloudflare deployment দিয়ে প্রকাশ করে live domain, production backend identity ও domain attachment পুনরায় যাচাই করব।

## প্রযুক্তিগত সীমা

পরিবর্তন শুধু signup/store initialization, Merchant Panel access sequencing, Dashboard refresh এবং Domains error handling-এ সীমাবদ্ধ থাকবে। পুরোনো দোকান, অর্ডার, গ্রাহক বা Lovable Cloud backup data মুছে বা পরিবর্তন করা হবে না।
