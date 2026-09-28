# ORZEN মূল ওয়েবসাইটের জন্য Meta Pixel + CAPI

## লক্ষ্য
orzen.top-এর মূল ওয়েবসাইটের (merchant store নয়) পুরো user journey Meta Pixel (browser) আর Conversions API (server) দিয়ে ট্র্যাক করা হবে। সব সেটিং থাকবে শুধু Winner Admin Panel-এ। Merchant Panel-এ এর কোনো অপশন থাকবে না। Merchant store-এর pixel যেমন আছে তেমনই আলাদা থাকবে।

## ধাপ ১: Audit (শুরুতেই যাচাই)
এখন পর্যন্ত যা দেখা গেছে:
- সাইনআপ/লগইন হয় `/auth` পেজে।
- Plan checkout হয় `admin/billing.checkout.$packageId`-এ।
- Gateway-verified payment নিশ্চিত হয় subscription-pay webhook-এ। সেখানে invoice "paid" হয় এবং `activateSubscriptionForOrder` subscription চালু করে।
- Trial চালু হয় `start_trial_for_store` দিয়ে।
- Wallet top-up-ও একই webhook দিয়ে যায়।
- Owner-এর বর্তমান "Marketing" পেজটা (`marketing_pixel_defaults`) merchant-দের default pixel সেট করার জন্য। মূল সাইটের tracking-এর সাথে এর সম্পর্ক নেই। এটা যেমন আছে তেমনই থাকবে।

Implementation-এর আগে বাকি flow-গুলো (onboarding/store তৈরি, free plan, coupon, retry) কোডে মিলিয়ে নিশ্চিত করা হবে।

## ধাপ ২: কোন কোন event ট্র্যাক হবে
| ধাপ | Event | কোথা থেকে পাঠানো হবে |
|---|---|---|
| মূল সাইটের যেকোনো পেজ খোলা (SPA route বদলালেও) | PageView | Browser + Server |
| Pricing/plan দেখা | ViewContent | Browser + Server |
| সাইনআপ সফল | CompleteRegistration | Server (একই event ID দিয়ে browser থেকেও) |
| Store তৈরি / onboarding শেষ | Lead (custom: OnboardingComplete) | Server |
| Trial শুরু | StartTrial | Server |
| Plan checkout খোলা | InitiateCheckout | Browser + Server |
| Payment পদ্ধতি বাছাই / gateway-তে যাওয়া | AddPaymentInfo | Browser + Server |
| Gateway-verified payment সফল | Purchase / Subscribe (value + BDT) | শুধু Server, webhook-এ verify হওয়ার পর |
| Wallet top-up সফল | custom: WalletTopup | শুধু Server |

নিয়ম:
- হাতে approve করা payment (manual) Purchase হিসেবে গোনা হবে না।
- একই invoice-এর জন্য Purchase মাত্র একবার যাবে: webhook বারবার এলে বা retry হলেও দ্বিতীয়বার যাবে না।
- Browser আর server একই event ID ব্যবহার করবে, তাই Meta একই event দুইবার গুনবে না।

## ধাপ ৩: Winner Admin Panel-এর সেটিং
নতুন পেজ "Main Website Tracking", যেখানে admin নিচের সবকিছু নিয়ন্ত্রণ করতে পারবেন:
- পুরো tracking চালু/বন্ধ; Pixel আর CAPI আলাদাভাবে চালু/বন্ধ
- Pixel ID; CAPI token (একবার সেভ হলে আর দেখা যাবে না, শুধু বদলানো যাবে)
- Test Event Code
- প্রতিটা event আলাদাভাবে চালু/বন্ধ
- Customer তথ্য (hashed email/phone) পাঠানো হবে কিনা, সেই অপশন
- "Test event পাঠাও" বাটন
- শেষ ২০টা পাঠানো ও ব্যর্থ event-এর লগ, সাথে Meta-র উত্তর

এই পেজ শুধু owner role-এর জন্য।

