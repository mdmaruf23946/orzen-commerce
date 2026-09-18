# Winner Admin Panel — গোছানো ও ডুপ্লিকেট বাদ দেওয়ার পরিকল্পনা

## লক্ষ্য
এক কাজের জন্য একাধিক পুরনো পাতা সরিয়ে দেওয়া, সাইডবারের লিংক সংখ্যা কমানো, আর সব ইমেইল-সংক্রান্ত কাজ একটি জায়গায় আনা।

## ১. পুরনো ইমেইল সিস্টেম সরানো
স্ক্রিনশটে দেখা উপরের পুরনো ইমেইল অংশটি আর কাজ করে না। নতুন ব্যবস্থাই (Brevo) সব ইমেইল পাঠায়।

- Notification Center (পুরনো ক্যাম্পেইন পাঠানোর পাতা) সরিয়ে দেওয়া হবে; এর কাজ Communication-এর Compose ও History-তেই আছে।
- Announcements (`/owner/notifications`) থেকে যা দরকার তা Communication-এ থাকবে, আলাদা পাতা থাকবে না।
- পুরনো পাতাগুলোর ঠিকানায় কেউ গেলে স্বয়ংক্রিয়ভাবে নতুন Communication পাতায় পৌঁছে যাবে — কোনো ভাঙা লিংক থাকবে না।

## ২. Communication ও Email এক ছাতার নিচে
একটি সেকশন: **Communication & Emails**
- Dashboard (সারসংক্ষেপ)
- Compose (ম্যানুয়ালি মার্চেন্টদের ইমেইল/নোটিফিকেশন পাঠানো)
- History (কে পেয়েছে, কতজনের ব্যর্থ)
- Templates
- Email Automations (ওয়েলকাম, লগইন অ্যালার্ট, সাবস্ক্রিপশন, ল্যান্ডিং পেজ — চালু/বন্ধ ও টেস্ট ইমেইল)
- Gmail Connection

এগুলো সাইডবারে একটিমাত্র "Communication & Emails" শিরোনামের নিচে থাকবে; ভেতরের ট্যাব দিয়ে ঘোরা যাবে।

## ৩. সাইডবারের নতুন সাজ
প্রতিটি গ্রুপে শুধু মূল লিংক থাকবে, ভেতরের উপ-পাতাগুলো সাইডবারে নয় — পাতার ভেতরের ট্যাবে।

```text
Overview        Dashboard
Stores          All Stores, Store Health
Billing         Subscriptions, Payments, Packages, Coupons, Settings
AI              AI Control, AI Usage, AI Call Center, AI Admin Control
Communication   Communication & Emails
Integrations    Couriers, Marketing, Ads
Platform        Branding & Assets, Themes & Templates, Features, Domains, System, Footer, Reviews, Showcase, Fraud
People          Users, Customer Accounts, Role Audit, Support
Insights        Reports
Security        Login Logs, Backups
Developer       API Keys, Webhooks, System Logs
```

- **AI Admin Control**-এর ১২টি লিংক সাইডবার থেকে সরে গিয়ে ওই পাতার ভেতরের ট্যাবে যাবে (একটি লিংক থাকবে)।
- **Subscription Payments / Providers / Manual Payments / Payment Settings / Storefront Gateways** — Billing-এর ভেতরে ট্যাব আকারে গুছিয়ে সাইডবারে কম লিংক থাকবে।
- **Platform Branding / Courier Brand Assets / Payment Brand Assets** — একটি "Branding & Assets" পাতার ট্যাব হবে।
- **Store Themes / Store Template / Invoice Templates** — একটি "Themes & Templates" পাতার ট্যাব হবে।

মোট সাইডবার লিংক ~৬০ থেকে ~২৮-এ নামবে, মোবাইলেও সহজে দেখা যাবে।

## ৪. যাচাই
- প্রতিটি পুরনো ঠিকানা নতুন জায়গায় ঠিকভাবে পৌঁছায় কিনা পরীক্ষা।
- Compose থেকে একটি টেস্ট ইমেইল পাঠিয়ে ডেলিভারি দেখা।
- কোনো পাতা খালি বা ভাঙা দেখাচ্ছে কিনা — সব পাতায় ঢুকে দেখা।
- মার্চেন্ট প্যানেল ও দোকানগুলোতে কোনো প্রভাব পড়েনি তা নিশ্চিত করা।

## প্রযুক্তিগত বিবরণ (সংক্ষেপে)
- `src/routes/_authenticated/owner/route.tsx`-এর `groups` তালিকা নতুন কাঠামোয় পুনর্লিখন।
- `notification-center.*` রুটগুলো ও `notifications.tsx` সরিয়ে `/owner/communication`-এ redirect রুট রাখা; `src/lib/notifications.functions.ts`-এর যেসব ফাংশন Communication ব্যবহার করে সেগুলো রেখে বাকি অব্যবহৃত অংশ পরিষ্কার করা।
- `email-automations.tsx` কে `communication.automations.tsx` হিসেবে Communication লেআউটের ট্যাবে আনা।
- `subscription-pay.route.tsx`-এর মতো লেআউট+ট্যাব প্যাটার্ন ব্যবহার করে Billing, Branding & Assets, Themes & Templates, AI Admin-এর ট্যাব তৈরি; আলাদা রুট ফাইলগুলো অক্ষত থাকবে, শুধু সাইডবার থেকে সরবে।
- ডাটাবেজ বা মার্চেন্ট প্যানেলে কোনো পরিবর্তন নেই।

## ডিপ্লয়
কোড পরিবর্তনের পর লাইভ (orzen.top) করতে হলে আগের যাচাইকৃত Cloudflare পদ্ধতিতে ডিপ্লয় করা হবে — আপনি বললে তখনই।
