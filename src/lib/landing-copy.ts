/**
 * Bilingual landing-page copy.
 *
 * Bangla ("bn") is a professional Banglish mix: SaaS / technical terms stay in
 * English (eCommerce, AI Sales Agent, Courier Integration, Dashboard, Facebook
 * Pixel, SEO, Analytics, Messenger, WhatsApp) while the surrounding sentence is
 * natural, professional Bengali.
 */

export type CopyPair = { en: string; bn: string };

export const LANDING_COPY = {
  /* Header */
  nav_home: { en: "Home", bn: "হোম" },
  nav_features: { en: "Features", bn: "ফিচার" },
  nav_ai: { en: "AI", bn: "AI" },
  nav_pricing: { en: "Pricing", bn: "প্যাকেজ" },
  nav_faq: { en: "FAQ", bn: "FAQ" },
  nav_contact: { en: "Contact", bn: "যোগাযোগ" },
  sign_in: { en: "Sign In", bn: "সাইন ইন" },
  create_store: { en: "Create Store", bn: "স্টোর খুলুন" },
  lang_label: { en: "Language", bn: "ভাষা" },

  /* Hero */
  hero_badge: { en: "Trusted by 1,000+ store owners", bn: "১,০০০+ স্টোর ওনারের আস্থা" },
  hero_title_1: { en: "Create Your Online Store", bn: "আপনার অনলাইন স্টোর তৈরি করুন" },
  hero_title_2: { en: "in Minutes.", bn: "মাত্র কয়েক মিনিটে।" },
  hero_sub: {
    en: "Everything you need to launch and grow your eCommerce business — store builder, AI sales agent, Messenger automation, courier integration, Facebook Pixel, analytics, payments and inventory — all in one platform.",
    bn: "আপনার eCommerce ব্যবসা শুরু ও বড় করার সবকিছু — Store Builder, AI Sales Agent, Messenger Automation, Courier Integration, Facebook Pixel, Analytics, Payments এবং Inventory — সব এক প্ল্যাটফর্মে।",
  },
  hero_cta_primary: { en: "Create Free Store", bn: "বিনামূল্যে স্টোর খুলুন" },
  hero_cta_secondary: { en: "Watch Demo", bn: "ডেমো দেখুন" },
  hero_point_1: { en: "No credit card required", bn: "ক্রেডিট কার্ড লাগবে না" },
  hero_point_2: { en: "Free forever plan", bn: "আজীবন ফ্রি প্ল্যান" },
  hero_point_3: { en: "Setup in 3 minutes", bn: "৩ মিনিটেই সেটআপ" },

  /* Trust bar */
  stat_stores: { en: "Stores Created", bn: "স্টোর তৈরি হয়েছে" },
  stat_orders: { en: "Orders Processed", bn: "অর্ডার প্রসেস হয়েছে" },
  stat_uptime: { en: "Uptime", bn: "Uptime" },
  stat_monitoring: { en: "Platform Monitoring", bn: "প্ল্যাটফর্ম মনিটরিং" },

  /* Features */
  features_eyebrow: { en: "Platform", bn: "প্ল্যাটফর্ম" },
  features_title: { en: "Everything you need to sell online", bn: "অনলাইনে বিক্রির জন্য যা যা দরকার, সবই আছে" },
  features_sub: {
    en: "12 production-grade modules built into every store — no plugins, no add-ons, no slowdowns.",
    bn: "প্রতিটি স্টোরে ১২টি প্রফেশনাল মডিউল বিল্ট-ইন — কোনো plugin নেই, add-on নেই, স্লো হওয়ার ভয় নেই।",
  },

  /* AI showcase */
  ai_eyebrow: { en: "AI Sales Agent", bn: "AI Sales Agent" },
  ai_title: {
    en: "An always-on salesperson trained on your store",
    bn: "আপনার স্টোরের উপর ট্রেইন করা ২৪/৭ সেলসপারসন",
  },
  ai_sub: {
    en: "Turn every message into a confirmed order. ORZEN's AI handles pre-sales, objections and checkout — before your team even opens the app.",
    bn: "প্রতিটি মেসেজকে কনফার্ম অর্ডারে পরিণত করুন। ORZEN-এর AI প্রি-সেলস, কাস্টমারের প্রশ্ন ও checkout সামলায় — আপনার টিম অ্যাপ খোলার আগেই।",
  },
  ai_point_1: {
    en: "Replies to customers instantly, in Bangla or English",
    bn: "বাংলা বা ইংরেজিতে সঙ্গে সঙ্গে কাস্টমারকে রিপ্লাই দেয়",
  },
  ai_point_2: {
    en: "Answers product questions using your catalog",
    bn: "আপনার catalog থেকেই প্রোডাক্ট সংক্রান্ত প্রশ্নের উত্তর দেয়",
  },
  ai_point_3: {
    en: "Collects name, address and phone naturally",
    bn: "স্বাভাবিক আলাপেই নাম, ঠিকানা ও ফোন নম্বর নিয়ে নেয়",
  },
  ai_point_4: {
    en: "Confirms orders and hands off to your team",
    bn: "অর্ডার কনফার্ম করে আপনার টিমের কাছে হ্যান্ডওভার করে",
  },
  ai_point_5: {
    en: "Works 24/7 — never sleeps, never forgets",
    bn: "২৪/৭ কাজ করে — ঘুমায় না, ভুলেও যায় না",
  },
  ai_point_6: {
    en: "Connects Messenger, Store Chat and WhatsApp (soon)",
    bn: "Messenger, Store Chat এবং WhatsApp (শীঘ্রই) — সব একসাথে",
  },
  ai_cta: { en: "Try AI Demo", bn: "AI ডেমো দেখুন" },

  /* Workflow */
  workflow_eyebrow: { en: "How it works", bn: "যেভাবে কাজ করে" },
  workflow_title: {
    en: "From signup to first sale in an afternoon",
    bn: "সাইনআপ থেকে প্রথম বিক্রি — একদিনেই",
  },
  workflow_sub: {
    en: "A guided path from first login to scaling — every step handled inside ORZEN.",
    bn: "প্রথম লগইন থেকে ব্যবসা বড় করা পর্যন্ত ধাপে ধাপে গাইড — সব কিছুই ORZEN-এর ভেতরে।",
  },
  workflow_step: { en: "Step", bn: "ধাপ" },

  /* Dashboard showcase */
  product_eyebrow: { en: "Product", bn: "প্রোডাক্ট" },
  product_title: {
    en: "Every surface, built with the same care",
    bn: "প্রতিটি স্ক্রিন, একই যত্নে তৈরি",
  },
  product_sub: {
    en: "Admin, storefront, owner panel and AI console — one design language, zero learning curve.",
    bn: "Merchant Panel, স্টোরফ্রন্ট, Owner Panel ও AI Console — একই ডিজাইন ল্যাঙ্গুয়েজ, শেখার ঝামেলা নেই।",
  },

  /* Why ORZEN */
  why_eyebrow: { en: "Why ORZEN", bn: "কেন ORZEN" },
  why_title: {
    en: "Built for the way you actually sell",
    bn: "আপনি যেভাবে বিক্রি করেন, ঠিক সেভাবেই তৈরি",
  },

  /* Testimonials */
  testimonials_eyebrow: { en: "Customers", bn: "কাস্টমার" },
  testimonials_title: {
    en: "Loved by store owners across Bangladesh",
    bn: "সারা বাংলাদেশের স্টোর ওনারদের পছন্দ",
  },

  /* FAQ */
  faq_eyebrow: { en: "FAQ", bn: "FAQ" },
  faq_title: { en: "Everything you wanted to know", bn: "আপনার সব প্রশ্নের উত্তর" },
  faq_view_all: { en: "View all FAQs", bn: "সব প্রশ্ন দেখুন" },
  faq_show_less: { en: "Show less", bn: "কম দেখুন" },

  /* Final CTA */
  cta_badge: { en: "Free forever plan · No credit card", bn: "আজীবন ফ্রি প্ল্যান · ক্রেডিট কার্ড লাগবে না" },
  cta_title: { en: "Ready to Launch Your Store?", bn: "আপনার স্টোর চালু করতে প্রস্তুত?" },
  cta_sub: {
    en: "Start building today with ORZEN — everything you need to sell, in one platform.",
    bn: "আজই ORZEN দিয়ে শুরু করুন — বিক্রির জন্য যা যা দরকার, সব এক প্ল্যাটফর্মে।",
  },
  cta_primary: { en: "Create Store Free", bn: "ফ্রিতে স্টোর খুলুন" },
  cta_secondary: { en: "Explore Features", bn: "ফিচারগুলো দেখুন" },

  /* Footer */
  footer_contact: { en: "Contact", bn: "যোগাযোগ" },
  footer_product: { en: "Product", bn: "প্রোডাক্ট" },
  footer_company: { en: "Company", bn: "কোম্পানি" },
  footer_legal: { en: "Legal", bn: "লিগ্যাল" },
  footer_rights: { en: "All rights reserved.", bn: "সর্বস্বত্ব সংরক্ষিত।" },
} satisfies Record<string, CopyPair>;

