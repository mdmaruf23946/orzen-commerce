# ORZEN Merchant Panel — Professional Menu Reorganization Plan

## লক্ষ্য

মার্চেন্ট যেন প্রতিদিনের কাজ দ্রুত খুঁজে পান, একই ধরনের অপশন এক জায়গায় থাকে এবং বড় মেনুটিও অল্প স্ক্রলেই নিয়ন্ত্রণ করা যায়। বর্তমান সব পেজ, ডেটা, প্ল্যান-ফিচার এবং কর্মচারীর পারমিশন অক্ষুণ্ণ থাকবে—শুধু নেভিগেশন ও তার ব্যবহার-অভিজ্ঞতা পুনর্গঠন হবে।

## প্রস্তাবিত ৯টি প্রধান সেকশন

### ১. Core
- Dashboard
- Notifications Inbox — unread badgeসহ

### ২. Orders & Delivery
- All Orders — নতুন অর্ডার badgeসহ
- Courier & Shipping
  - Courier Orders
  - Courier Parcels
  - Courier Setup
  - Delivery Zones
- Returns & Exchanges — pending return badgeসহ

### ৩. Products & Inventory
- Products
- Categories
- Inventory & Stock
  - Inventory
  - Low Stock Alerts — alert badgeসহ
- Catalogue Tools
  - Product Defaults
  - Import / Export

### ৪. Customers & Support
- Customer Directory
  - Customers
  - Customer Accounts
- Call Center
  - Manual Call Center
  - AI Call Center
- Duplicate Protection — warning badgeসহ

### ৫. Channels & AI
- Omnichannel Inbox
  - Messenger Inbox
  - WhatsApp Inbox
  - Handoff Queue
- Channel Setup
  - Messenger
  - WhatsApp Integration
- AI Command Center
  - Agents
  - Approvals
  - Merchant Identity
  - AI Settings
  - Activity Log
- AI Sales Agent
- AI Recommendations — badgeসহ

### ৬. Marketing & Sales
- Marketing & Tracking
- Coupons & Discounts
- Landing Pages
  - Landing Page Builder
  - Landing Page Integrations
- Facebook Page
  - Page Overview
  - Posts
  - Comments
  - Create Post
  - Moderation
  - Page Settings
- SEO Tools

### ৭. Finance & Analytics
- Analytics — Overview, Courier Overview ও Payment Overview একই পেজে থাকবে
- Business Finance
- Payment Gateways

### ৮. Online Storefront
- Theme & Styling
- Banners & Sliders
- Pages & Legal Content
- Invoice Templates

### ৯. Settings & Management
- Store Settings
  - Store Information
  - Store Configuration
  - Order & Workflow
  - Account Security
- Domains & DNS
  - Domains
  - DNS Checker
- Employees & Team
- Activity Log
- Customer Notification Setup
- My Subscription
- Billing & Plans
- Support

## Sidebar-এর ব্যবহার-অভিজ্ঞতা

- **Accordion আচরণ:** সক্রিয় পেজের সেকশন স্বয়ংক্রিয়ভাবে খোলা থাকবে; অন্য সেকশনগুলো বন্ধ থাকবে। মার্চেন্ট চাইলে একাধিক সেকশন খুলতে পারবেন।
- **মনে রাখা:** ডেস্কটপে sidebar ছোট/বড় করা এবং খোলা সেকশনগুলোর অবস্থা পরেরবারও মনে থাকবে।
- **Nested submenu:** Courier, Inventory, Customer Directory, Call Center, Inbox, Channel Setup, AI, Landing Pages, Facebook, Store Settings এবং Domains—পরিষ্কার parent/child স্তরে দেখানো হবে।
- **Active state:** বর্তমান পেজের parent section ও child item—দুটিই স্পষ্টভাবে চিহ্নিত হবে।
- **Badge roll-up:** child item-এর pending count বন্ধ parent-এর উপর দেখাবে; একই count অপ্রয়োজনে দুই জায়গায় দেখানো হবে না।
- **Menu search:** parent ও child—দুই স্তরের নাম দিয়েই search করা যাবে; ফল পাওয়া গেলে সংশ্লিষ্ট section ও submenu নিজে থেকে খুলবে।
- **Compact desktop mode:** শুধু পরিচিত icon দেখা যাবে; tooltip-এ নাম ও badge count থাকবে।
- **Mobile drawer:** বর্তমান পেজ নির্বাচন করলে drawer বন্ধ হবে; বড় tap area, backdrop close এবং fixed header বজায় থাকবে।
- **Bottom utilities:** Owner Panel (শুধু owner) ও Logout আলাদা স্থায়ী utility area-তে থাকবে, যাতে মেনুর মাঝখানে হারিয়ে না যায়।

