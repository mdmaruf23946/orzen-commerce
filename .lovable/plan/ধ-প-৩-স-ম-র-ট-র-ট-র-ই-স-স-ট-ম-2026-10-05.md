# ধাপ ৩: স্মার্ট রিট্রাই সিস্টেম

## এখন যা আছে
- আবার কল করার সংখ্যা (০–৩) আর কত মিনিট পর পর — Settings-এ আছে, কিন্তু সাধারণ নম্বর ঘর।
- "Call only during business hours" (From/To সময়, বাংলাদেশ সময়) আছে, তবে ডিফল্ট বন্ধ, আর সময় শেষ ৯টা (২১:০০)।
- কল দেওয়ার মুহূর্তে অর্ডার আর pending না থাকলে কল যায় না — কিন্তু কিউতে কলটা "Scheduled" হিসেবে ঝুলে থাকে, কেন বাতিল হলো লেখা থাকে না।

## যা বানানো হবে

**১. রিট্রাই সেটিংস (সহজ বাছাই)**
- "কত পর পর": ১০ মিনিট / ৩০ মিনিট / ১ ঘণ্টা / ২ ঘণ্টা / নিজে লিখুন।
- "সর্বোচ্চ কতবার আবার কল": ১ / ২ / ৩ বার।
- নিচে ছোট সারাংশ: "প্রথম কল + সর্বোচ্চ ২ বার আবার, প্রতি ৩০ মিনিট পর"।

**২. অফিস সময় গার্ড**
- নতুন স্টোরের ডিফল্ট: চালু, সকাল ৯টা – রাত ১০টা (বাংলাদেশ সময়)।
- রাত ১০টার পর অর্ডার এলে কল কিউতে "সকাল ৯টায় কল যাবে" লেখা থাকবে।
- রিট্রাইয়ের সময় অফিস সময়ের বাইরে পড়লে সেটাও পরের দিন সকাল ৯টায় সরবে (চেষ্টার সংখ্যা নষ্ট হবে না)।

**৩. ক্যানসেল গার্ড (তাৎক্ষণিক)**
- অর্ডার pending থেকে অন্য কিছুতে গেলেই (মেসেঞ্জার/হোয়াটসঅ্যাপে কাস্টমার কনফার্ম, মার্চেন্ট হাতে বদলানো, বাতিল, ডিলিট) — সেই অর্ডারের সব শিডিউল কল সঙ্গে সঙ্গে "Cancelled" হবে, কারণসহ ("Order confirmed", "Status changed manually")।
- কল দেওয়ার ঠিক আগেও আরেকবার যাচাই থাকবে (দ্বিগুণ নিরাপত্তা)।

**৪. Automated Order Calls-এ দেখা**
- প্রতিটা অর্ডারে: কততম চেষ্টা / সর্বোচ্চ, পরের কল কখন, বা কেন বাতিল।
- "Cancel" বাটন — মার্চেন্ট নিজে কোনো শিডিউল কল বন্ধ করতে পারবেন।

## যাচাই
- টেস্ট সিস্টেমে: রাত ১০টার পরের অর্ডার → সকাল ৯টায় সরে যায়; না ধরলে ঠিক সময় পর রিট্রাই, সীমা পেরোলে থামে; কল যাওয়ার আগে অর্ডার কনফার্ম করলে কিউ বাতিল। টেস্ট ডেটা পরে মুছে দেওয়া।
- টাইপচেক, প্রডাকশনে ডিপ্লয়, লাইভ পেজ খোলা চেক।
- আসল কল পরীক্ষা ব্যালেন্স রিচার্জ ও লাইন চালুর পরে।

## Technical details
- Migration (Cloud + prod `rljisleyqluoexmtncos`): `voice_call_queue.cancel_reason text`; AFTER UPDATE OF status / AFTER DELETE trigger on `orders` → `UPDATE voice_call_queue SET status='cancelled', cancel_reason=... WHERE order_id=... AND status='queued'`. Defaults for `voice_automation_settings`: `business_hours_only=true`, `hours_to='22:00'` (new rows only; existing rows untouched).
- `queue.server.ts`: `scheduleRetryOrFail` pushes `run_at` into business hours via `minutesUntilOpen` at the computed time (not now); drain skip writes `cancelled` + reason instead of `skipped` when order is no longer pending.
- `VoicePanels.tsx`: preset select for `retry_delay_minutes`, 1–3 select for `retry_count`, summary line; zod schema unchanged (1–1440, 0–3).
- `EpbxPanels.tsx` automated list: show attempt/max, next run, cancel_reason; new `cancelQueuedCall` server fn (store-scoped via `has_store_access`).
