# মার্চেন্ট লগইন পুনরুদ্ধার ও স্থায়ী production সুরক্ষা

## নিশ্চিতভাবে যা পাওয়া গেছে

- নতুন স্ক্রিনশটে `/auth`-এ **“Your sign-in session could not be verified”** এখনো দেখা যাচ্ছে।
- `orzen.top/auth` বর্তমানে যে browser files দিচ্ছে, সেখানে **development/backup backend ID** আছে এবং production backend ID নেই। অর্থাৎ আগের ভুল version আবার live হয়েছে বা সঠিক version live-এ স্থায়ী হয়নি।
- repository-তে production-only guarded deployment script আছে, কিন্তু live version প্রমাণ করছে অন্য কোনো publish/deploy পথ এখনো সেই guard এড়িয়ে যেতে পারে।
- Lovable Cloud-এর data পরিবর্তন বা মুছে ফেলার প্রয়োজন নেই।

## কাজের পরিকল্পনা

### 1. Live login এখনই পুনরুদ্ধার

- Cloudflare Worker-এর server-side backend identity নিরাপদভাবে যাচাই করব; কোনো secret প্রকাশ করা হবে না।
- production backend values দিয়ে fresh version তৈরি করব এবং browser files-এ production ID আছে ও development ID নেই—দুটিই পরীক্ষা করব।
- candidate version-এ `/auth`, session তৈরি এবং protected account check যাচাই করার পরেই `orzen.top`-এ 100% traffic দেব।
- Lovable Publish ব্যবহার হবে না; Lovable Cloud development/backup হিসেবেই অক্ষত থাকবে।

### 2. আসল login flow সম্পূর্ণ যাচাই

- production user দিয়ে sign-in-এর পর token একই production backend থেকে এসেছে কিনা এবং server সেটিই যাচাই করছে কিনা পরীক্ষা করব।
- `signInWithPassword` সফল হলেও account check কোথায় ব্যর্থ হচ্ছে তা server logs ও request response দিয়ে আলাদা করব।
- stale development session থাকলে সেটি localভাবে পরিষ্কার করে একবার clean sign-in করাব; ভুল password, employee account এবং inactive account-এর বর্তমান আলাদা আচরণ অপরিবর্তিত থাকবে।
- mobile ও desktop-এ sign-in, refresh, sign-out → sign-in, এবং Merchant Panel reload পরীক্ষা করব।

### 3. ভুল version আবার live হওয়া বন্ধ করা

- একমাত্র production deployment command-কে বাধ্যতামূলক করব: build, candidate upload, candidate browser test, production-ID scan এবং live post-check—কোনো ধাপ বাদ গেলে deployment বন্ধ হবে।
- candidate URL bot/403 দিলে যাচাই বাদ যাবে না; Cloudflare-compatible browser smoke test ব্যবহার হবে এবং test অসম্পূর্ণ হলে live promotion হবে না।
- live করার পর `/auth`-এর সব relevant JavaScript file আবার scan হবে; development ID পাওয়া গেলে deployment failure হিসেবে চিহ্নিত হবে এবং last verified version পুনরুদ্ধারের পথ থাকবে।
- manual/Lovable publish যেন production Worker-কে ভুলভাবে replace করতে না পারে, deployment documentation ও command safeguards এক জায়গায় স্থায়ী করব।
- Winner Admin-এর Deployment Health-এ browser/server backend match স্পষ্ট সবুজ/লাল থাকবে এবং mismatch হলে login-এর আগেই ধরা পড়বে।

## যাচাইয়ের ফলাফল

কাজ সম্পন্ন বলব শুধু তখনই যখন:

1. live browser files-এ production backend ID আছে এবং development ID নেই;
2. production login token server account check-এ accepted;
3. `/admin` mobile ও desktop-এ load ও refresh হয়;
4. stale session clean recovery কাজ করে;
5. guarded deployment ভুল backend দিয়ে test করলে নিজে থেকে বন্ধ হয়।

## অপরিবর্তিত থাকবে

- Lovable Cloud backend/data
- production merchant/customer/order/payment data
- Messenger/Facebook integration
- storefront customer login system
