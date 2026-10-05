# ধাপ ১: ePBX Connection & Account Hub

## লক্ষ্য
ব্যালেন্স, লাইন (SIP Trunk/Caller ID) আর এক্সটেনশন দেখতে মার্চেন্টকে আর ePBX ওয়েবসাইটে যেতে হবে না — সব AI Call Center-এর ভেতরেই থাকবে।

## যা তৈরি হবে
1. **Account Hub কার্ড (Overview ট্যাবের একদম উপরে)**
   - বড় করে লাইভ ওয়ালেট ব্যালেন্স (যেমন ৳ ৫০.০০), "শেষ আপডেট: ২ মিনিট আগে", আর একটা "Refresh" বোতাম।
   - পেজ খুললে সাথে সাথে চেক হবে, তারপর পেজ খোলা থাকা অবস্থায় প্রতি ৫ মিনিটে নিজে থেকে চেক হবে।
2. **Low Balance Alert**
   - ব্যালেন্স ৳১০-এর নিচে নামলে AI Call Center-এর সব ট্যাবের উপরে লাল সতর্কবার্তা: "Low Balance Alert — ব্যালেন্স কম, কল যাবে না। ePBX-এ রিচার্জ করুন।"
   - ব্যালেন্স ৳০ হলে Dial Pad-এর Call বোতামের পাশেও একই সতর্কবার্তা, যাতে কল চাপার আগেই বোঝা যায়।
3. **SIP Trunk ও Caller ID স্ট্যাটাস**
   - ePBX থেকে পাওয়া অনুমোদিত কলার আইডি (যেমন 09639444171) Provider ট্যাবের "Default Caller ID" ড্রপডাউনে থাকবে — হাতে যে কোনো নম্বর লেখা যাবে না।
   - লাইন চালু থাকলে সবুজ ব্যাজ "Active", না থাকলে ধূসর/লাল "No active SIP trunk" — সাথে সংক্ষিপ্ত করণীয়।
4. **Agent Extensions তালিকা**
   - কনফিগার করা এক্সটেনশন (101, 102 …) তালিকা আকারে দেখাবে, কোনটা ডিফল্ট সেটা চিহ্নিত।
   - ePBX এক্সটেনশন তালিকা দেয় না, তাই মার্চেন্ট নিজে এক্সটেনশন যোগ/মুছতে পারবেন (নম্বর + ঐচ্ছিক নাম), আর একটা ডিফল্ট বেছে দিতে পারবেন। Dial Pad এই তালিকা থেকেই এক্সটেনশন নেবে।
   - "অনলাইন/অফলাইন" অবস্থা ePBX দেয় না — সেখানে লেখা থাকবে "Not available through the current ePBX API access." (নকল তথ্য দেখানো হবে না)।

## সীমাবদ্ধতা (স্পষ্টভাবে)
- ব্যালেন্স কেবল পেজ খোলা থাকলে ৫ মিনিট পরপর আপডেট হবে; পেজ বন্ধ থাকলে ব্যাকগ্রাউন্ডে চেক হবে না (ধাপ ৪-এ ইমেইল/নোটিফিকেশন অ্যালার্ট যোগ করা যাবে)।
- ePBX একটাই ট্রাঙ্ক নম্বর জানায়; একাধিক কলার আইডি থাকলে ePBX যা দেয় সেটুকুই দেখাবে।
- আপনার বর্তমান অ্যাকাউন্টে ব্যালেন্স ৳০ ও ট্রাঙ্ক নেই — তাই চালুর পর লাল সতর্কবার্তা ও "No active SIP trunk" দেখাবে, এটা স্বাভাবিক।

## টেকনিক্যাল বিবরণ
- `voice.functions.ts`: একটি `getEpbxAccountHub` server function (requireSupabaseAuth, store-scoped) — `/balance/global` + `/balance/ip` একসাথে, ফল `{balance, currency, trunk_number, trunk_active, caller_ids[], extensions[], default_extension, checked_at, low_balance}`; `last_synced_at` ও শেষ ব্যালেন্স `voice_provider_connections`-এ সংরক্ষণ। টোকেন কখনো ব্রাউজারে যাবে না।
- ক্লায়েন্টে `useQuery({ refetchInterval: 300_000, refetchOnWindowFocus: true })`; একই queryKey সব ট্যাব/ব্যানার শেয়ার করবে।
- Low-balance threshold কনস্ট্যান্ট (১০), অ্যাডাপ্টার `capabilities` অনুযায়ী "Not available" লেখা।
- এক্সটেনশন: `voice_provider_connections.settings` JSON-এ `extensions[]` + `default_extension` (নতুন টেবিল লাগবে না); সেভ করার সময় সংখ্যা যাচাই (২–৬ ডিজিট, সর্বোচ্চ ২০টি)।
- Caller ID সেভের সময় সার্ভার যাচাই করবে নম্বরটা ePBX-এর দেওয়া তালিকায় আছে কি না।
- যাচাই: tsgo, dev-এ Playwright দিয়ে Overview/Provider/Agents দেখা, তারপর `deploy-production.sh` ও orzen.top-এ লাইভ চেক।
