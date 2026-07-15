## কাস্টম Supabase-এ মাইগ্রেশন প্ল্যান

আপনি Lovable Cloud-এর ম্যানেজড ব্যাকএন্ড থেকে নিজের Supabase প্রজেক্টে (`vnvxidisirbsxpmmlclh`) সুইচ করতে চান। এটা করার আগে কিছু গুরুত্বপূর্ণ বিষয় জেনে নিন।

---

### ⚠️ গুরুত্বপূর্ণ সীমাবদ্ধতা

1. **Lovable Cloud ডিসকানেক্ট করা যায় না** — একবার প্রজেক্টে Lovable Cloud এনাবল হলে সেটা এই প্রজেক্ট থেকে সরানো যায় না। আপনার কোড শুধু `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` এনভায়রনমেন্ট ভেরিয়েবল পড়ে, তাই আমরা কোডকে নতুন Supabase-এ পয়েন্ট করাতে পারি, কিন্তু পুরনো Cloud ইনস্ট্যান্স "ডিসকানেক্টেড" অবস্থায় রয়ে যাবে।

2. **Service Role Key প্রয়োজন** — আপনি শুধু Anon key দিয়েছেন। কিন্তু কোডে অনেক জায়গায় `SUPABASE_SERVICE_ROLE_KEY` ব্যবহার হয় (edge functions, admin operations, `client.server.ts`, `api/img`, webhook handlers, storage uploads ইত্যাদি)। এটা ছাড়া অ্যাপের প্রায় অর্ধেক কাজ করবে না।

3. **অটো-জেনারেটেড ফাইল** — `.env`, `src/integrations/supabase/client.ts`, `types.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `client.server.ts`, এবং `supabase/config.toml` সব Lovable-ম্যানেজড। এগুলো ম্যানুয়ালি এডিট করলে পরের বিল্ডে ওভাররাইট হতে পারে।

---

### মাইগ্রেশনে কী কী দরকার

**A. ডেটাবেস স্কিমা ট্রান্সফার (৪২টি টেবিল + ফাংশন + RLS + ট্রিগার):**
- বর্তমান Cloud DB থেকে full schema dump (tables, enums, functions, triggers, policies, grants, storage buckets)
- সেই SQL আপনার নতুন Supabase-এ (`vnvxidisirbsxpmmlclh`) SQL Editor-এ চালানো
- এটা **আপনাকে ম্যানুয়ালি করতে হবে** — Lovable-এর কাছে আপনার কাস্টম Supabase-এ migration চালানোর টুল নেই

**B. ডেটা ট্রান্সফার (যদি বর্তমান ডেটা রাখতে চান):**
- Cloud → Advanced settings → Export data দিয়ে CSV এক্সপোর্ট করে নতুন প্রজেক্টে ইম্পোর্ট করা লাগবে

**C. Storage bucket (`store-assets`) রি-ক্রিয়েট এবং ফাইলগুলো নতুন প্রজেক্টে কপি করা।**

**D. Auth সেটিংস কনফিগার** — নতুন Supabase-এ Google OAuth, email templates, redirect URLs নিজে সেট করতে হবে।

**E. Secrets** — `LOVABLE_API_KEY`, ও অন্য যেকোনো integration key নতুন প্রজেক্টে যোগ করা।

**F. কোড পরিবর্তন:**
- `.env` আপডেট: নতুন URL/Anon key + Service Role key
- `supabase/config.toml` → `project_id = "vnvxidisirbsxpmmlclh"`
- সব `createServerFn` handler-এ Service Role key কাজ করছে কিনা যাচাই

---

### সিদ্ধান্তের প্রয়োজন

এগোনোর আগে দয়া করে নিশ্চিত করুন:

1. **আপনার Service Role Key দিন** (Supabase Dashboard → Project Settings → API → `service_role` secret)। এটা ছাড়া মাইগ্রেশন সম্পূর্ণ হবে না।

2. **বর্তমান ডেটা কি নতুন প্রজেক্টে দরকার?** (স্টোর, প্রোডাক্ট, অর্ডার, ইউজার) নাকি খালি স্কিমা দিয়েই শুরু?

3. **কেন সুইচ করছেন?** যদি কারণ হয় — ডেটাবেস অ্যাক্সেস, বেশি কন্ট্রোল, বা প্রাইসিং — তাহলে আমাকে জানান, বিকল্প থাকতে পারে (যেমন Lovable Cloud-এই কাস্টম কনফিগ)। Cloud ছেড়ে গেলে Lovable-এর ম্যানেজড টুলগুলো (auto types, migrations, secrets UI) আর ওয়ার্ক করবে না।

উত্তর পেলে আমি ধাপে ধাপে schema dump, code rewire, এবং verification-এর বিস্তারিত প্ল্যান তৈরি করব।
