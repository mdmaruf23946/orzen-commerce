# মোবাইল Dial Pad ফিট ঠিক করা

## কী বদলাবে
- Calls & History-এর দুই অংশকে মোবাইলে স্ক্রিনের প্রস্থের মধ্যে সীমাবদ্ধ করব, যাতে পাশের Call Logs আর Dial Pad-কে ডানে ঠেলে না দেয়।
- Dial Pad-এর ভেতরের অংশকে সম্পূর্ণ responsive করব; নম্বর ইনপুট, ৩×৪ বাটন এবং action row সব একসাথে দৃশ্যমান থাকবে।
- Desktop-এর বর্তমান দুই-কলামের বিন্যাস অপরিবর্তিত থাকবে।

## যাচাই
- 405px মোবাইল স্ক্রিনে Dial Pad-এর ১–৯, *, ০, # এবং Clear/Call/Backspace সব দেখা যাচ্ছে কি না পরীক্ষা করব।
- অনুভূমিকভাবে পেজ সরে যাচ্ছে কি না এবং সর্বশেষ build সফল কি না যাচাই করব।

## Technical details
- Grid track-এ `minmax(0, 1fr)` এবং child wrappers-এ `min-w-0` ব্যবহার করে intrinsic table width-এর overflow আটকানো হবে।
- Dial Pad inner wrapper-এ `w-full max-w-xs` রাখা হবে এবং fixed-width overflow বাদ দেওয়া হবে।
