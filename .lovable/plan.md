# Profile page: নিজের ছবি, তৈরি avatar, cover photo আর cover template

## যা দেখবেন
- **Profile ছবি:** আগের চেয়ে বড়, কোণে ছোট ক্যামেরা আইকন। ছবিতে চাপলে একটা ছোট মেনু খুলবে: "Upload photo" অথবা "Choose avatar"।
  - Upload: gallery খুলবে, ছবি বাছলে crop করার জানালা আসবে, Apply চাপলে নিজে থেকেই save হবে।
  - Choose avatar: 24টা একই ধাঁচের আধুনিক avatar-এর grid থেকে একটায় চাপলেই সাথে সাথে save।
- **Cover photo:** উপরের রঙিন ব্যানারটা হবে বড় cover এলাকা, কোণে ক্যামেরা আইকন। চাপলে "Upload cover" অথবা "Choose template"।
  - Upload: ছবি বাছা, চওড়া crop, Apply, নিজে থেকেই save।
  - Template: Professional, Business, Technology, Creative, E-commerce, ORZEN — এই ছয়টা ভাগে মোট 18টা template (প্রতি ভাগে 3টা), পরে আরও যোগ করা যাবে। একটায় চাপলেই save।
- নাম, ইমেইল, Account information, Save profile, Sign out — আগের মতোই থাকবে। ছবি/cover-এর জন্য Save profile চাপতে হবে না।
- মোবাইল আর ডেস্কটপ দুই জায়গাতেই ঠিকভাবে কাজ করবে।

## Technical details
- avatar ও cover-এর জন্য auth user metadata-তে `avatar_url` (আগে থেকে আছে) এবং নতুন `cover_url`; নতুন protected server functions `updateAccountAvatar` / `updateAccountCover` (শুধু নিজের metadata, admin API দিয়ে — Save fix-এর মতোই)। `getAccountProfile` থেকে `coverUrl` ফেরত দেবে। নাম save আগের মতো, কিন্তু সেটা যেন avatar/cover মুছে না দেয়।
- Uploaded ছবি আগের policy-ঢাকা `profiles/...` folder-এই যাবে (store-assets bucket), তাই নতুন storage policy লাগবে না।
- Crop: existing `react-easy-crop` দিয়ে নতুন shared `ImageCropDialog` (local file থেকে, aspect 1:1 avatar, ~3:1 cover), webp-এ compress করে upload।
- Avatar ও cover template: imagegen দিয়ে তৈরি করে Lovable Assets-এ রাখা হবে (CDN URL), registry ফাইল `src/lib/profile-media-templates.ts`-এ category সহ — নতুন template এখানে যোগ করলেই চলবে। Template বাছলে তার URL সরাসরি metadata-তে save।
- `AccountAvatar` সব জায়গায় (sidebar সহ) নতুন avatar দেখাবে।
- Typecheck, Preview-এ যাচাই; orzen.top-এ live শুধু আপনি বললে।