export type CopyKey = keyof typeof LANDING_COPY;

/* -------------------------------------------------------------------------- */
/* List content                                                               */
/* -------------------------------------------------------------------------- */

export const FEATURE_COPY: { title: CopyPair; desc: CopyPair }[] = [
  {
    title: { en: "Store Builder", bn: "Store Builder" },
    desc: {
      en: "Drag-and-drop pages, categories and products in minutes.",
      bn: "কয়েক মিনিটেই ড্র্যাগ-অ্যান্ড-ড্রপে পেজ, ক্যাটাগরি ও প্রোডাক্ট সাজান।",
    },
  },
  {
    title: { en: "AI Sales Agent", bn: "AI Sales Agent" },
    desc: {
      en: "Autonomously answers questions and confirms orders 24/7.",
      bn: "নিজে থেকেই প্রশ্নের উত্তর দেয় ও ২৪/৭ অর্ডার কনফার্ম করে।",
    },
  },
  {
    title: { en: "Messenger AI", bn: "Messenger AI" },
    desc: {
      en: "Auto-reply on Facebook Messenger with your brand voice.",
      bn: "Facebook Messenger-এ আপনার ব্র্যান্ডের ভাষায় অটো-রিপ্লাই।",
    },
  },
  {
    title: { en: "Facebook Pixel", bn: "Facebook Pixel" },
    desc: {
      en: "Track, retarget and scale ads without touching code.",
      bn: "কোড ছাড়াই ট্র্যাকিং, রিটার্গেটিং ও অ্যাড স্কেল করুন।",
    },
  },
  {
    title: { en: "Courier Integration", bn: "Courier Integration" },
    desc: {
      en: "Pathao, Steadfast, RedX — one-click parcel booking.",
      bn: "Pathao, Steadfast, RedX — এক ক্লিকেই পার্সেল বুকিং।",
    },
  },
  {
    title: { en: "Inventory", bn: "Inventory" },
    desc: {
      en: "Real-time stock, variants, low-stock alerts and SKUs.",
      bn: "রিয়েল-টাইম স্টক, ভ্যারিয়েন্ট, low-stock অ্যালার্ট ও SKU।",
    },
  },
  {
    title: { en: "Coupons", bn: "Coupons" },
    desc: {
      en: "Percent, flat, first-order and code-based discounts.",
      bn: "পার্সেন্ট, ফ্ল্যাট, প্রথম অর্ডার ও কোড-ভিত্তিক ডিসকাউন্ট।",
    },
  },
  {
    title: { en: "Analytics", bn: "Analytics" },
    desc: {
      en: "Revenue, cohorts and product performance in one view.",
      bn: "রেভিনিউ, কাস্টমার কোহর্ট ও প্রোডাক্ট পারফরম্যান্স এক জায়গায়।",
    },
  },
  {
    title: { en: "Invoices", bn: "Invoices" },
    desc: {
      en: "Auto-generated, printable invoices with your branding.",
      bn: "আপনার ব্র্যান্ডিংসহ অটো-জেনারেটেড, প্রিন্টযোগ্য ইনভয়েস।",
    },
  },
  {
    title: { en: "SEO", bn: "SEO" },
    desc: {
      en: "Editable meta, sitemaps and structured data on every page.",
      bn: "প্রতিটি পেজে এডিটযোগ্য meta, sitemap ও structured data।",
    },
  },
  {
    title: { en: "Theme Customizer", bn: "Theme Customizer" },
    desc: {
      en: "Colors, fonts and layouts — no code, live preview.",
      bn: "কালার, ফন্ট ও লেআউট — কোড ছাড়াই, লাইভ প্রিভিউসহ।",
    },
  },
  {
    title: { en: "Multi Device Responsive", bn: "Multi Device Responsive" },
    desc: {
      en: "Pixel-perfect on 320px phones through 4K desktops.",
      bn: "৩২০px ফোন থেকে 4K ডেস্কটপ — সব জায়গায় নিখুঁত।",
    },
  },
];

