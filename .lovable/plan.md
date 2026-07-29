## লক্ষ্য

প্রতিটি Connected Courier-এর জন্য একটি একীভূত (unified) Parcel Management Dashboard — parcel তৈরি, স্ট্যাটাস sync, tracking, invoice/label প্রিন্ট, pickup, COD হিসাব, লগ এবং auto-create automation। Frontend সব কুরিয়ারের জন্য এক, backend provider-specific adapter।

## যা এখন আছে (যাচাই করা)

- `src/components/admin/couriers/providers.ts` — ৭টি কুরিয়ারের metadata + `supports` ফ্ল্যাগ।
- `src/lib/couriers.server.ts` — শুধু auth probe (`probeCourier`) ও location sync (`syncCourierData`)।
- `src/lib/admin.functions.ts` — `updateCouriers`, `testCourierConnection`, `syncCourierInfo`।
- `orders` টেবিলে ইতিমধ্যে `courier_name, courier_code, courier_tracking_id, courier_status, courier_last_synced_at` কলাম আছে।
- Parcel তৈরি/স্ট্যাটাস/লগের কোনো টেবিল বা adapter এখনো নেই।

## ধাপ ১ — ডাটাবেস (migration)

- `courier_parcels`: store_id, order_id, courier_key, status (enum-like text: draft/pending/pickup_requested/pickup_completed/in_transit/delivered/partial_delivered/returned/cancelled/hold), consignment_id, tracking_code, tracking_url, cod_amount, delivery_charge, return_charge, collection_status, weight, dimensions, note, recipient snapshot (name/phone/address/city/zone/area), payload/response jsonb, last_synced_at, error, created_at/updated_at।
- `courier_parcel_events`: parcel_id, status, message, source (api/webhook/manual), raw jsonb, created_at — Delivery Timeline-এর ভিত্তি।
- `courier_api_logs`: store_id, courier_key, parcel_id, direction/endpoint/method, request jsonb (masked), response jsonb, http_status, duration_ms, ok, created_at।
- `courier_pickup_requests`: store_id, courier_key, pickup date/address/contact, status, response, created_at।
- সব টেবিলে GRANT (authenticated + service_role) → RLS enable → owner-scoped policy (`is_store_owner(store_id)`), credential/raw ফিল্ডে secret মাস্কিং সার্ভারেই করা হবে।

## ধাপ ২ — Provider Adapter Layer (backend)

`src/lib/couriers/` ফোল্ডার, একটি common interface:

```text
CourierAdapter {
  createParcel(ctx, parcel) -> { consignmentId, trackingCode, trackingUrl, raw }
  cancelParcel?(ctx, parcel)
  getStatus(ctx, parcel) -> { status, events[] }
  requestPickup?(ctx, payload)
  label?(ctx, parcel) -> pdf/url
}
```

- `steadfast.ts` — `create_order`, `status_by_cid/invoice`, balance।
- `pathao.ts` — OAuth token (বিদ্যমান `pathaoToken` পুনর্ব্যবহার), `/aladdin/api/v1/orders`, city/zone/area, order info।
- `redx.ts` — `/parcel`, `/parcel/track/{id}`, areas।
- `paperfly.ts` — Basic + paperflykey, order placement + `OrderStatus`।
- `ecourier.ts` — User-Id/API-Key/API-Secret হেডার, `order-place`, `track`।
- `sa_paribahan.ts`, `sundarban.ts` — এদের কোনো উন্মুক্ত পাবলিক API ডকুমেন্টেশন নেই; এগুলো **manual adapter** হিসেবে থাকবে: parcel রেকর্ড, ম্যানুয়াল tracking নম্বর/স্ট্যাটাস আপডেট, invoice/label প্রিন্ট — একই UI, শুধু "API নেই" ব্যাজ ও ম্যানুয়াল ইনপুট। ভবিষ্যতে merchant API পেলে শুধু adapter ফাইল যোগ করলেই চলবে।
- প্রতিটি কল `courier_api_logs`-এ লগ হবে; status ম্যাপিং হবে একটি common `normalizeStatus()` দিয়ে (duplicate code এড়াতে)।

