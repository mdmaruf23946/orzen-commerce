## সমস্যা

Winner Panel-এ **Platform → Courier Brand Assets** পেইজটি আগে থেকেই আছে যেখানে courier logo, dark logo, favicon, brand color, links সব upload/edit করা যায়। কিন্তু `courier_providers` টেবিলে কোনো row নেই — তাই পেইজটি খালি দেখাচ্ছে এবং Store Admin-এর Courier Integration কার্ডে (SteadFast, Pathao, RedX, Paperfly) logo না বসে শুধু initials (S, PC, R, P) দেখা যাচ্ছে।

Store Admin ইতোমধ্যে `get_public_courier_providers()` RPC থেকে `code → logo_url` map করে logo দেখায়। শুধু DB-তে rows দরকার।

## সমাধান

চারটি built-in courier (steadfast, pathao, redx, paperfly)-কে `courier_providers` টেবিলে seed করব — এদের official brand color, tagline, sort order সহ। তারপর Winner Panel → **Platform → Courier Brand Assets** পেইজে গেলে চারটি কার্ড দেখা যাবে, যেখান থেকে প্রতিটির জন্য logo, dark logo, favicon, links আপলোড করা যাবে। Save করার সাথে সাথেই সব Store Admin panel-এ automatically sync হয়ে যাবে।

## প্রযুক্তিগত ধাপ

1. **Database migration** — `courier_providers`-এ ৪টি row insert:
   - steadfast · SteadFast · `#0E9F6E` · "Nationwide COD courier"
   - pathao · Pathao Courier · `#E8541C` · "Urban express & COD"
   - redx · RedX · `#E11D48` · "Fast delivery across BD"
   - paperfly · Paperfly · `#1E3A8A` · "Nationwide logistics"
   - `is_active = true`, `sort_order = 10/20/30/40`, `logo_url = null` (owner পরে upload করবে)
   - `ON CONFLICT (code) DO NOTHING` যাতে re-run safe হয়।

2. **কোনো UI/কোড পরিবর্তন নেই** — owner page, upload flow, public RPC, store admin mapping সবই আগে থেকেই কাজ করছে।

## ব্যবহার

Migration approve করার পর: Winner Panel → Platform → **Courier Brand Assets** → প্রতিটি courier-এর "Primary logo" এ upload → Save. Store Admin-এর Courier Integration পেইজে সাথে সাথে logo দেখা যাবে।
