# Payment Brand Assets মোবাইল লে-আউট ঠিক করা

## কী পরিবর্তন হবে
- মোবাইলে পেজের মূল অংশ ও প্রতিটি ব্র্যান্ড কার্ড স্ক্রিনের প্রস্থের মধ্যেই রাখা হবে।
- লম্বা শিরোনাম, বর্ণনা, লোগো এবং ইনপুট যেন ডান পাশে বেরিয়ে না যায়, সেগুলো ছোট পর্দার উপযোগী করা হবে।
- উপরের Branding tabs মোবাইলে স্বাভাবিকভাবে পাশের দিকে scroll করবে, কিন্তু পুরো পেজকে চওড়া করবে না।
- Desktop ও tablet-এর বর্তমান দুই-কলামের layout অপরিবর্তিত রাখা হবে।

## যাচাই
- আসল Winner Admin session দিয়ে Payment Brand Assets পেজ mobile width-এ খুলে horizontal overflow পরীক্ষা করা হবে।
- screenshot দেখে card, logo, input এবং action buttons সম্পূর্ণ দৃশ্যমান কিনা নিশ্চিত করা হবে।
- সফল যাচাইয়ের পর production deployment ও live mobile check করা হবে।

## Technical details
- Owner content wrapper, tab strip, card grid এবং form children-এ `min-width: 0`, bounded width ও mobile spacing প্রয়োগ করা হবে।
- প্রয়োজন হলে অতি-লম্বা content-এ wrapping/truncation যোগ করা হবে, fixed-width element ছোট করা হবে।