export const STEP_COPY: { title: CopyPair; desc: CopyPair }[] = [
  {
    title: { en: "Create Account", bn: "অ্যাকাউন্ট খুলুন" },
    desc: {
      en: "Sign up in under 30 seconds — no credit card.",
      bn: "৩০ সেকেন্ডেই সাইনআপ — ক্রেডিট কার্ড লাগবে না।",
    },
  },
  {
    title: { en: "Create Store", bn: "স্টোর তৈরি করুন" },
    desc: {
      en: "Pick a template, set your brand and go live.",
      bn: "টেমপ্লেট বাছুন, ব্র্যান্ড সেট করুন, লাইভ হয়ে যান।",
    },
  },
  {
    title: { en: "Add Products", bn: "প্রোডাক্ট যোগ করুন" },
    desc: {
      en: "Import from CSV or add manually with variants.",
      bn: "CSV থেকে ইমপোর্ট করুন বা ভ্যারিয়েন্টসহ ম্যানুয়ালি যোগ করুন।",
    },
  },
  {
    title: { en: "Receive Orders", bn: "অর্ডার নিন" },
    desc: {
      en: "AI + Messenger + storefront funnel into one inbox.",
      bn: "AI + Messenger + স্টোরফ্রন্ট — সব অর্ডার এক Inbox-এ।",
    },
  },
  {
    title: { en: "Courier Booking", bn: "Courier Booking" },
    desc: {
      en: "One-click parcel with Pathao, Steadfast, RedX.",
      bn: "Pathao, Steadfast, RedX-এ এক ক্লিকেই পার্সেল বুকিং।",
    },
  },
  {
    title: { en: "Delivery", bn: "ডেলিভারি" },
    desc: {
      en: "Real-time tracking and automatic status updates.",
      bn: "রিয়েল-টাইম ট্র্যাকিং ও অটোমেটিক স্ট্যাটাস আপডেট।",
    },
  },
  {
    title: { en: "Analytics & Growth", bn: "Analytics ও গ্রোথ" },
    desc: {
      en: "See what sells, retarget with Pixel, scale profits.",
      bn: "কী বিক্রি হচ্ছে দেখুন, Pixel দিয়ে রিটার্গেট করুন, লাভ বাড়ান।",
    },
  },
];

