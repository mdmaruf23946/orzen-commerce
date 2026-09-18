# Priority 1: HTTP Security Headers & HSTS

## লক্ষ্য
ORZEN-এর প্রতিটি পেজ ও API রেসপন্সে প্রোডাকশন-গ্রেড HTTP security headers যোগ করা — যাতে ব্রাউজার নিজেই হ্যাকারদের অনেক আক্রমণ (clickjacking, MIME sniffing, XSS, protocol downgrade) ব্লক করে দেয়। কোনো ডেটাবেস বা অ্যাপ লজিক পরিবর্তন হবে না — শুধু সার্ভার রেসপন্সে হেডার যোগ হবে।

## কোথায় যোগ হবে
`src/server.ts` — এখানে সব রেসপন্স একটিমাত্র জায়গা দিয়ে বের হয়, তাই এক জায়গায় যোগ করলেই পুরো সাইট (প্ল্যাটফর্ম + সব স্টোরফ্রন্ট + সব API) কভার হবে।

## যে হেডারগুলো যোগ হবে

1. **Strict-Transport-Security (HSTS)** — `max-age=63072000; includeSubDomains; preload`
   - ব্রাউজারকে বাধ্য করবে সবসময় HTTPS ব্যবহার করতে — HTTP-তে downgrade attack বন্ধ।
   - orzen.top + সব সাবডোমেন (স্টোরফ্রন্ট) কভার হবে।
   - শুধু HTTPS রিকোয়েস্টে পাঠানো হবে (workers.dev preview-তেও নিরাপদ)।

2. **X-Content-Type-Options: nosniff** — ফাইল টাইপ ভুল ব্যাখ্যা করে স্ক্রিপ্ট চালানো বন্ধ।

3. **X-Frame-Options: DENY** + **frame-ancestors 'none'** (CSP-তে) — clickjacking বন্ধ; কেউ আমাদের সাইটকে iframe-এ বসিয়ে ফিশিং করতে পারবে না।
   - ব্যতিক্রম: ল্যান্ডিং-পেজ embed ও checkout iframe দরকার হলে সেই নির্দিষ্ট রুটে শিথিল করা হবে — আগে কোডে embed ব্যবহার আছে কিনা যাচাই করব।

4. **Referrer-Policy: strict-origin-when-cross-origin** — বাইরের সাইটে URL/টোকেন লিক বন্ধ।

5. **Permissions-Policy** — camera, microphone, geolocation, USB ইত্যাদি ডিফল্টভাবে বন্ধ (অ্যাপে যেগুলো লাগে — যেমন AI voice/call ফিচারে microphone — সেগুলো self-এর জন্য অনুমোদিত থাকবে)।

6. **Cross-Origin-Opener-Policy: same-origin-allow-popups** — OAuth popup (Google login) না ভেঙে ট্যাব-আলাদাকরণ নিরাপত্তা।

7. **Content-Security-Policy (CSP)** — সবচেয়ে গুরুত্বপূর্ণ ও ঝুঁকিপূর্ণ:
   - সরাসরি কঠোর CSP লাগালে ছবি/ফন্ট/স্ক্রিপ্ট ভাঙতে পারে। তাই **দুই ধাপে**:
   - **ধাপ ১ (এই প্ল্যানে):** `Content-Security-Policy-Report-Only` — ব্রাউজার রিপোর্ট করবে কী ভাঙতো, কিন্তু কিছু ব্লক করবে না। Allowed: self, Google Fonts, Supabase, Cloudflare, Resend/payment/social embeds — যেসব বাহ্যিক উৎস অ্যাপ ব্যবহার করে (কোড স্ক্যান করে তালিকা বানানো হবে)।
   - **ধাপ ২ (পরে, আলাদা অনুমতিতে):** রিপোর্ট দেখে enforced CSP চালু।

8. **Cache-Control শুধু HTML-এ** — আগের no-store নিয়ম অক্ষত থাকবে; hashed static assets-এ immutable cache যোগ হবে না এই ধাপে (ঝুঁকি এড়াতে)।

## যা ভাঙবে না — সতর্কতা
- ল্যান্ডিং-পেজ embed (`embed.orders.ts`) ও webhook রেসপন্সে X-Frame-Options লাগবে না — যাচাই করে ব্যতিক্রম রাখা হবে।
- OAuth (Google) popup flow অক্ষত থাকবে।
- AI voice/call ফিচারের microphone অনুমতি থাকবে।
- সব নিয়ম শুধু response header — কোনো ডেটাবেস/অথ/লজিক পরিবর্তন নেই।

## ভেরিফিকেশন (লাইভ)
1. লোকাল বিল্ড/টাইপচেক পাস।
2. `scripts/deploy-production.sh` দিয়ে ডিপ্লয়।
3. orzen.top-এ `curl -I` দিয়ে সব হেডার লাইভে আছে কিনা যাচাই (প্ল্যাটফর্ম পেজ + একটি স্টোরফ্রন্ট সাবডোমেন + একটি API রুট)।
4. Playwright দিয়ে হোমপেজ, লগইন, একটি স্টোরফ্রন্ট খুলে স্ক্রিনশট — কিছু ভাঙেনি তো নিশ্চিত হওয়া।
5. CSP রিপোর্ট কনসোলে দেখা যাবে — enforced করার আগে সেই ডেটা দিয়ে ধাপ ২-এর সিদ্ধান্ত।

## টেকনিক্যাল নোট
- পরিবর্তন: শুধু `src/server.ts` (+ প্রয়োজনে ছোট helper `src/lib/security-headers.server.ts`)।
- কোনো মাইগ্রেশন, সিক্রেট, বা থার্ড-পার্টি সেটআপ লাগবে না।