## ধাপ ৪: অনুমতি ও privacy
- **ইউরোপ/UK-এর মতো দেশ:** যেসব দেশে আইনত অনুমতি লাগে, সেখানের visitor-রা একটা ছোট অনুমতি banner দেখবে। "Accept" আর "Reject" সমান সহজ থাকবে, আর পরে মত বদলানো যাবে। অনুমতি না দিলে সেই visitor-এর কোনো browser বা server event যাবে না।
- **Bangladesh-সহ বাকি দেশ:** banner ছাড়াই tracking চলবে।
- **অনুমতির রেকর্ড:** কে, কখন, কোন লেখা দেখে অনুমতি দিয়েছে, সেটা রাখা হবে। অনুমতি তুলে নিলে সাথে সাথে সব পাঠানো বন্ধ হবে।
- **Privacy policy:** Meta কী তথ্য পায় এবং কেন পায়, সেটা privacy policy পেজে যোগ করা হবে।

## ধাপ ৫: যাচাই
- Test Event Code দিয়ে প্রতিটা event browser + server থেকে পাঠানো হবে, আর Meta-র উত্তর মিলিয়ে দেখা হবে যে একই event দুইবার গোনা হচ্ছে না।
- Mobile আর desktop screen-এ Playwright দিয়ে পেজ ঘুরে দেখা হবে (Chrome engine, আর iPhone Safari-র মতো user agent দিয়ে)।
- Merchant store পেজে যে মূল সাইটের pixel লোড হয় না, সেটা নিশ্চিত করা হবে।
- তারপর build, parity check, আর wrangler দিয়ে orzen.top-এ deploy।
- শেষে বাংলায় রিপোর্ট: কী ট্র্যাক হচ্ছে, কী কাজ করছে, কোথায় ঝুঁকি আছে।

বি.দ্র.: আসল Meta account-এ event পৌঁছাচ্ছে কিনা দেখার জন্য আপনাকে Pixel ID আর CAPI token দিতে হবে। Admin পেজে বসাতে পারবেন।

## Technical details
- **Table:** নতুন table `platform_meta_tracking` (singleton), শুধু owner-এর RLS সহ। Token AES দিয়ে encrypt করা থাকবে (`CREDENTIALS_ENCRYPTION_KEY`)। Client-এ শুধু `pixel_id`, flag-গুলো আর `has_token` যাবে।
- **লগ table:** `platform_meta_events` — event_id-এ unique, status sent/failed/skipped, attempts, response। একই `event_id` দ্বিতীয়বার insert করা যাবে না, এভাবেই server-side idempotency নিশ্চিত হবে।
- **Migration:** একই migration production আর dev দুই জায়গায় চালানো হবে।
- **Server code:**
  - `src/lib/platform-meta.server.ts`: config load (TTL cache নয়, কারণ token), আর `sendPlatformEvent()`। এটা বিদ্যমান `fb-capi.server.ts`-এর hashing ব্যবহার করবে, কিন্তু merchant-এর config কখনো পড়বে না।
  - `/api/public/platform-meta/track`: browser event-এর জন্য। শুধু allowlist-এ থাকা event নেবে, rate limit (`guardRequest`) থাকবে, host মূল ডোমেইন কিনা যাচাই করবে, Purchase বা Subscribe নেবে না।
- **Browser:** `src/lib/platform-pixel.ts` + `PlatformPixel` component, `__root`-এ বসবে। Pathname `/store/*`, landing page বা custom-domain host হলে render হবে না। Pixel script `fbq` একটা আলাদা key-তে guard করা থাকবে, যাতে merchant-এর `fb-track.ts`-এর সাথে সংঘাত না হয়। `_fbp`/`_fbc` পড়া হবে; URL-এর `fbclid` থেকে `_fbc` তৈরি হবে। Route বদলালে PageView যাবে, একই event ID server-এও যাবে। Region জানা হবে `/cdn-cgi/trace` থেকে।
- **Hook-গুলো কোথায়:**
  - `auth.tsx`-এ signUp সফল হলে একটা server fn → CompleteRegistration।
  - Store তৈরি আর trial শুরুর server fn-এ Lead/StartTrial।
  - Checkout পেজে InitiateCheckout/AddPaymentInfo।
  - `subscription-pay/webhook.$provider.ts`-এ "paid" branch-এর পরে Purchase/Subscribe, event_id = `purchase_<invoiceId>`।
  - ব্যর্থ হলে একবার retry হবে; তারপর লগে থাকবে। কোনোটাতেই business flow আটকাবে না।
- **Consent:** `orzen_consent` cookie + `platform_consent_records` table (visitor id, সময়, notice version, পছন্দ)। Server route প্রতিবার পাঠানোর আগে consent পড়বে।
- **AGENTS.md:** মূল সাইট আর merchant tracking-এর isolation নিয়ম যোগ হবে।
