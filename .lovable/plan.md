# Phase 7: Order Safety, Concurrency & Idempotency

## লক্ষ্য
একই কাস্টমার দুইবার "কনফার্ম" লিখুক, Meta একই মেসেজ দুইবার পাঠাক, বা দুটো worker একসাথে চলুক — একটা অর্ডারের জন্য সবসময় **একটাই ইনভয়েস** হবে। শেষ পিসটা দুজন একসাথে কিনতে চাইলে স্টক মাইনাসে যাবে না।

## বর্তমান অবস্থা (যাচাই করা)
- চ্যাট থেকে অর্ডার তৈরি হয় ৩ জায়গায়: AI-এর `finalizeOrder` (WhatsApp + Messenger), Messenger-এর সরাসরি অর্ডার ধাপ, আর চ্যাট চেকআউট।
- প্রতিটা জায়গায় আলাদা আলাদা ধাপ: স্টক দেখা → ডুপ্লিকেট চেক → ইনভয়েস নম্বর নেওয়া → অর্ডার লেখা → আইটেম লেখা। এগুলো একসাথে (এক লেনদেনে) হয় না, তাই দুটো অনুরোধ প্রায় একসাথে এলে দুটোই চেক পার হয়ে দুটো অর্ডার হতে পারে।
- অর্ডার টেবিলে চ্যাট অর্ডারের জন্য কোনো "একবারই হবে" চাবি (idempotency key) নেই। শুধু ল্যান্ডিং পেজ অর্ডারে আছে।
- ইনভয়েস নম্বর আগে নেওয়া হয়; অর্ডার ব্যর্থ হলে নম্বর নষ্ট হয়।

## কী তৈরি হবে
1. **Order Transaction ID (চাবি)** — প্রতিটা চ্যাট অর্ডারের জন্য একটা চাবি তৈরি: দোকান + কথোপকথন + পণ্য + ভ্যারিয়েন্ট + পরিমাণ + ফোন। একই চাবিতে ৩০ মিনিটের মধ্যে দ্বিতীয় অর্ডার হবে না — আগেরটাই ফেরত আসবে।
2. **এক লেনদেনে অর্ডার তৈরি (ডাটাবেজের ভিতরে)** — একটা নিরাপদ ডাটাবেজ ফাংশন সব কাজ একসাথে করবে:
   - চাবি দিয়ে তালা (একই চাবির দ্বিতীয় অনুরোধ প্রথমটা শেষ হওয়া পর্যন্ত অপেক্ষা করবে)
   - আগে থেকে অর্ডার থাকলে সেটাই ফেরত (নতুন ইনভয়েস নয়)
   - পণ্যের সারি লক করে আসল দাম ও স্টক চেক
   - ইনভয়েস নম্বর, অর্ডার, আইটেম — সব একসাথে; কোনো ধাপ ব্যর্থ হলে কিছুই লেখা হবে না
3. **তিনটা চ্যাট অর্ডার পথ এই ফাংশনে** — আগের ডুপ্লিকেট-পেন্ডিং ব্লক, ডেলিভারি চার্জ, কাস্টমার লিংক, টাইমলাইন, নোটিফিকেশন সব আগের মতো থাকবে; শুধু "লেখা" অংশটা নিরাপদ ফাংশনে যাবে।
4. **কাস্টমারকে উত্তর** — দ্বিতীয়বার "কনফার্ম" এলে: "আপনার অর্ডার #XXXX আগেই নেওয়া হয়েছে" (নতুন অর্ডার নয়)।
5. **স্টক আচরণ** — এখন যেভাবে স্টক কমে (অর্ডার তৈরিতে বা কনফার্মে) সেটা বদলাবে না; শুধু চেকটা লকের ভিতরে হবে যাতে একসাথে দুজন শেষ পিস না পায়।

## যা বদলাবে না
ওয়েবসাইট চেকআউট, ল্যান্ডিং পেজ, অ্যাডমিন ম্যানুয়াল অর্ডার, কল সেন্টার — হাত দেওয়া হবে না। Buy Now মেসেজ, ফাস্ট-পাথ, AI-এর কথা বলার ধরন একই থাকবে।

## পরীক্ষা (লাইভে)
- একই অর্ডার অনুরোধ একসাথে ৫ বার পাঠিয়ে → ১টা অর্ডার, ১টা ইনভয়েস।
- স্টক ১ থাকা পণ্যে দুটো আলাদা কাস্টমার একসাথে → একজন পাবে, অন্যজন "স্টক নেই"।
- WhatsApp টেস্ট কথোপকথনে এক রাউন্ড সাধারণ অর্ডার; টেস্ট অর্ডারগুলো পরে বাতিল করে রাখা।
- বিল্ড চেক, প্রোডাকশন ডিপ্লয়, parity check।

## Technical details
- Migration (prod + dev): `orders.idempotency_key text null` + index `(store_id, idempotency_key, created_at desc) where idempotency_key is not null`.
- `create_chat_order(_store_id, _idem_key, _order jsonb, _items jsonb)` SECURITY DEFINER, `set search_path=public`, EXECUTE service_role only: `pg_advisory_xact_lock(hashtextextended(_store_id||_idem_key,0))` → existing order with same key in last 30 min → return `{id, invoice_no, existing:true}`; `select ... from products where id=any(...) and store_id=_store_id for update`; stock check (skip digital/service/subscription); `generate_invoice_no`; insert order + order_items; return `{id, invoice_no, existing:false}`; raises `out_of_stock` / `product_not_found`.
- Stock decrement: inspect existing triggers (`on_order_status_change`, stock_movements) at implementation and keep the same point of decrement.
- `src/lib/chat-order.server.ts` (new): `buildIdempotencyKey({channel, conversationId, productId, variant, qty, phone})` (sha256 hex) + `createChatOrder(sb, …)` wrapper mapping errors.
- Call sites: `ai-agent.server.ts` `finalizeOrder` (~line 1887-1915), `messenger-webhook.server.ts` direct order (~line 720), `conversational-checkout.server.ts` (~line 110). Post-insert side effects (timeline, customer link, notifications) run only when `existing=false`.
- Concurrency test script via service-role parallel RPC calls on prod against a test product; cleanup cancels test orders.
- Record rule in `AGENTS.md`.
