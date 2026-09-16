# Winner Admin Panel — সম্পূর্ণ যাচাই ও সমাধান

আমি মালিক অ্যাকাউন্টে লগইন করে Winner Admin প্যানেলের **৬০টি পেজ** এক এক করে খুলে দেখেছি (প্রতিটি পেজের লেখা, ত্রুটি ও ব্যর্থ অনুরোধ রেকর্ড করে)। নিচে যা পেয়েছি এবং কী ঠিক করব।

## যা আসলে নষ্ট

1. **AI Admin Control → Notifications** — পেজটি একেবারেই খোলে না, "This page didn't load" দেখায়। কারণ: পেজটি নিজের ভেতরে অসীম লুপে আটকে যায় (তালিকা আসার পর বারবার নিজেকে রিফ্রেশ করতে থাকে)। এটাই সবচেয়ে বড় সমস্যা।

2. **Store Health** (Stores → Store Health) — আসলে কোনো পেজ বানানোই হয়নি; শুধু শিরোনাম আর একটা "Coming Soon" বাক্স আছে। তাই "লোড হচ্ছে না" মনে হয়।

3. **AI Usage** (AI → AI Usage) — একই অবস্থা, শুধু "Coming Soon"। অথচ ড্যাশবোর্ড থেকে "View details →" লিংক এই ফাঁকা পেজেই নিয়ে যায়।

4. **Dashboard-এর গ্রাফ** — আয়ের তথ্য আসার আগে গ্রাফটি ভুল আকার আঁকতে গিয়ে ব্রাউজারে ত্রুটি তৈরি করে (দেখতে ফাঁকা/ভাঙা লাগে)।

5. **Store Template** — পেজ খোলার সময় একটি React সতর্কতা আসে (রেন্ডারের ভেতরে state আপডেট), এখন দৃশ্যমান ক্ষতি করছে না কিন্তু ভবিষ্যতে পেজ আটকে যাওয়ার ঝুঁকি।

## যা ঠিক আছে (যাচাই করা)

বাকি ৫৫টি পেজ — Stores, Subscriptions, Subscription Payments ও Providers, Coupons, Manual Payments, Packages, Plan Features, Payment Settings ও Gateways, AI Control, AI Call Center, Couriers, Marketing, Ads, Platform Branding, Brand Assets, Themes, Invoice Templates, Feature Flags, Fraud, System, Footer, Reviews, Showcase, Domains, Users, Audit, Communication (৫টি), Reports, Customers, Support, Notification Center, Announcements, Login Logs, Backups, AI Admin-এর বাকি ১১টি পেজ, API Keys, Webhooks, System Logs — সবগুলোই ঠিকমতো ডেটাসহ লোড হচ্ছে, কোনো সার্ভার ত্রুটি বা ব্যর্থ অনুরোধ পাইনি।

লাইভ ডেটাবেজও পরীক্ষা করেছি: ১৮৪টি টেবিল, মালিকের অধিকার ঠিক আছে, AI Admin-এর লগ ডেটা আছে — ডেটাবেজের দিক থেকে কিছু আটকে নেই।

## যা করব

1. **Notifications পেজের ক্র্যাশ ঠিক করা** — লুপ বন্ধ করে পেজটি স্বাভাবিকভাবে খোলা ও সেভ করার উপযোগী করা।
2. **Store Health পেজ সত্যিকারভাবে তৈরি করা** — প্রতিটি স্টোরের অবস্থা: সক্রিয়/স্থগিত/মেয়াদোত্তীর্ণ, শেষ অর্ডার ও শেষ লগইনের সময়, ডোমেইন ঠিক আছে কিনা, প্রোডাক্ট/অর্ডার/কাস্টমার সংখ্যা, ঝুঁকিপূর্ণ স্টোরগুলো উপরে।
3. **AI Usage পেজ সত্যিকারভাবে তৈরি করা** — মোট রিকোয়েস্ট, টোকেন ও খরচ (৭/৩০/৯০ দিন), স্টোরভিত্তিক ও মডেলভিত্তিক তালিকা, দৈনিক চার্ট, CSV এক্সপোর্ট।
4. **Dashboard গ্রাফের ত্রুটি ঠিক করা** — ডেটা না থাকলে পরিচ্ছন্ন "ডেটা নেই" অবস্থা দেখাবে, ত্রুটি নয়।
5. **Store Template-এর সতর্কতা ঠিক করা।**
6. শেষে আবার পুরো প্যানেলের ৬০টি পেজ স্বয়ংক্রিয়ভাবে পরীক্ষা করে নিশ্চিত হব কিছু ভাঙেনি।
7. সব ঠিক হলে লাইভ orzen.top-এ নিরাপদ পদ্ধতিতে (Publish বোতাম নয়) আপডেট পাঠাব।

## কারিগরি বিবরণ

- `owner/ai-admin.notifications.tsx`: `const { data = [] }` প্রতি রেন্ডারে নতুন অ্যারে দেয়, যা `useEffect` ডিপেন্ডেন্সিতে ব্যবহৃত হয়ে `setDraft` → রেন্ডার → লুপ তৈরি করে ("Maximum update depth exceeded")। স্থিতিশীল ডিফল্ট + ডেটা-আইডেন্টিটি ভিত্তিক ইনিশিয়ালাইজেশনে বদলানো হবে।
- `owner/health.tsx` ও `owner/ai-usage.tsx`: `ComingSoon` প্লেসহোল্ডার সরিয়ে নতুন owner-authenticated server functions (`owner.functions.ts`-এর প্যাটার্ন, `assertOwner` সহ) দিয়ে প্রকৃত পেজ; পড়া হবে `stores`, `orders`, `products`, `customers`, `store_domains`, `ai_usage` থেকে, aggregated query-তে — কোনো নতুন টেবিল বা schema পরিবর্তন লাগবে না।
- `owner/index.tsx` এর `Sparkline`: `points.length === 0` হলে খালি-state রিটার্ন, যাতে `d=" L24,96 ... Z"` তৈরি না হয়।
- `owner/store-template.tsx`: রেন্ডার-টাইম setState সরিয়ে `useEffect`-এ নেওয়া হবে।
- যাচাই: Playwright দিয়ে ৬০ রুটের সুইপ (কনসোল ত্রুটি + ৪xx/৫xx + সার্ভার-ফাংশন ত্রুটি) মোবাইল ও ডেস্কটপ দুই মাপে।
