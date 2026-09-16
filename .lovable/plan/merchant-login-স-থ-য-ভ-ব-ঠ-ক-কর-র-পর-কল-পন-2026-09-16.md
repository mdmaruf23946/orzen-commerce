# Merchant login স্থায়ীভাবে ঠিক করার পরিকল্পনা

## নিশ্চিত অবস্থা

- Production login service সঠিক email/password গ্রহণ করছে; সাম্প্রতিক login request সফল হয়েছে।
- সফল login-এর পর account type যাচাই করার server call চলছে এবং error হলে login page নিজেই local session মুছে দিচ্ছে। তাই সঙ্গে সঙ্গে logout record তৈরি হচ্ছে এবং স্ক্রিনশটের লাল বার্তা দেখা যাচ্ছে।
- Browser ও server উভয়ই এখন একই production project দেখাচ্ছে; আগের development/production mismatch এই ঘটনার বর্তমান কারণ নয়।
- বর্তমান server verification JWT claims স্থানীয়ভাবে যাচাই করছে; ব্যর্থতার বিস্তারিত ব্যবহারকারীর সামনে না দেখিয়ে বিস্তৃত “connection could not be verified” বার্তা দেখায়।

## বাস্তবায়ন

1. **Session যাচাই নির্ভরযোগ্য করা**
   - Server middleware-এ token-এর issuer/project guard বজায় রাখব।
   - স্থানীয় `getClaims` যাচাইয়ের বদলে production auth service-এর authoritative `getUser(token)` verification ব্যবহার করব, যাতে বৈধ সদ্য-issued token ভুলভাবে rejected না হয়।
   - যাচাইকৃত user ID-ই পরবর্তী merchant/employee access check-এ ব্যবহার হবে।

2. **সফল login আর অযথা মুছবে না**
   - Merchant ও employee login—দুই path-এ শুধু সত্যিকারের invalid/mismatched session হলে local session clear হবে।
   - account-type lookup-এর আলাদা service/database error হলে session ধ্বংস না করে retry-friendly নির্দিষ্ট বার্তা দেখাবে।
   - merchant account ভুল করে employee হিসেবে এবং employee ভুল করে merchant হিসেবে ঢুকতে পারবে না—বর্তমান separation অক্ষুণ্ণ থাকবে।

3. **কারণ শনাক্তযোগ্য রাখা**
   - কোনো token বা ব্যক্তিগত তথ্য log না করে server-side failure category রাখব: missing token, wrong deployment, auth rejection, অথবা account lookup failure।
   - Winner Admin Deployment Health-এর browser/server production-match check অক্ষুণ্ণ থাকবে।

4. **Production যাচাই ও নিরাপদ প্রকাশ**
   - typecheck এবং isolated auth middleware পরীক্ষা করব।
   - পুরোনো/অন্য deployment-এর session reject ও clean recovery পরীক্ষা করব।
   - guarded Cloudflare procedure দিয়েই candidate যাচাই করে live করব; Lovable Publish ব্যবহার করব না।
   - live mobile login-এ merchant account panel-এ পৌঁছায়, সঙ্গে সঙ্গে logout হয় না, এবং লাল connection error আর আসে না—এগুলো যাচাই করব।

## অপরিবর্তিত থাকবে

- Password, merchant/customer/order/payment data পরিবর্তন হবে না।
- Lovable Cloud শুধু development/backup থাকবে এবং তার data স্পর্শ করা হবে না।
- Messenger/Facebook, storefront customer login এবং commerce logic পরিবর্তন হবে না।
