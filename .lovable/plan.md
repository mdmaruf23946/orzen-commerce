# Merchant-to-Merchant Delegated Access

এক মার্চেন্ট অন্য মার্চেন্ট/ইউজারকে পাসওয়ার্ড ছাড়াই নিজের স্টোরে নির্দিষ্ট অনুমতি দিতে পারবে (Meta Business-এর মতো)। বর্তমান Merchant Panel, sidebar, integration পেজ — কিছুই বদলাবে না।

## ইউজার যা পাবে

**Profile → Access & Permissions** (Profile পেজে নতুন সেকশন, ৪টা ট্যাব):
- **My Access** — যেসব স্টোরে আমার অ্যাক্সেস আছে (স্টোর নাম, রোল, স্ট্যাটাস, "Open store" বাটন)।
- **People With Access** — আমার স্টোরে যাদের অ্যাক্সেস আছে: avatar, নাম, ইমেইল, রোল ব্যাজ, অনুমতির সারাংশ, স্ট্যাটাস, Last active, Manage / Revoke।
- **Pending Invitations** — পাঠানো (Resend/Cancel) ও আমার কাছে আসা (Accept/Decline)।
- **Give Access** — ইমেইল, ঐচ্ছিক নাম, রোল (Support Manager, Manager, Marketing Manager, Developer, Viewer, Custom), অনুমতি বাছাই (No access / View / Manage), ঐচ্ছিক মেয়াদ।
- Give Access / Manage / Revoke শুধু আসল স্টোর মালিক দেখবে ও করতে পারবে।

**Invitation ইমেইল** — স্টোর নাম, কে আমন্ত্রণ দিয়েছে, রোল, অনুমতির সারাংশ, "Review Access" বাটন। লিংকে `/access/invite/<token>` পেজ — লগইন বাধ্যতামূলক, তারপর Accept / Decline। ইমেইলটা আমন্ত্রিত ইমেইলের সাথে মিলতে হবে।

**Store Switcher** — sidebar-এর উপরের স্টোর লোগো + নামে ক্লিক করলে "My Stores" তালিকা: My Store (Owner), ABC Store (Support Manager)…। শুধু নিজের ও active অ্যাক্সেসের স্টোর দেখাবে।

**অন্যের স্টোরে কাজ করার সময়** — একই প্যানেল, শুধু অনুমতি পাওয়া মেনু; উপরে স্পষ্ট ব্যানার: "আপনি ABC Store-এ কাজ করছেন · Access: Support Manager · My Store-এ ফিরুন"। নিজের স্টোরের কোনো ডেটা দেখাবে না।

**Activity Log** — বিদ্যমান Activity Log-এ নতুন ঘটনা: "Abdullah accessed ABC Store", "Access granted to x@y.com", "Access revoked…", অর্ডার/Facebook/webhook পরিবর্তন — ইউজার, স্টোর, অ্যাকশন, সময় সহ।

## যা কখনো দেওয়া যাবে না (Owner-only, সার্ভারেও বন্ধ)
মালিকের প্রোফাইল/নাম/ইমেইল, পাসওয়ার্ড, ইমেইল ভেরিফিকেশন, 2FA, Account recovery, Account deletion, Ownership transfer, Access management, অন্য কাউকে আমন্ত্রণ — delegated ইউজার এগুলো কখনো পাবে না; delegation chain সম্ভব নয়। Billing ঐচ্ছিক অনুমতি হিসেবে দেওয়া যাবে কিন্তু plan কেনা/বাতিল owner-only থাকবে।

Integration credentials (Facebook, WhatsApp, Payment, Courier ইত্যাদি) নিজ নিজ পেজেই থাকবে — Profile-এ কিছু যাবে না।

## Technical details

- **ডেটা মডেল**: বিদ্যমান `store_staff` টেবিলকেই membership হিসেবে ব্যবহার (role, permissions jsonb, status আগে থেকেই আছে) — নতুন কলাম: `access_type` ('employee' | 'delegated', default 'employee'), `expires_at`, `invited_by`, `last_active_at`। একই ইউজার একাধিক স্টোরে থাকতে পারবে (`user_id` unique থাকলে তা সরিয়ে `(store_id, user_id)` unique)।
- নতুন টেবিল `store_access_invitations`: store_id, email, display_name, role, permissions, expires_at, token_hash (SHA-256, একবার ব্যবহারযোগ্য, ৭ দিন), status (pending/accepted/declined/cancelled/expired), invited_by। GRANT + RLS: শুধু স্টোর মালিক পড়তে/লিখতে পারবে; accept/decline security-definer RPC দিয়ে, যা `auth.email()` মিলিয়ে দেখে।
- `has_store_access` / `staff_can` আপডেট: `expires_at` পার হলে ও status active না হলে false। RLS সব জায়গায় আগের মতোই কাজ করবে।
- **Active store context**: ক্লায়েন্ট বেছে নেওয়া স্টোর `x-orzen-store` হেডারে পাঠাবে (start.ts-এর বিদ্যমান function middleware-এ যুক্ত; localStorage-এ মনে রাখা)। `resolveStoreAccess` হেডার থাকলে সেই স্টোরের জন্য owner বা active+অমেয়াদী membership যাচাই করবে, না থাকলে আগের মতো নিজের স্টোর। অবৈধ হেডার → নিজের স্টোরে ফেরত, কখনো অন্যের ডেটা নয়। সব `storeAccess`/`myStoreRow` এই একই পথ দিয়ে যায়, তাই বিদ্যমান server function বদলাতে হবে না।
- স্টোর বদলালে React Query cache পুরো clear + router invalidate, যাতে আগের স্টোরের ডেটা না দেখায়।
- **Section registry**: `panel-sections.ts`-এ রোল preset (Support/Manager/Marketing/Developer/Viewer) যোগ; নতুন section স্বয়ংক্রিয়ভাবে permission editor-এ আসবে। Owner-only তালিকায় `access_management`, `profile_security` যোগ।
- **Server functions** (`src/lib/delegated-access.functions.ts`): listMyStores, listStoreAccess, inviteAccess, resendInvite, cancelInvite, updateAccess, revokeAccess, getInvite, acceptInvite, declineInvite — invite/update/revoke শুধু `ownerOnlyAccess` middleware দিয়ে (আসল owner যাচাই, active store context নয়)।
- Account profile/security functions (নাম, ইমেইল, পাসওয়ার্ড, 2FA) সবসময় নিজের অ্যাকাউন্টে কাজ করে — delegated স্টোর context এদের প্রভাবিত করে না।
- ইমেইল: বিদ্যমান ORZEN branded mailer দিয়ে invitation ইমেইল।
- Store switch-এ `staff_activity_log`-এ "accessed store" এন্ট্রি; grant/revoke/accept লগ।
- বিদ্যমান Employees পেজ আগের মতো কাজ করবে (access_type='employee'); delegated সদস্যরা Profile-এ ম্যানেজ হবে।
- Preview-তে typecheck + Playwright দিয়ে invite → accept → switch → অনুমতিহীন পেজ বন্ধ যাচাই; তারপর আপনি বললে production DB migration + orzen.top deploy।