export const WHY_COPY: { title: CopyPair; desc: CopyPair }[] = [
  {
    title: { en: "No Coding Required", bn: "কোডিং লাগবে না" },
    desc: {
      en: "Visual editor, no plugins, no dev team needed.",
      bn: "ভিজ্যুয়াল এডিটর — plugin নেই, ডেভেলপার টিমও লাগবে না।",
    },
  },
  {
    title: { en: "Fast Setup", bn: "দ্রুত সেটআপ" },
    desc: {
      en: "From signup to live store in under 10 minutes.",
      bn: "সাইনআপ থেকে লাইভ স্টোর — ১০ মিনিটেরও কম সময়ে।",
    },
  },
  {
    title: { en: "AI Powered", bn: "AI Powered" },
    desc: {
      en: "Sales agent, product descriptions, replies — all AI.",
      bn: "Sales Agent, প্রোডাক্ট ডেসক্রিপশন, রিপ্লাই — সবই AI দিয়ে।",
    },
  },
  {
    title: { en: "Bangladesh Friendly", bn: "বাংলাদেশ ফ্রেন্ডলি" },
    desc: {
      en: "৳ pricing, Bangla UI, bKash & local checkouts.",
      bn: "৳ প্রাইসিং, বাংলা UI, bKash ও লোকাল checkout।",
    },
  },
  {
    title: { en: "Courier Ready", bn: "Courier Ready" },
    desc: {
      en: "Native Pathao, Steadfast, RedX and more.",
      bn: "Pathao, Steadfast, RedX-সহ আরও অনেক কুরিয়ার বিল্ট-ইন।",
    },
  },
  {
    title: { en: "Facebook Ready", bn: "Facebook Ready" },
    desc: {
      en: "Pixel, Conversions API and Messenger built in.",
      bn: "Pixel, Conversions API ও Messenger বিল্ট-ইন।",
    },
  },
  {
    title: { en: "Mobile First", bn: "Mobile First" },
    desc: {
      en: "Optimized for 80% of your customers on mobile.",
      bn: "আপনার ৮০% কাস্টমার মোবাইলে — সেভাবেই অপটিমাইজড।",
    },
  },
  {
    title: { en: "Affordable Pricing", bn: "সাশ্রয়ী প্রাইসিং" },
    desc: {
      en: "Start free. Paid plans from just ৳ 299/mo.",
      bn: "ফ্রিতে শুরু করুন। পেইড প্ল্যান মাত্র ৳ ২৯৯/মাস থেকে।",
    },
  },
];

