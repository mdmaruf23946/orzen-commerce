# Merchant Auto Connect সাময়িকভাবে লুকানো

## কী পরিবর্তন হবে
- Merchant Panel-এর Messenger Integration পেজ থেকে পুরো **Auto Connect (recommended)** অংশ সরিয়ে রাখা হবে।
- Merchant Panel-এর WhatsApp Integration পেজ থেকেও একই অংশ সরিয়ে রাখা হবে।
- দুই পেজের **Manual Connect** এবং বর্তমান connected status/পরিসংখ্যান আগের মতোই থাকবে।
- Auto Connect-এর ভেতরের ব্যবস্থা বা সংরক্ষিত তথ্য মুছব না, যাতে পরে সহজে আবার চালু করা যায়।

## যাচাই
- Messenger ও WhatsApp—দুই পেজে Auto Connect button/section নেই তা দেখা হবে।
- Manual Connect দেখা যায় এবং app ঠিকভাবে তৈরি হয় তা পরীক্ষা করা হবে।

## Technical notes
- দুই integration page থেকে `MetaAutoConnect` render এবং unused import সরানো হবে।
- Server-side OAuth/connection code, Winner Admin settings এবং existing merchant connections অপরিবর্তিত থাকবে।
