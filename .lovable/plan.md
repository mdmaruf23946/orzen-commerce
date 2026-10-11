# ধাপ ১: কোর টেকনিক্যাল SEO ও বাগ ফিক্স

কোনো ডাটাবেজ পরিবর্তন নেই, কোনো AI খরচ নেই। শুধু বর্তমান তথ্য সঠিকভাবে Google-কে দেখানো।

## ১. মার্চেন্ট প্রোডাক্ট পেজ
- প্রোডাক্ট এডিটরে মার্চেন্ট যে SEO title, meta description, keywords লেখেন, লাইভ প্রোডাক্ট পেজে সেটাই দেখাবে।
- কিছু না লিখলে আগের মতো স্বয়ংক্রিয়ভাবে নাম + বর্ণনা থেকে তৈরি হবে (ক্রম: কাস্টম → অটো)।
- প্রোডাক্ট ছবির alt লেখা = প্রোডাক্টের নাম (গ্যালারি ও related কার্ডে)।
- প্রোডাক্ট পেজে canonical লিংক, Product + Breadcrumb স্কিমায় কাস্টম বর্ণনা ব্যবহার।
- স্টোর সেটিংসে "noindex" চালু থাকলে প্রোডাক্ট পেজেও noindex।

## ২. মূল প্ল্যাটফর্ম (orzen.top)
- হোম পেজ: সমৃদ্ধ title/description, Open Graph, Twitter card, canonical।
- JSON-LD: Organization, WebSite, SoftwareApplication (নাম, ক্যাটাগরি, প্ল্যানের দাম ডাটাবেজের প্যাকেজ থেকে — বানানো দাম নয়)।
- About, Contact, Privacy, Terms, Refund, Shipping, Data-deletion পেজ — প্রতিটিতে আলাদা title/description/canonical।
- নতুন পাবলিক পেজ: `/features` ও `/pricing` (বর্তমানে নেই) — বিদ্যমান ফিচার তালিকা ও প্যাকেজ ডাটা থেকে তৈরি, নিজস্ব মেটা সহ।
- OG ইমেজ: ১২০০x৬৩০ একটি ব্র্যান্ড শেয়ার ছবি তৈরি করে public URL-এ রাখা।
- লগইন/অ্যাডমিন/অ্যাকাউন্ট পেজ noindex।

## ৩. Sitemap ও Robots
- প্ল্যাটফর্ম sitemap-এ `/features`, `/pricing` যোগ; সব সময় orzen.top ডোমেইন।
- স্টোর sitemap: ক্যাটাগরি URL ঠিক করা, `lastmod` প্রোডাক্ট আপডেট সময় থেকে; সাবডোমেইন ও কাস্টম ডোমেইনে নিজ ডোমেইন দেখাবে, অন্য মার্চেন্টের ডাটা কখনো না।
- প্ল্যাটফর্ম robots.txt-এ `/admin`, `/owner`, `/auth`, API পথ Disallow।
- নতুন প্রোডাক্ট যোগ হলে sitemap স্বয়ংক্রিয়ভাবে আপডেট (এটা ইতিমধ্যে লাইভ ডাটা থেকে তৈরি হয় — যাচাই করা হবে)।

## যাচাই
- Preview-তে হোম, features, pricing, একটি প্রোডাক্ট পেজের HTML থেকে মেটা/স্কিমা পরীক্ষা।
- `/sitemap.xml`, `/robots.txt` প্ল্যাটফর্ম ও স্টোর হোস্ট দুটোতেই পরীক্ষা।
- তারপর আপনার অনুমতিতে guarded wrangler দিয়ে orzen.top-এ লাইভ।

## Technical details
- `product.$productId.tsx` head: `p.meta?.seo?.title/description/keywords` অগ্রাধিকার; `link rel=canonical`।
- নতুন `src/lib/platform-seo.ts` — platform JSON-LD builders; `routes/features.tsx`, `routes/pricing.tsx` (public plans read via existing public function)।
- `sitemap[.]xml.ts` paths আপডেট; `seo.server.ts` renderSitemap category URL ফিক্স; `robots[.]txt.ts` platform Disallow।
- `__root.tsx`-এ og:image/canonical রাখা হবে না (leaf-only)।
