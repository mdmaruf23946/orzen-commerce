# মার্চেন্ট লগইন ও প্যানেল স্থায়ীভাবে ঠিক করা

## নিশ্চিতভাবে যা পাওয়া গেছে

- `https://orzen.top/auth` স্বাভাবিকভাবে খুলছে, কিন্তু লাইভ সাইটের বর্তমান browser code পুরনো development/backup database-টির ঠিকানা ব্যবহার করছে; production database-এর ঠিকানা সেখানে নেই।
- স্ক্রিনশটের **“Unauthorized: Invalid token”** এই অবস্থার সঙ্গে মিলে যায়: login থেকে পাওয়া token এবং server যে database দিয়ে token যাচাই করছে, তারা এক জায়গার নয়।
- বর্তমান repository-তে production deploy-এর জন্য কোনো fail-safe script নেই; deployment হাতে করা হয়। ফলে development values দিয়ে build হওয়া version আবার live হয়ে যেতে পারে। পুরনো Cloudflare নির্দেশনাতেও development database-এর মান রয়ে গেছে—এটি ভবিষ্যৎ ভুলের ঝুঁকি বাড়ায়।
- Database data পরিবর্তন বা Lovable Cloud data মুছে ফেলার প্রয়োজন নেই।

## সমাধান

### 1. লাইভ সাইট এখনই পুনরুদ্ধার

- production database-এর browser এবং server values একই source থেকে নিয়ে নতুন Cloudflare version তৈরি করব।
- upload-এর আগে built files পরীক্ষা করব: production database reference অবশ্যই থাকবে এবং development/backup reference একটিও থাকতে পারবে না। ভুল থাকলে deployment নিজে থেকে বন্ধ হবে।
- version প্রথমে private preview address-এ পরীক্ষা করব; সফল হলে তবেই `orzen.top`-এ 100% traffic দেব। Lovable-এর Publish ব্যবহার হবে না।

### 2. একই সমস্যা আবার হওয়া বন্ধ করা

- একটি নির্দিষ্ট production deployment command তৈরি করব, যা:
  1. project secrets থেকে production settings নেবে—কোনো key code-এ রাখবে না;
  2. expected production project identity যাচাই করবে;
  3. development reference পাওয়া গেলে build/deploy বাতিল করবে;
  4. Cloudflare upload-এর পরে live করার আগে preview smoke test চালাবে;
  5. live করার পরে আবার `/auth`, browser bundle এবং protected server response পরীক্ষা করবে।
- production target-এর non-secret identity এক জায়গায় pin করা থাকবে, যাতে ভুল workspace environment বা Lovable defaults নীরবে live হতে না পারে।
- পুরনো Cloudflare setup guide-এ থাকা development values সরিয়ে বর্তমান Worker-based production পদ্ধতি ও সতর্কতা লিখব।

### 3. লগইন ব্যর্থ হলে পরিষ্কার recovery

- server token যাচাইয়ের সময় token কোন database project থেকে এসেছে তা বর্তমান server project-এর সঙ্গে মিলাব; অমিল হলে server log-এ নির্দিষ্ট কারণ থাকবে, কিন্তু কোনো গোপন তথ্য প্রকাশ হবে না।
- সঠিক email/password login-এর পর account type check ব্যর্থ হলে invalid session পরিষ্কার করব, যাতে stale token ধরে রেখে বারবার একই error না আসে।
- ব্যবহারকারীকে raw “Unauthorized: Invalid token” না দেখিয়ে পরিষ্কার বার্তা ও আবার sign-in করার সুযোগ দেব। ভুল password বা inactive account-এর বর্তমান আচরণ অপরিবর্তিত থাকবে।
- Winner Admin-এর Deployment Health-এ browser/server database মিলের আলাদা সবুজ/লাল check যোগ করব, যাতে ভবিষ্যৎ configuration drift সঙ্গে সঙ্গে ধরা যায়।

## যাচাই

- live HTML ও সব relevant JavaScript asset-এ production reference থাকবে; development reference থাকবে না।
- browser-side login এবং server-side account check একই production backend ব্যবহার করছে—network response দিয়ে যাচাই করব।
- desktop ও mobile-এ `/auth` → sign-in → `/admin` flow পরীক্ষা করব; available authenticated production session না থাকলে account-specific sign-in অংশটি **UNVERIFIED** বলে স্পষ্ট জানাব এবং আপনাকে একবার login করে নিশ্চিত করতে বলব।
- sign-out → sign-in, hard refresh, protected page reload এবং expired/stale session—সব পথ পরীক্ষা করব।
- Messenger/webhook, production database এবং Lovable Cloud backup data-তে কোনো পরিবর্তন করব না।

## ফলাফল

লাইভ সাইট production database-এর সঙ্গে আবার একভাবে চলবে, মার্চেন্ট লগইন ও প্যানেল লোড হবে, এবং ভবিষ্যতে development configuration দিয়ে ভুল deployment live হওয়ার আগেই স্বয়ংক্রিয়ভাবে আটকে যাবে।
