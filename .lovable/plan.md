## লক্ষ্য

বিদ্যমান কুরিয়ার ইন্টিগ্রেশন সিস্টেম (SteadFast, Pathao, RedX, Paperfly) অক্ষত রেখে তিনটি নতুন কুরিয়ার যোগ করা হবে: **eCourier**, **S.A. Paribahan**, **Sundarban Courier** — প্রত্যেকের নিজস্ব official API-এর জন্য আলাদা credential fields সহ। Winner Admin থেকে branding (logo, wordmark, brand color) manage করা যাবে, Store Admin থেকে credentials configure হবে।

## Architecture — provider-specific fields (নতুন)

বর্তমান `CourierConfig` টি সব provider-এর জন্য একই fields ব্যবহার করে (`api_key`, `secret`, `base_url`)। এখন provider-specific fields দরকার। সমাধান: `CourierConfig` তে একটি নতুন **`credentials: Record<string, string>`** map যোগ করা হবে, এবং প্রত্যেক provider-এর `CourierMeta` তে একটি **`credentialFields: CredentialFieldSpec[]`** array থাকবে যা declaratively বলে দেবে সেই provider-এর জন্য কোন কোন field render করতে হবে।

```text
CredentialFieldSpec {
  key: string          // e.g. "user_id", "api_secret", "store_id"
  label: string        // UI label
  type: "text" | "password" | "url" | "select"
  required?: boolean
  placeholder?: string
  options?: {label,value}[]  // for select
  help?: string
}
```

পুরনো চারটি courier-এর জন্য default `credentialFields` = `[api_key, secret, base_url]` — অর্থাৎ existing behavior অপরিবর্তিত।

## ধাপসমূহ

### ১. Providers registry extend
File: `src/components/admin/couriers/providers.ts`
- `CourierKey` union-এ যোগ: `"ecourier" | "sa_paribahan" | "sundarban"`
- `CourierConfig`-এ যোগ: `credentials?: Record<string, string>`
- `CourierMeta`-এ যোগ: `credentialFields?: CredentialFieldSpec[]`, `supportsWebhook?: boolean`
- বিদ্যমান ৪টি entry অপরিবর্তিত, নতুন ৩টি entry যোগ:
  - **ecourier** · brandColor `#00A651` · fields: `user_id`, `api_key`, `api_secret`, `base_url`, sandbox toggle, webhook supported
  - **sa_paribahan** · brandColor `#1F4E9C` · fields: `merchant_code`, `api_key`, `base_url` (S.A. Paribahan-এর corporate API আসলে limited; extra field না বানিয়ে আমরা শুধু official-supported fields রাখব)
  - **sundarban** · brandColor `#B45309` · fields: `username`, `password`, `base_url` (Sundarban-এর current integration মূলত username/password based; API key invent করব না)

### ২. Database seed (courier_providers rows)
Migration: তিনটি নতুন row insert (`ON CONFLICT (code) DO NOTHING`):
- ecourier · "eCourier" · `#00A651` · "Nationwide COD & express" · sort_order 50
- sa_paribahan · "S.A. Paribahan" · `#1F4E9C` · "Trusted nationwide parcel service" · sort_order 60
- sundarban · "Sundarban Courier" · `#B45309` · "Legacy nationwide network" · sort_order 70
- `is_active=true`, `logo_url=null` (Winner Admin থেকে upload হবে)

### ৩. Server validation update
File: `src/lib/admin.functions.ts`
- `courierProvider` zod schema-তে `credentials: z.record(z.string().max(500)).optional()` যোগ
- `couriersSchema`-তে তিনটি নতুন key যোগ: `ecourier`, `sa_paribahan`, `sundarban`
- `testCourierConnection`-এর enum-এ তিনটি নতুন key যোগ
- Test handler: existing generic reachability ping কাজ করবে; `credentials` map থেকে relevant auth header populate করার জন্য একটি ছোট adapter map যোগ করা হবে (provider-key → header builder function), যাতে ভবিষ্যতে সহজে extend করা যায়

### ৪. UI — Dynamic credential form
File: `src/components/admin/couriers/CourierCard.tsx`
- Credentials accordion-এ hardcoded `api_key`/`secret`/`base_url` fields-এর বদলে `meta.credentialFields` দিয়ে dynamically render (existing 4 couriers-এর জন্য default spec ব্যবহার করে backward compatible)
- Password-type fields-এ Show/Hide toggle (existing pattern)
- Value read/write হবে `cfg.credentials[key]` থেকে (backward compat: legacy `api_key`/`secret`/`base_url` থাকলে সেগুলোও দেখাবে)
- Webhook accordion (নতুন): শুধু `meta.supportsWebhook === true` হলে দেখাবে, callback URL display + verification token field

### ৫. Store Admin page — form state
File: `src/routes/_authenticated/admin/couriers.tsx`
- `defaultForm`-এ তিনটি নতুন key যোগ
- Existing loop `COURIERS.map(...)` automatically পিক করে নেবে নতুন কুরিয়ারদের

### ৬. Winner Admin Courier Brand Assets
কোনো code change নেই — seed migration চলার পর তিনটি নতুন card automatically appear করবে যেখান থেকে logo, wordmark, favicon, brand color upload করা যাবে।

### ৭. Verification
- Preview-এ `/admin/couriers` লোড করে ৭টি card দেখা যাচ্ছে কিনা
- নতুন কুরিয়ারের credentials fields provider-specific কিনা
- Save + Test connection কাজ করছে কিনা
- `/owner/courier-brand-assets`-এ ৭টি card আসছে কিনা

## যা পরিবর্তন হবে না

- বিদ্যমান ৪টি কুরিয়ারের কোনো field/behavior/branding
- Existing shipping/pickup/automation/diagnostics sections
- Central logo management RPC (`get_public_courier_providers`)
- Store panel-এ existing courier data mapping
