# Storefront Chat Launcher আপডেট

## লক্ষ্য
প্রতিটি দোকানের ভাসমান চ্যাট বাটনে ক্লিক করলে উপরে সর্বোচ্চ তিনটি **শুধু আইকন** দেখাবে: AI, Messenger এবং WhatsApp। কোনো আইকনের পাশে লেখা থাকবে না।

## বর্তমান অবস্থায় নিশ্চিত সমস্যা
- বর্তমান বাটনটি শুধু AI সুবিধা থাকলেই দেখা যায়; ফলে AI ছাড়া Messenger/WhatsApp চালু থাকলেও চ্যাট বাটন দেখা যায় না।
- Messenger বর্তমানে আসল Messenger সংযোগের অবস্থা না দেখে দোকানের সাধারণ Facebook লিংক থেকে তৈরি হয়।
- WhatsApp এই ভাসমান মেনুতে নেই।
- AI ও Messenger অপশনে লেখা দেখা যায় এবং Facebook আইকন ব্যবহৃত হচ্ছে।

## পরিবর্তন
1. **একটি নিরাপদ পাবলিক চ্যাট-অপশন যাচাই**
   - দোকান অনুযায়ী AI, Messenger ও WhatsApp-এর availability এক জায়গায় নির্ধারণ করা হবে।
   - AI দেখাবে শুধু বর্তমান প্ল্যানে `AI Sales Agent` সুবিধা থাকলে এবং merchant AI agent বন্ধ না করলে।
   - Messenger দেখাবে শুধু ওই দোকানের Messenger integration সত্যিই connected/active থাকলে।
   - WhatsApp দেখাবে শুধু ওই দোকানের WhatsApp integration সত্যিই connected/active থাকলে।
   - অন্য দোকানের সংযোগ বা গোপন token/credential কোনোভাবেই প্রকাশ হবে না; শুধু প্রয়োজনীয় public destination ফেরত যাবে।

2. **Launcher-এর আচরণ**
   - তিনটির মধ্যে অন্তত একটি চালু থাকলে মূল গোল chat button দেখা যাবে—Free বা Paid plan হওয়া এতে বাধা হবে না।
   - মূল button চাপলে শুধু available আইকনগুলো vertically উপরে উঠবে।
   - একটিই available হলে একটিই দেখাবে; দুটো হলে দুটো; তিনটি হলে তিনটি।
   - AI আইকনে চাপলে বর্তমান AI chat panel খুলবে।
   - Messenger আইকনে চাপলে সংশ্লিষ্ট Messenger conversation খুলবে।
   - WhatsApp আইকনে চাপলে সংশ্লিষ্ট WhatsApp conversation খুলবে।
   - কোনো option available না থাকলে launcher-টি দেখাবে না।

3. **আইকন ও মোবাইল লেআউট**
   - AI-এর জন্য পরিষ্কার bot/AI icon, Messenger-এর official Messenger glyph এবং WhatsApp-এর official WhatsApp glyph ব্যবহার হবে।
   - visible label থাকবে না; accessibility-এর জন্য অদৃশ্য নাম/tooltip থাকবে।
   - screenshot-এর মতো mobile bottom navigation-এর ওপর যথেষ্ট ফাঁকা রেখে menu খুলবে; product/content বা অন্য fixed button-এর সঙ্গে overlap হবে না।
   - menu বন্ধ করলে মূল chat icon ফিরে আসবে এবং AI panel খোলা থাকলে close icon সঠিকভাবে কাজ করবে।

4. **যাচাই**
   - ৮টি combination পরীক্ষা: কোনো channel নেই; শুধু AI; শুধু Messenger; শুধু WhatsApp; AI+Messenger; AI+WhatsApp; Messenger+WhatsApp; সব তিনটি।
   - AI-সহ ও AI-বিহীন Free/Paid plan পরীক্ষা করে নিশ্চিত করা হবে যে শুধু AI-তেই plan rule প্রযোজ্য।
   - disconnected/disabled integration যেন না দেখায় এবং এক দোকানের channel অন্য দোকানে না আসে তা যাচাই করা হবে।
   - mobile ও desktop-এ icon-only layout, click destination, close/open state এবং overlap পরীক্ষা করা হবে।

## কারিগরি নোট
- বর্তমান storefront route-এর `agent && <AIChatLauncher>` শর্ত বদলে channel availability-ভিত্তিক rendering হবে।
- সাধারণ `store.facebook`/`store.whatsapp` field-কে connected integration-এর প্রমাণ হিসেবে ব্যবহার করা হবে না।
- Messenger/WhatsApp credential browser-এ পাঠানো হবে না; শুধু safe chat URL/number যাবে।
