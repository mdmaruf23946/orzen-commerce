# Marketing & Targeting workspaces — পরিষ্কার ও non-duplicated structure

Facebook, Google ও TikTok-এর workspace একই নীতিতে সাজানো হবে, কিন্তু প্রতিটি প্ল্যাটফর্মে শুধু বাস্তবে কাজ করা সুবিধাই থাকবে। বর্তমান সংযোগ, ID, token, test tools ও saved data অক্ষত থাকবে।

## নতুন menu structure

প্রতিটি connected platform-এ আপাতত শুধু এই দুইটি কার্যকর section থাকবে:

```text
Facebook Marketing
├── Overview
└── Integration

Google Marketing
├── Overview
└── Integration

TikTok Marketing
├── Overview
└── Integration
```

- `Settings` বাদ যাবে—বর্তমানে আলাদা general settings নেই; সব দরকারি toggle ও preference Integration-এই থাকবে।
- `Events`, `Audiences`, `Attribution`, `Google Ads`, `Conversion Tracking`, `Pixel` ও `CAPI` আলাদা menu হিসেবে থাকবে না, কারণ বর্তমান ব্যবস্থায় সেগুলো হয় integration fields-এর পুনরাবৃত্তি, নয়তো বাস্তব monitoring/management data নেই।
- ভবিষ্যতে কোনো platform API থেকে সত্যিকারের event monitoring, audience management বা attribution data এলে registry-তে সেই capability যোগ করলেই আলাদা menu দেখানো যাবে।

## Overview — শুধু business results

- Date range ও previous-period comparison থাকবে।
- বাস্তব store data থেকে customers, orders, confirmed/paid purchases, revenue, average order value ও order-to-purchase rate দেখাবে।
- Visitors, add-to-cart বা platform-attributed revenue-এর নির্ভরযোগ্য data বর্তমানে সংরক্ষিত হয় না; এগুলো `0` বা অনুমান হিসেবে দেখানো হবে না। প্রয়োজন হলে স্পষ্ট “Not available from current tracking data” state দেখাবে।
- কোনো Pixel ID, token, test code, enable switch বা technical status form Overview-তে থাকবে না।

## Integration — একমাত্র technical source of truth

- Platform connection status ও enabled/disabled state।
- **Facebook:** Pixel, Conversions API token, browser/server tracking, test event code, automatic event coverage, test-event action।
- **Google:** GA4 Measurement ID/API secret, Google Ads conversion ID/label, purchase tracking, GTM container, test/verify actions। Google Ads আলাদা menu নয়; এখানেই নিজস্ব পরিষ্কার subsection থাকবে।
- **TikTok:** Pixel, Events API token, test event code, advanced matching, automatic event coverage, test-event action।
- Main Store ও Landing Page-এর saved tracking targets একই platform-এর Integration section-এ যাবে; platform picker বাদ দিয়ে বর্তমান platform fixed থাকবে। এতে hub page বা অন্য section-এ credential duplication থাকবে না।
- Disconnect করলে IDs/tokens মুছে না দিয়ে platform switches বন্ধ হবে; reconnect করলে saved information পুনরায় ব্যবহার করা যাবে। বর্তমান save paths ব্যবহার হবে, নতুন database structure লাগবে না।

## Hub ও sidebar

- `Marketing & Targeting Apps` hub-এ শুধু platform cards, connection status ও `Connect / Setup` / `Manage` action থাকবে।
- Hub থেকে mixed `Tracking Setup` form সরবে; setup সংশ্লিষ্ট platform-এর Integration-এ থাকবে।
- Sidebar registry নতুন দুই-section structure অনুসরণ করবে এবং connected-platform-only আচরণ অপরিবর্তিত থাকবে।

## Technical details

- Platform registry-কে বাস্তব capabilities অনুযায়ী সরল করা হবে।
- বর্তমান all-in-one Facebook/Google/TikTok forms-কে reusable Integration views করা হবে; Overview আর সেই forms render করবে না।
- Store-scoped, lightweight marketing performance read যোগ হবে, যাতে Analytics subscription-এর ওপর workspace নির্ভর না করে এবং কোনো platform attribution কল্পনা না করা হয়।
- Tracking target form fixed-platform mode নেবে; saved target data ও existing server functions অপরিবর্তিত থাকবে।
- Disconnect/reconnect existing platform update functions দিয়েই হবে; secrets browser response-এ নতুন করে প্রকাশ করা হবে না।
- Preview-তে তিন platform workspace, mobile sidebar, save/test actions ও build যাচাই করা হবে। `orzen.top`-এ live deployment আলাদা নির্দেশ পেলে Cloudflare procedure দিয়ে করা হবে।