## ধাপ ৩ — Server functions (`src/lib/courier-parcels.functions.ts`)

`requireSupabaseAuth` + `assertPlan("courier")` সহ: `listParcels` (filter: courier/status/search/date, pagination), `getParcel`, `createParcelFromOrder`, `saveDraftParcel`, `bulkSendParcels`, `cancelParcel`, `recreateParcel`, `refreshParcelStatus`, `bulkRefreshStatus`, `retryFailedParcel`, `requestPickup`, `listPickupHistory`, `listParcelLogs`।

## ধাপ ৪ — Frontend (Unified UI, কার্ড ডিজাইন অপরিবর্তিত)

- `SimpleCourierCard`/`CourierCard`-এ **শুধু connected (enabled + credentials verified) হলে** একটি "Manage Parcels" বাটন যোগ হবে — বাকি ডিজাইন হুবহু একই।
- নতুন রুট `/_authenticated/admin/couriers/$courierKey/parcels` (এবং সব কুরিয়ারের জন্য `/admin/parcels` overview):
  - স্ট্যাটাস ট্যাব/চিপ (Pending, Pickup Requested, In Transit, Delivered, Returned, …) + count।
  - মোবাইলে card list, ডেস্কটপে table; bulk select → Bulk Send / Refresh Status।
  - Parcel drawer: Details (customer, address, products, weight, dimensions, note), Timeline, COD & charges, Logs (request/response/error, last sync), Actions (cancel, recreate, retry, print)।
  - Create Parcel dialog: confirmed order থেকে prefill, courier-specific ফিল্ড (Pathao city/zone/area ইত্যাদি) `supports` অনুযায়ী শর্তসাপেক্ষে দেখানো, Draft হিসেবে সেভ।
  - Pickup ট্যাব: pickup request ফর্ম + history।
- Print: বিদ্যমান invoice প্রিন্ট প্যাটার্ন ব্যবহার করে Invoice / Shipping Label / Packing Slip প্রিন্ট ভিউ (browser print → PDF), tracking নম্বর ও বারকোড/QR সহ।
- Orders পেজ ও `OrderDetailsDrawer`-এ "Send to Courier" + tracking স্ট্যাটাস ব্যাজ যুক্ত হবে।

## ধাপ ৫ — Smart Automation

- Courier কার্ডে (ইতিমধ্যে থাকা `automation.autoParcel`) "Auto Create Courier Parcel" টগল কার্যকর করা হবে: order `confirmed` হলে ডিফল্ট/নির্বাচিত কুরিয়ারে স্বয়ংক্রিয়ভাবে parcel তৈরি (ব্যর্থ হলে parcel `failed` স্ট্যাটাসে থাকবে ও Retry করা যাবে)। বন্ধ থাকলে Manual Mode।
- স্ট্যাটাস sync: বিদ্যমান cron রুট প্যাটার্ন (`/api/public/cron/...`) অনুসরণ করে একটি `sync-courier-status` endpoint — active parcel-গুলোর স্ট্যাটাস আপডেট + timeline event + order status মিরর।

## কারিগরি নোট

- সব API কল server-side (`*.server.ts`), credentials কখনো ক্লায়েন্টে যাবে না; লগে key/secret মাস্ক করা হবে।
- একটি adapter registry (`registry.ts`) — নতুন কুরিয়ার = একটি ফাইল, UI অপরিবর্তিত।
- Mobile-first: ভার্চুয়ালাইজড/pagination লিস্ট, react-query ক্যাশ, lazy-loaded drawer।

## ডেলিভারি ক্রম

1. Migration + adapter registry + SteadFast/Pathao/RedX/Paperfly adapters
2. Server functions + Parcel dashboard UI (unified) + card-এ Manage Parcels বাটন
3. Print (invoice/label/packing slip) + Pickup + Logs
4. eCourier adapter, SA Paribahan/Sundarban manual mode
5. Auto-create automation + status sync cron
