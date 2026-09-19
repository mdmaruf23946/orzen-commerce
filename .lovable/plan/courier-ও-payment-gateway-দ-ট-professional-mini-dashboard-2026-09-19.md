# Courier ও Payment Gateway — দুটি Professional Mini Dashboard

মার্চেন্ট প্যানেলের Analytics পেজে দুটি নতুন ট্যাব যোগ হবে: **Courier Overview** এবং **Payment Overview**।
একই তারিখ-রেঞ্জ বার (Today / 7d / 30d / This month / Custom + আগের সময়ের সাথে তুলনা) দুই ট্যাবেই কাজ করবে,
তাই সব হিসাব একই সময়সীমার ভিত্তিতে মিলবে।

## ১. Courier Overview

**উপরের সারি (KPI কার্ড)**
- মোট পাঠানো পার্সেল
- Delivered সংখ্যা + Delivery Success Rate (%)
- Returned সংখ্যা + Return Rate (%)
- In Transit / Pending
- COD সংগৃহীত টাকা

**Courier Comparison Table (মূল অংশ)**
প্রতিটি কুরিয়ারের এক লাইন, কুরিয়ারের লোগো ও ব্র্যান্ড রঙসহ:

```text
Courier    Total  Pending  In-Transit  Delivered  Returned  Cancelled  Success%  Return%  COD ৳   Avg Days
Steadfast   120     10         18         85          6         1        70.8%     5.0%   ৳96,400   2.4
Pathao       64      4          9         48          3         0        75.0%     4.7%   ৳51,200   1.9
```

- যেকোনো কলামে ক্লিক করে সাজানো যাবে (sort)
- Success% রঙে চিহ্নিত: ভালো = সবুজ, মাঝারি = অ্যাম্বার, খারাপ = লাল
- সেরা পারফর্মারের পাশে "Best" ব্যাজ
- সারিতে ক্লিক করলে সেই কুরিয়ারের অর্ডার তালিকায় (Courier Orders) ফিল্টার হয়ে চলে যাবে

**চার্ট**
- Stacked bar: প্রতি কুরিয়ারে Delivered / In-transit / Returned / Cancelled
- Line: সময় অনুযায়ী Delivery Success Rate, কুরিয়ার প্রতি একটি লাইন

**অতিরিক্ত**
- Empty state: কোনো কুরিয়ার কানেক্ট না থাকলে Couriers সেটিংসে যাওয়ার বাটন
- CSV ডাউনলোড বাটন

## ২. Payment Gateway Overview

**উপরের সারি (KPI কার্ড)**
- মোট ট্রানজেকশন সংখ্যা
- Successful টাকা (মোট আদায়)
- Success Rate (%)
- Failed + Pending সংখ্যা
- Refunded টাকা

**Gateway Comparison Table**

```text
Gateway     Txn   Success  Failed  Pending  Refunded  Success%  Amount ৳    Avg Value  Share%
bKash       210     186       14       6        4      88.6%   ৳2,41,000    ৳1,296     46%
SSLCommerz   95      88        5       2        1      92.6%   ৳1,18,500    ৳1,347     23%
COD         160     140        0      20        3      87.5%   ৳1,60,200    ৳1,144     31%
```

- গেটওয়ের লোগো ও ব্র্যান্ড রঙ (বিদ্যমান payment brand রেজিস্ট্রি থেকে)
- Success% রঙ-চিহ্নিত, সেরা গেটওয়েতে "Best" ব্যাজ
- সারিতে ক্লিক করলে সেই গেটওয়ের ট্রানজেকশন তালিকা খুলবে

**চার্ট**
- Donut: গেটওয়ে অনুযায়ী আদায়কৃত টাকার ভাগ
- Stacked bar: প্রতি গেটওয়েতে Success / Failed / Pending / Refunded
- Line: সময় অনুযায়ী আদায়কৃত টাকা, গেটওয়ে প্রতি একটি লাইন

**অতিরিক্ত**
- "Failed বেশি হচ্ছে" ধরনের সতর্কবার্তা যখন কোনো গেটওয়ের Success Rate নির্ধারিত সীমার নিচে নামে
- CSV ডাউনলোড বাটন

## ডিজাইন নীতি

- বিদ্যমান Analytics কার্ড/KPI স্টাইল ও ডিজাইন টোকেনই ব্যবহার হবে — নতুন কোনো রঙ হার্ডকোড হবে না
- মোবাইলে টেবিল কার্ড-লিস্টে পরিণত হবে (প্রতি কুরিয়ার/গেটওয়ে একটি কার্ড)
- লোড অবস্থায় স্কেলিটন, ডেটা না থাকলে পরিষ্কার খালি-অবস্থা বার্তা

## কারিগরি অংশ

**ডেটা উৎস (সবই বিদ্যমান টেবিল — কোনো স্কিমা পরিবর্তন নয়)**
- Courier: `courier_parcels` (store_id, courier_key, status, cod_amount, collection_status, created_at) — পার্সেল না থাকা অর্ডারের জন্য `orders.courier_code / courier_name / courier_status` fallback; return গণনায় `returns`
- Payment: `payments` (store_id, method, status, amount, created_at) এবং `orders.payment_gateway_name / payment_status / paid_amount`

**সার্ভার**
- নতুন `src/lib/ops-analytics.server.ts` — `computeCourierOverview()` ও `computePaymentOverview()`; store-scoped, তারিখ-রেঞ্জ ও তুলনা-রেঞ্জ সমর্থন
- নতুন `src/lib/ops-analytics.functions.ts` — `requireSupabaseAuth` middleware সহ দুটি server function, বিদ্যমান analytics-এর মতো plan gate
- স্ট্যাটাসগুলো একটি ম্যাপারে স্বাভাবিকীকরণ হবে (delivered / in_transit / pending / returned / cancelled; success / failed / pending / refunded), যাতে কুরিয়ারভেদে আলাদা স্ট্যাটাস নাম একই বালতিতে পড়ে — বিদ্যমান `src/lib/couriers/status.ts` পুনঃব্যবহার

**ফ্রন্টএন্ড**
- `src/components/admin/analytics/CourierOverview.tsx`, `PaymentOverview.tsx` এবং শেয়ার্ড `ComparisonTable.tsx`
- `src/routes/_authenticated/admin/analytics.tsx`-এ ট্যাব সুইচ (Overview / Courier / Payment), প্রতিটি ট্যাবের ডেটা আলাদা query key-তে
- Recharts ব্যবহার হবে (ইতিমধ্যেই প্রকল্পে আছে)

**পরিধির বাইরে:** পেমেন্ট বা কুরিয়ার লজিক, ডেটাবেস স্কিমা, চেকআউট প্রবাহ — কিছুই বদলাবে না; এটি শুধু রিপোর্টিং।
