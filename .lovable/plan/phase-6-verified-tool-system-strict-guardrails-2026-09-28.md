# Phase 6: Verified Tool System & Strict Guardrails

## লক্ষ্য
দাম, স্টক, ডেলিভারি চার্জ — এই তিনটা তথ্য AI কখনো নিজে থেকে বলবে না। সবসময় দোকানের আসল ডাটা থেকে (টুলের মাধ্যমে) আসবে। টুলের ফলাফলের সাথে না মিললে উত্তর পাঠানোর আগেই ঠিক করা হবে বা আটকে দেওয়া হবে।

## বর্তমান অবস্থা (যাচাই করা)
- AI-এর ২০টা টুল আছে (পণ্য খোঁজা, স্টক চেক, অর্ডার, ট্র্যাকিং ইত্যাদি), কিন্তু **ডেলিভারি চার্জের আলাদা টুল নেই** — চার্জ আসে প্রম্পটে লেখা দোকানের তথ্য থেকে, যেটা AI ভুল পড়তে বা বানাতে পারে।
- প্রম্পটে "NEVER invent facts" লেখা আছে, কিন্তু সেটা শুধু অনুরোধ — কোনো কোড-যাচাই নেই।
- পাঠানোর আগের চেক (`sanitizeOutgoingText`) শুধু "নিচে দেখুন", লিংক ইত্যাদি সরায়; দাম/স্টক/চার্জ মিলিয়ে দেখে না।

## কী তৈরি হবে

1. **নতুন টুল `getDeliveryCharge`** — দোকানের ডেলিভারি এলাকা + পণ্যের নিজস্ব চার্জ থেকে, অর্ডারে যে `resolveDeliveryCharge` ব্যবহার হয় সেটাই ব্যবহার করবে। তাই চ্যাটে বলা চার্জ আর অর্ডারের চার্জ সবসময় এক থাকবে।
2. **প্রতিটা উত্তরের জন্য "Verified Facts ledger"** — উত্তর দেওয়ার সময় টুলগুলো যত দাম, স্টক আর চার্জ ফেরত দেয়, সেগুলো একটা তালিকায় জমা হবে (শুধু সেই দোকান আর সেই কথোপকথনের জন্য)।
3. **প্রম্পট কড়া করা** — দাম/স্টক/চার্জ বলার আগে টুল কল বাধ্যতামূলক; প্রম্পট থেকে কাঁচা ডেলিভারি JSON সরিয়ে শুধু "getDeliveryCharge ব্যবহার করুন" নির্দেশ (এতে প্রম্পটও কিছুটা ছোট হবে)।
4. **Response Validation Layer (পাঠানোর আগে)** — উত্তরে থাকা প্রতিটা টাকার অঙ্ক (৳, টাকা, Tk, বাংলা/ইংরেজি সংখ্যা) ledger-এর সাথে মেলানো:
   - মিলে গেলে → যেমন আছে তেমন পাঠানো।
   - অঙ্ক আছে কিন্তু টুল কল হয়নি/মেলে না → সেই অংশের জন্য আসল ডাটা থেকে দ্রুত আবার খুঁজে ঠিক অঙ্ক বসানো; না পারলে সেই বাক্য সরিয়ে "সঠিক দাম জানাতে একটু সময় দিন" ধরনের নিরাপদ লাইন।
   - "স্টকে আছে" বললেও টুল স্টক ০ দেখালে → বাক্য বদলে "এই মুহূর্তে স্টকে নেই" (digital/service/subscription পণ্য বাদ — এদের স্টক লাগে না)।
   - অর্ডারের মোট (subtotal+charge) হিসাবও যাচাই।
5. **লগ ও নজরদারি** — প্রতিটা ঠিক করা/আটকানো ঘটনা `ai_messages`-এ রেকর্ড (কী বলেছিল, কী ঠিক করা হলো), যাতে পরে দেখা যায় AI কতবার ভুল করতে চেয়েছিল।
6. **দুই চ্যানেলেই** — WhatsApp আর Messenger দুটোতেই একই যাচাই; ওয়েব চ্যাটেও একই টুল যোগ হবে।

## যা বদলাবে না
Buy Now, ফাস্ট-পাথ, ছবি মেলানো, অর্ডার তৈরি, হিউম্যান টেকওভার, কিউ — সব আগের মতো। এগুলো আগেই সরাসরি ডাটাবেজ থেকে তথ্য নেয়।

## পরীক্ষা (লাইভে)
- "দাম কত?", "স্টক আছে?", "ঢাকার বাইরে ডেলিভারি চার্জ কত?" — উত্তর দোকানের আসল ডাটার সাথে মিলছে কিনা।
- জোর করে ভুল দামের উত্তর বানিয়ে validation layer-এ পাঠিয়ে দেখা যে সেটা ঠিক হয়।
- WhatsApp টেস্ট কনভার্সেশনে এক রাউন্ড; Messenger-এ এক রাউন্ড।
- বিল্ড চেক, প্রোডাকশনে ডিপ্লয় (wrangler), parity check।

## Technical details
- `src/lib/ai-agent.server.ts`: add `getDeliveryCharge` tool (input: product_id?, area/address?) reusing `resolveDeliveryCharge`; every price/stock/charge-returning tool (`searchProducts`, `getProduct`, `checkStock`, `compareProducts`, `getRelatedProducts`, `showProduct(s)`, `collectOrderInfo`, `finalizeOrder`, `getDeliveryCharge`) pushes into a per-call `facts.verified = { prices:Set<number>, charges:Set<number>, stock: Map<productId,{qty,type}>, totals:Set<number> }`, returned from `generateAgentReply` alongside existing `facts`.
- System prompt: replace `Delivery: JSON.stringify(store.delivery)` with tool instruction; add hard rule "numbers without a tool result this turn are forbidden".
- New `src/lib/reply-guard.server.ts`: `guardReply(text, verified, {storeId, focusProductId})` → `{text, corrections[]}`; money regex for ৳/টাকা/Tk/BDT with Bangla digits (`toBnDigits` inverse); tolerance 0; one DB re-lookup (store-scoped) for focus product when unverified; stock claim regex bn/en; skip stockless types via `isStockless`.
- Wire in `whatsapp-webhook.server.ts` (~line 627) and `messenger-webhook.server.ts` (~line 2566) before `sanitizeOutgoingText`; `api/ai/chat.ts` (streaming) gets the tool only (post-stream guard not possible; logged).
- Corrections logged as `ai_messages` role `system`, message_type `guard`, content JSON. No schema change needed unless `message_type` has a check constraint — verified at implementation; if so, a small migration on prod + dev.
- Update `AGENTS.md` with the guard rule.
