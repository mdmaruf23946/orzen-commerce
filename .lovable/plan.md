# ORZEN Merchant Email Branding — বাস্তবায়ন পরিকল্পনা

## লক্ষ্য
মার্চেন্টদের কাছে ORZEN থেকে যাওয়া সব Security, Authentication, Billing ও Platform notification email-কে একটি একক, premium, mobile-friendly branded template-এ আনা।

এই কাজের কঠোর সীমা:
- ORZEN-এর email শুধুমাত্র merchant/owner/platform administrator-দের কাছে যাবে।
- Merchant-এর customer-এর কাছে ORZEN sender, ORZEN branding বা ORZEN fallback email যাবে না।
- Customer email পাঠানো যাবে কেবল merchant-এর নিজস্ব connected email provider ও merchant branding দিয়ে; provider না থাকলে email পাঠানো হবে না।

## চূড়ান্ত ডিজাইন

### Header
- সাদা, পরিষ্কার branded header।
- Owner Panel-এ প্রকাশিত **Global ORZEN logo/wordmark** ব্যবহার হবে।
- Email client-এ relative image কাজ না করার সমস্যা এড়াতে logo URL-কে `https://orzen.top`-এর absolute URL করা হবে।
- Logo না থাকলে সুন্দর text-based `ORZEN` fallback থাকবে; email ভাঙবে না।
- Security email-এ ছোট shield/security label, Billing email-এ receipt/billing label, Platform email-এ notification label থাকবে।

### Body
- বাংলা প্রধান ভাষা; গুরুত্বপূর্ণ action/security terms English-সহ থাকবে।
- পরিষ্কার title, short summary, প্রয়োজনীয় detail block এবং একটি primary action button।
- Verification/reset code বড় ও সহজে পড়া যায় এমন block-এ থাকবে; expiry এবং “এই অনুরোধ আপনি না করলে কী করবেন” লেখা থাকবে।
- Login alert, 2FA change, subscription, payment ও publication email-এ তথ্যগুলো scannable rows/status block-এ থাকবে।
- কোনো password, secret, full token বা অপ্রয়োজনীয় sensitive তথ্য দেখানো হবে না।

### Footer
- `support@orzen.top` mail link।
- Owner Panel-এর contact phone থাকলে সেটিকে WhatsApp link হিসেবে দেখানো হবে; ফাঁকা থাকলে পুরো WhatsApp item লুকানো থাকবে।
- `orzen.top` website link।
- ছোট security/help note এবং copyright।
- কোনো বানানো phone, address বা legal information যোগ হবে না।

## যেসব ORZEN email এক করা হবে
1. Email verification code।
2. Password reset code।
3. Two-factor authentication enabled/disabled alert।
4. New sign-in security alert।
5. Merchant welcome/store-live email।
6. Subscription activated/confirmed email।
7. Landing page published email।
8. Subscription payment submitted, approved, rejected এবং receipt email।
9. Owner Panel থেকে পাঠানো test platform email।
10. Owner-created platform communication email—body একই safe ORZEN shell-এর ভেতরে থাকবে।

## বাস্তবায়ন

### 1. একক email design system
- বর্তমান shared email shell-কে logo, type, status style, button, info rows, code box, warning box, footer এবং plain-text fallback সমর্থনসহ উন্নত করা হবে।
- Platform branding ও footer settings server-side পড়ে একটি reusable `ORZEN email brand context` তৈরি হবে।
- Branding/settings পড়া ব্যর্থ হলেও safe fallback (`ORZEN`, `support@orzen.top`, `orzen.top`) দিয়ে email পাঠানো চলবে।

### 2. বিচ্ছিন্ন template একত্র করা
- Security/auth templates বর্তমান dedicated Resend → Mailjet failover বজায় রেখে নতুন design ব্যবহার করবে।
- Platform automation এবং test email একই design ব্যবহার করবে।
- Billing/subscription-এর আলাদা পুরোনো shell ও minimal receipt markup সরিয়ে shared design ব্যবহার করবে।
- Provider, rate limit, code expiry, resend limit, automation switch এবং business logic বদলানো হবে না।

### 3. Merchant-customer isolation enforcement
- Store notification path থেকে ORZEN/platform queue fallback সরানো বা কঠোরভাবে block করা হবে।
- Customer target থাকলে merchant-connected provider ছাড়া send attempt হবে না এবং clear internal reason log হবে।
- Merchant/admin recipient হলে তবেই ORZEN platform sender ব্যবহার করা যাবে।
- Digital delivery, order, return এবং customer-auth email paths audit করে নিশ্চিত করা হবে যে এগুলো ORZEN-branded shell-এ migrate হচ্ছে না। এই পর্যায়ে merchant customer template redesign করা হবে না।

### 4. নিরাপত্তা ও email compatibility
- সব dynamic text HTML-escape করা হবে; owner-created content-এর unsafe script/event attributes চলবে না।
- Table-based responsive layout ও inline styles ব্যবহার হবে, যাতে Gmail, Outlook, Apple Mail এবং mobile inbox-এ ঠিক থাকে।
- গুরুত্বপূর্ণ তথ্য image-এর ভেতর রাখা হবে না; image বন্ধ থাকলেও পুরো email বোঝা যাবে।
- Logo-তে meaningful alt text থাকবে এবং external font dependency থাকবে না।

## যাচাই
- প্রত্যেক ORZEN template-এর HTML ও plain-text output পরীক্ষা।
- Logo আছে/নেই, WhatsApp আছে/নেই—চারটি fallback অবস্থা পরীক্ষা।
- Security code, button URL, bilingual copy এবং mobile width পরীক্ষা।
- Test mailbox-এ verification, password reset, login alert, 2FA, welcome ও billing sample পাঠিয়ে rendering/delivery পরীক্ষা।
- Customer-addressed notification-এ merchant provider না থাকলে ORZEN থেকে email না যাওয়ার end-to-end পরীক্ষা।
- সফল project check-এর পর production deployment হবে শুধুমাত্র নির্ধারিত Cloudflare deployment পদ্ধতিতে; তারপর live email delivery ও website health পুনরায় যাচাই করা হবে।

## যা পরিবর্তন হবে না
- Resend/Mailjet security failover এবং বর্তমান sender separation।
- Authentication, verification code, 30-second cooldown, send limit বা Turnstile rules।
- Lovable Cloud-এর data; এটি dev/test/backup হিসেবেই থাকবে।
- Merchant-এর customer-facing branding/template এই কাজের অংশ নয়।
