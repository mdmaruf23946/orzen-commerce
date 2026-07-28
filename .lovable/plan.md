## Goal

আজকের ফর্মে ১০টি সেকশন (Basic, Auth, Endpoints, Request mapping, Response mapping, Webhook, Verification, Refunds, Methods, Review) — বেশিরভাগই সাধারণ ব্যবহারকারীর দরকার নেই। এটাকে ছোট, সহজ ৩-ধাপের ফর্মে নামিয়ে আনব, বাকি সব অটো-ডিফল্ট বা "Advanced" এর ভিতরে লুকানো থাকবে। ব্যাকএন্ড/এনক্রিপশন/ওয়েবহুক ইঞ্জিন অপরিবর্তিত থাকবে — শুধু UI ও ডিফল্ট মান বদলাবে, তাই পুরনো gateway গুলো ভাঙবে না।

## নতুন ফর্মের কাঠামো (৩ ধাপ)

```text
Step 1 — Provider          Step 2 — Connection        Step 3 — Test & finish
─────────────────          ───────────────────        ──────────────────────
Gateway name *             Auth type (select)         Webhook URL (copy)
Currency (BDT)             Credential field(s)        [ Test connection ]
Sandbox / Live toggle      Base URL *                 Result: success/fail
Logo URL (optional)        Checkout endpoint *        [ Save & activate ]
                           Success URL path *
```

মোট আবশ্যিক ফিল্ড: name, base URL, checkout endpoint, credential, response pay-url path — এই ৫টিই। বাকি সব ঐচ্ছিক।

### যা সরানো হবে (স্মার্ট ডিফল্টে চলে যাবে)
- Slug — নাম থেকে অটো-জেনারেট (edit শুধু Advanced-এ)
- Website URL, Docs URL, Support email, Description — Advanced-এ
- Checkout type, Content type, HTTP method — ডিফল্ট hosted / json / POST, Advanced-এ পরিবর্তনযোগ্য
- Custom headers, Field mapping, Body template — Advanced-এ (ডিফল্ট বডি অটো তৈরি হয় mapping ছাড়াই)
- Reference path, Message path, Event ID/type path, Provider ref path — Advanced-এ, ডিফল্ট মান দেওয়া
- Verification section — ডিফল্ট `webhook_only`; api verify চাইলে Advanced-এ
- Refunds section — সম্পূর্ণভাবে Advanced-এ (ডিফল্ট off)
- Displayed payment methods — Advanced-এ (খালি থাকলে gateway নামই দেখাবে)
- Review section — আলাদা সেকশন হিসেবে বাদ; Step 3-এ ছোট summary + Test বোতাম

### যা Step-এ থাকবে
- Signature: ডিফল্ট `none`; একটি চেকবক্স "Provider signs webhooks (HMAC)" — টিক দিলে শুধু header + secret ফিল্ড দেখাবে (algorithm sha256 / hex ডিফল্ট)
- Status mapping: ডিফল্টে সাধারণ মানগুলো প্রি-ফিল (SUCCESS/PAID/COMPLETED→paid, FAILED→failed, CANCELLED→cancelled, PENDING→pending), Advanced-এ এডিটযোগ্য

## Test & Connect ফ্লো ঠিক করা

বর্তমানে Test চালাতে হলে আগে Save করতে হয় ("Save the gateway before running a live test") — এটা বিভ্রান্তিকর। নতুন আচরণ:
1. Step 3-এ "Test connection" চাপলে আগে নিঃশব্দে draft হিসেবে save হবে, তারপর টেস্ট চলবে।
2. টেস্ট সফল হলে সবুজ ব্যানার + checkout URL লিংক, এবং "Save & activate" বোতাম gateway-কে `connected` + enabled করে দেবে।
3. টেস্ট ব্যর্থ হলে HTTP status ও provider মেসেজ পরিষ্কারভাবে দেখাবে, তবু Save করা যাবে (draft থাকবে)।

## Technical details

- `src/components/admin/payments/CustomGatewaySection.tsx` — Accordion (১০ item) সরিয়ে ৩-ধাপের wizard; Advanced অংশ একটি collapsible-এ; `KeyValueEditor` / `MappingEditor` / `StatusMapEditor` / `MethodEditor` কম্পোনেন্টগুলো রেখেই Advanced-এ ব্যবহার হবে। ফাইল ~১২৫০ → ~৭৫০ লাইনে নামবে।
- ডিফল্ট config seed: `request.method=POST`, `contentType=json`, `checkout.type=hosted`, `verification.method=webhook_only`, `statusMap` প্রি-ফিল, `refund.enabled=false`।
- `CustomGatewayConfigSchema` (`src/lib/custom-gateway/types.ts`) অপরিবর্তিত — সব ফিল্ডের ডিফল্ট আছে, তাই লুকানো ফিল্ডগুলো valid থাকবে।
- `saveCustomGateway` / `testCustomGateway` (`gateways.functions.ts`) অপরিবর্তিত; শুধু UI test-এর আগে auto-save কল করবে এবং returned id দিয়ে test চালাবে।
- `engine.server.ts` ও webhook route-এ কোনো পরিবর্তন নেই।
- Verify: টাইপচেক + preview-এ মোবাইল (৪০৪px) ভিউতে ফর্ম খুলে ৩ ধাপ ও Test ফ্লো স্ক্রিনশট দিয়ে যাচাই।