export const FAQ_COPY: { q: CopyPair; a: CopyPair }[] = [
  {
    q: { en: "Is there really a free plan?", bn: "সত্যিই কি ফ্রি প্ল্যান আছে?" },
    a: {
      en: "Yes. The Free plan is forever-free with 1 store, 10 products and 30 orders/month — no credit card required.",
      bn: "হ্যাঁ। Free প্ল্যান আজীবন ফ্রি — ১টি স্টোর, ১০টি প্রোডাক্ট ও মাসে ৩০টি অর্ডার, ক্রেডিট কার্ড লাগবে না।",
    },
  },
  {
    q: { en: "How does the pricing work?", bn: "প্রাইসিং কীভাবে কাজ করে?" },
    a: {
      en: "Pick a plan and a billing cycle. Longer cycles get automatic discounts: 10% (3M), 20% (6M), 30% (yearly).",
      bn: "একটি প্ল্যান ও billing cycle বেছে নিন। লম্বা সাইকেলে অটোমেটিক ডিসকাউন্ট: ১০% (৩ মাস), ২০% (৬ মাস), ৩০% (বার্ষিক)।",
    },
  },
  {
    q: { en: "Can I cancel any time?", bn: "যেকোনো সময় বাতিল করা যাবে?" },
    a: {
      en: "Yes. Cancel from the billing page — you keep access until the end of your paid cycle.",
      bn: "হ্যাঁ। Billing পেজ থেকে বাতিল করুন — পেইড সাইকেল শেষ হওয়া পর্যন্ত access থাকবে।",
    },
  },
  {
    q: { en: "Which payment methods do you support?", bn: "কোন কোন পেমেন্ট মেথড সাপোর্ট করে?" },
    a: {
      en: "Cards, bKash, Nagad, Rocket and bank transfer for annual plans.",
      bn: "কার্ড, bKash, Nagad, Rocket এবং বার্ষিক প্ল্যানে ব্যাংক ট্রান্সফার।",
    },
  },
  {
    q: { en: "Does the AI understand Bangla?", bn: "AI কি বাংলা বোঝে?" },
    a: {
      en: "Yes — the AI Sales Agent replies in Bangla, English or a natural mix, matched to your customer.",
      bn: "হ্যাঁ — AI Sales Agent কাস্টমার অনুযায়ী বাংলা, ইংরেজি বা স্বাভাবিক মিশ্র ভাষায় রিপ্লাই দেয়।",
    },
  },
  {
    q: { en: "Can the AI actually confirm orders?", bn: "AI কি সত্যিই অর্ডার কনফার্ম করতে পারে?" },
    a: {
      en: "Yes. It collects name, address, phone and preferred courier, then creates the order in your admin.",
      bn: "হ্যাঁ। নাম, ঠিকানা, ফোন ও পছন্দের কুরিয়ার নিয়ে Merchant Panel-এ অর্ডার তৈরি করে দেয়।",
    },
  },
  {
    q: { en: "Which couriers are supported?", bn: "কোন কুরিয়ারগুলো সাপোর্ট করে?" },
    a: {
      en: "Pathao, Steadfast, RedX, Sundarban and eCourier — with one-click parcel booking from any order.",
      bn: "Pathao, Steadfast, RedX, Sundarban ও eCourier — যেকোনো অর্ডার থেকে এক ক্লিকে পার্সেল বুকিং।",
    },
  },
  {
    q: { en: "Does Facebook Pixel work with iOS 14+?", bn: "Facebook Pixel কি iOS 14+ এ কাজ করে?" },
    a: {
      en: "Yes — we send events via both browser Pixel and server-side Conversions API for accuracy.",
      bn: "হ্যাঁ — নির্ভুল ট্র্যাকিংয়ের জন্য ব্রাউজার Pixel ও server-side Conversions API দুটো দিয়েই ইভেন্ট পাঠানো হয়।",
    },
  },
  {
    q: { en: "Can I connect Facebook Messenger?", bn: "Facebook Messenger যুক্ত করা যাবে?" },
    a: {
      en: "Yes. Connect your Page in Settings — replies flow through the AI or your team.",
      bn: "হ্যাঁ। Settings থেকে আপনার Page কানেক্ট করুন — রিপ্লাই যাবে AI অথবা আপনার টিমের মাধ্যমে।",
    },
  },
  {
    q: { en: "Is there a free trial on paid plans?", bn: "পেইড প্ল্যানে কি ফ্রি ট্রায়াল আছে?" },
    a: {
      en: "New stores get a 3-day free trial with all features unlocked.",
      bn: "নতুন স্টোরে ৩ দিনের ফ্রি ট্রায়াল — সব ফিচার আনলকড।",
    },
  },
  {
    q: { en: "How fast is support?", bn: "সাপোর্ট কত দ্রুত পাওয়া যায়?" },
    a: {
      en: "Community for Free, Email for Basic, Priority (under 2h) for Business, Dedicated for Custom.",
      bn: "Free-তে কমিউনিটি, Basic-এ ইমেইল, Business-এ Priority (২ ঘণ্টার মধ্যে), Custom-এ ডেডিকেটেড সাপোর্ট।",
    },
  },
  {
    q: { en: "Can I bring my own domain?", bn: "নিজের ডোমেইন ব্যবহার করা যাবে?" },
    a: {
      en: "Yes — from Basic and up you can connect any custom domain in a few clicks.",
      bn: "হ্যাঁ — Basic ও তার উপরের প্ল্যানে কয়েক ক্লিকেই custom domain যুক্ত করা যায়।",
    },
  },
  {
    q: { en: "Do I own my data?", bn: "ডেটার মালিকানা কি আমার?" },
    a: {
      en: "Always. Export orders, customers and products as CSV whenever you want.",
      bn: "অবশ্যই। যখন খুশি অর্ডার, কাস্টমার ও প্রোডাক্ট CSV আকারে export করতে পারবেন।",
    },
  },
  {
    q: { en: "Can I switch themes later?", bn: "পরে থিম পরিবর্তন করা যাবে?" },
    a: {
      en: "Yes. All themes are hot-swappable and preserve your content.",
      bn: "হ্যাঁ। সব থিম যেকোনো সময় বদলানো যায় এবং কনটেন্ট অক্ষত থাকে।",
    },
  },
  {
    q: { en: "Do you handle hosting and updates?", bn: "হোস্টিং ও আপডেট কি আপনারা দেখেন?" },
    a: {
      en: "Yes. Hosting, SSL, backups and updates are fully managed — 99.9% uptime SLA.",
      bn: "হ্যাঁ। হোস্টিং, SSL, ব্যাকআপ ও আপডেট সম্পূর্ণ ম্যানেজড — ৯৯.৯% uptime SLA।",
    },
  },
];