## Duplicate ও পুরোনো অপশন ব্যবস্থাপনা

- `Employees & Team` হবে team access ও permission-এর একমাত্র দৃশ্যমান মূল অপশন।
- পুরোনো `Staff` লিংক sidebar থেকে সরানো হবে, কিন্তু তার পেজ/ডেটা এখনই delete করা হবে না—পুরোনো bookmark বা প্রয়োজনীয় রেকর্ড ভাঙবে না।
- Messenger, WhatsApp, Courier এবং Landing Page-এর একাধিক পেজ delete বা merge না করে submenu-তে গুছিয়ে দেওয়া হবে।
- কোনো public URL rename করা হবে না; ফলে পুরোনো link ও page access সচল থাকবে।

## Permission ও Plan নিরাপত্তা

- বিদ্যমান permission key অপরিবর্তিত থাকবে; শুধু permission editor-এ section group-এর নাম ও serial নতুন menu-এর সঙ্গে মিলবে।
- Owner-only অংশ—Payment Gateway, Domains, Employees, Subscription, Billing ও Store Settings—আগের মতো সুরক্ষিত থাকবে।
- কর্মচারী শুধু অনুমোদিত parent/child item দেখবেন; direct URL খুললেও বর্তমান access guard কাজ করবে।
- View-only ও Manage permission-এর আচরণ অপরিবর্তিত থাকবে।
- Plan-এ বন্ধ feature-এর বর্তমান lock/gate অক্ষুণ্ণ থাকবে।

## বাস্তবায়নের ধাপ

1. **একটি কেন্দ্রীয় navigation map তৈরি** — section, item, child, icon, route, badge ও permission সম্পর্ক এক জায়গায় সংজ্ঞায়িত করা হবে।
2. **Sidebar renderer পুনর্গঠন** — ওই map থেকে accordion section, nested submenu, active state, search এবং badge তৈরি হবে।
3. **Permission map sync** — employee permission editor-এর group order ও labels একই কাঠামোর সঙ্গে মিলবে; existing saved permissions ব্যবহারযোগ্য থাকবে।
4. **Legacy Staff link পরিষ্কার** — sidebar-এ duplicate entry বাদ দেওয়া হবে, কিন্তু route/data অপরিবর্তিত থাকবে।
5. **Desktop ও mobile polish** — full, compact এবং drawer—তিন অবস্থায় spacing, text fit, icons, focus state ও scrolling ঠিক করা হবে।
6. **Regression verification** — owner এবং সীমিত-permission employee—দুই ধরনের access দিয়ে navigation, direct URL, badges, search, active state, plan locks ও logout যাচাই করা হবে।
7. **Production release** — type-check ও live browser verification সফল হওয়ার পর কেবল নিরাপদ Cloudflare deployment পদ্ধতিতে `orzen.top`-এ প্রকাশ করা হবে; Lovable Cloud-এর ডেটা বা live target পরিবর্তন করা হবে না।

## কারিগরি সীমা

- পরিবর্তন মূলত Merchant Panel navigation ও permission-label layer-এ সীমাবদ্ধ থাকবে।
- নতুন database table/migration লাগবে না।
- কোনো merchant data, order, product, staff record বা configuration বদলাবে না।
- কোনো route delete/rename এবং কোনো security rule শিথিল করা হবে না।

## সফলতার মানদণ্ড

- প্রথমবার ঢুকলে শুধু active section খোলা এবং পুরো sidebar সহজে scan করা যায়।
- প্রতিটি বর্তমান Merchant Panel পেজ নতুন menu থেকে পাওয়া যায়।
- child নাম লিখেও search result পাওয়া যায়।
- owner-only ও employee permission visibility আগের মতো সঠিক থাকে।
- desktop expanded/collapsed এবং mobile drawer—সব অবস্থায় text/icon/badge overlap হয় না।
- `orzen.top`-এ authenticated Merchant Panel smoke test ও নিরাপদ deployment checks সফল হয়।
