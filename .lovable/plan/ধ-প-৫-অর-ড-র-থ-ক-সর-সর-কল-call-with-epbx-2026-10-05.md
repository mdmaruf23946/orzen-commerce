# ধাপ ৫: অর্ডার থেকে সরাসরি কল (Call with ePBX)

## এখন যা আছে
- অর্ডার কার্ড, অর্ডারের বিস্তারিত পাতা আর কাস্টমার প্রোফাইলে একটা "Call" বাটন আছে। এটা ePBX দিয়ে কল শুরু করে: আগে আপনার ডিফল্ট এক্সটেনশন বাজে, তারপর কাস্টমার।
- কল শুরু হলে ফলাফল লেখার ফর্ম খোলে (Order Confirmed, Wants Callback, Wrong Number ইত্যাদি + নোট)। কিন্তু সেখানে "Order Confirmed" বাছলেও অর্ডারের অবস্থা বদলায় না।

## যা বানানো হবে

**১. "Call with ePBX" বাটন**
- অর্ডার কার্ড আর অর্ডারের বিস্তারিত পাতায় বাটনের নাম হবে "Call with ePBX"।
- চাপলে ছোট একটা নিশ্চিতকরণ বাক্স খুলবে, যেখানে দেখাবে:
  - কাস্টমারের নাম ও নম্বর।
  - **কোন এক্সটেনশন/ফোনে আগে বাজবে:** আপনার সেভ করা এক্সটেনশনের তালিকা থেকে বাছাই করা যাবে, ডিফল্টটা আগে থেকে বাছা থাকবে।
  - এক লাইনে বুঝিয়ে লেখা থাকবে: "আগে আপনার ফোন বাজবে, ধরলে কাস্টমারকে কল যাবে।"
- ePBX কানেক্ট না থাকলে, ব্যালেন্স ৳০ হলে, বা এক্সটেনশন না থাকলে, কল চাপার আগেই সেটা স্পষ্ট করে লেখা থাকবে।

**২. কল চলার সময়**
- ফর্মের উপরে কলের অবস্থা নিজে থেকে আপডেট হবে: Calling → Answered / No answer / Busy। ePBX খবর পাঠালে কতক্ষণ কথা হয়েছে সেটাও বসে যাবে।

**৩. কল শেষে ফলাফল ও নোট**
- নতুন ফলাফলের অপশন: **Address Updated**, **Delivery Rescheduled**। আগের অপশনগুলোও থাকবে।
- "Order Confirmed" বা "Order Cancelled" বাছলে একটা টিক-বাক্স থাকবে: **"অর্ডারের অবস্থাও বদলান"** (আগে থেকেই টিক দেওয়া)। এটা শুধু তখনই কাজ করবে যখন অর্ডার এখনো pending আছে।
- "Address Updated" বাছলে নতুন ঠিকানা লেখার ঘর আসবে, Save চাপলে অর্ডারের ঠিকানা বদলে যাবে।
- নোট আর ফলাফল অর্ডারের ইতিহাসে লেখা থাকবে ("Call with ePBX — Order Confirmed — নোট…")। Calls & History তালিকাতেও দেখাবে।
- অর্ডার কনফার্ম হলে অপেক্ষায় থাকা অটো কল নিজে থেকেই বাতিল হয়ে যাবে (ধাপ ৩-এর নিয়ম অনুযায়ী)।

## যাচাই
- টেস্ট সিস্টেমে একটা কলের ফলাফল সেভ করে দেখব: অর্ডারের অবস্থা বদলায় কিনা, ঠিকানা বদলায় কিনা, ইতিহাসে লেখা হয় কিনা। টেস্ট ডেটা পরে মুছে দেব।
- কোড চেক করা, orzen.top-এ চালু করা, আর লাইভ পেজ খুলছে কিনা দেখা।
- ব্যালেন্স ৳০ আর লাইন চালু না থাকায় আসল কল দেওয়া যাবে না। এটা স্পষ্ট করে জানাব।

## Technical details
- `call-center.ts`: add `address_updated`, `delivery_rescheduled` to `CallResult`/`RESULT_LABEL` (no DB constraint on `calls.result`).
- `CallButton`: new label prop default for order surfaces; confirm dialog gets extension `<select>` from `listProviderExtensions` + balance/connection hints from `useProviderOverview`; passes `extension` to `startCall` (already supported, server validates 2–6 digits).
- `CallResultDialog`: poll `getCall` every 3s while status is calling/ringing (stop after 3 min); new `apply_to_order` checkbox and `new_address` field.
- `updateCallOutcome`: optional `apply_to_order` + `new_address`. Looks up the call's `order_id` scoped to the store; confirm/cancel updates `orders.status` only `.eq("status","pending")`; address updates `orders.address`; inserts an `order_timeline` row with result + note. All via `context.supabase` (RLS as merchant).
