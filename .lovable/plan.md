# সমস্যা কি এবং কেন হচ্ছে

স্ক্রিনশট + ডাটাবেস চেক করে ৩টি সমস্যা পাওয়া গেছে যেগুলোই AI reply বন্ধ থাকার আসল কারণ:

## ১. `human_takeover = TRUE` চালু আছে (এটাই মূল কারণ)
আপনার Messenger integration-এ ডাটাবেসে `human_takeover: true` সেট আছে। Webhook কোড (`src/routes/api/public/messenger/webhook.ts`)-এ স্পষ্ট শর্ত:
```
if (integ.human_takeover || integ.ai_auto_reply === false) continue;
```
মানে — "AI On" ব্যাজ দেখালেও, human_takeover চালু থাকলে AI কোনো reply পাঠাবে না। স্ক্রিনশটে "AI On" চিপ দেখাচ্ছে কারণ UI শুধু `ai_auto_reply` দেখছে, `human_takeover` কে বিবেচনা করছে না।

## ২. লাল box-এ দেখা error স্টেল (পুরনো)
`Last error: (#100) Param recipient[id] must be a valid ID string` — এটা Test Message tool থেকে এসেছে (কেউ PSID এর জায়গায় Page ID বা ভুল নাম্বার দিয়ে টেস্ট করেছিল)। নতুন কোনো incoming message এই error দেয়নি — `delivery_failures: 0`। কিন্তু error কখনো auto-clear হয় না, তাই সবসময় দেখাচ্ছে।

## ৩. AI মডেল ID অবৈধ
`ai_global_settings.default_model` fallback আছে `google/gemini-3-flash-preview` — এটা AI Gateway catalog-এ নেই (`ai-models` অনুসারে সঠিক id হলো `google/gemini-2.5-flash`)। এই কারণে human_takeover বন্ধ করলেও পরবর্তী step-এ generateAgentReply 400 error দিতো।

## AI Agent connection স্ট্যাটাস
- `store_ai_agents`: enabled=true, agent_name="Sales Assistant", language=both — ঠিক আছে ✓
- `ai_global_settings.enabled` = true — ঠিক আছে ✓
- LOVABLE_API_KEY provisioned — ঠিক আছে ✓
- শুধু model id ভুল।

---

# সমাধান পরিকল্পনা

## Fix 1 — Human Takeover বন্ধ + stale error clear
`src/routes/_authenticated/admin/messenger.tsx` (Connected status card):
- একটা visible toggle switch যোগ করা: **"Human Takeover (AI reply বন্ধ রাখে)"** — ON/OFF দেখাবে, ক্লিকে database-এ update হবে।
- Connected কার্ডের ব্যাজ update: `human_takeover=true` হলে "AI On" এর জায়গায় লাল "Paused (Human)" ব্যাজ, না হলে সবুজ "AI On"।
- "Clear error" ছোট বাটন — `last_error` field null করে দেবে।
- এখনই এই স্টোরের `human_takeover` false করে দেওয়া হবে migration/server call এ এবং stale `last_error` মুছে দেওয়া হবে।

সার্ভার সাইড: `src/lib/ai.functions.ts`-এ নতুন serverFn:
- `setMessengerHandoff({ human_takeover: boolean })`
- `clearMessengerLastError()`

## Fix 2 — সঠিক AI মডেল ID
`src/lib/ai-agent.server.ts` ও `src/lib/ai.functions.ts`-এ hard-coded fallback পাল্টে:
```
"google/gemini-3-flash-preview" → "google/gemini-2.5-flash"
```
পাশাপাশি ডাটাবেসে `ai_global_settings.default_model` যদি `gemini-3-flash-preview` থাকে, migration দিয়ে `google/gemini-2.5-flash` এ update।

## Fix 3 — Diagnostic উন্নয়ন
Connected card-এ ছোট "কেন AI reply আসছে না?" checklist সেকশন:
- ✅/❌ AI Auto-Reply on
- ✅/❌ Human Takeover off
- ✅/❌ Webhook verified
- ✅/❌ Page subscribed to `messages` field (Meta Graph `/subscribed_apps` দিয়ে check করে দেখাবে)
- ✅/❌ Token expiring soon

`src/lib/ai.functions.ts`-এ `getMessengerHealth()` serverFn — একবারে সব চেক করে return করবে।

## Fix 4 — Test tool improvement
Test message form-এ ছোট hint: "PSID = webhook-এ আসা customer এর sender.id, Page ID নয়।" এবং "Recent conversations" dropdown-এই default select থাকবে যদি অন্তত একটি থাকে।

---

# পরিবর্তন হবে যেসব ফাইল
- `src/lib/ai-agent.server.ts` — মডেল fallback ঠিক
- `src/lib/ai.functions.ts` — নতুন serverFn: handoff toggle, clear error, health check + মডেল fallback
- `src/routes/_authenticated/admin/messenger.tsx` — Human Takeover toggle, health checklist, badge fix, clear error button
- Supabase migration — `human_takeover=false` এবং `last_error=null` current store-এ; `ai_global_settings.default_model` update

# ভেরিফিকেশন
1. Migration run হলে DB-তে human_takeover=false ও error clear
2. Messenger থেকে test message পাঠালে AI reply আসবে
3. Health checklist সব green দেখাবে
