
# Per-Store Custom Domain / Subdomain সংযোগের সম্পূর্ণ পরিকল্পনা

লক্ষ্য: যেকোনো registrar (GoDaddy, Namecheap, Cloudflare, Hostinger, ইত্যাদি) থেকে কেনা ডোমেইন বা সাবডোমেইন একজন store owner তার নিজের store এ যুক্ত করতে পারবে, DNS verify হবে, SSL issue হবে, এবং সেই ডোমেইনে store টি খুলবে।

## বর্তমানে কী আছে (কোডে)
- `store_domains` টেবিল — hostname, status, verification_token, dns_target, ssl_status, is_primary
- `resolve_domain(host)` DB function — host থেকে store খুঁজে দেয়
- Admin `/admin/domains` — owner add/verify/primary করতে পারে
- Owner `/owner/domains` — global list ও SSL activate
- `store/$slug` routing — subdomain থেকে slug extract হয়
- `custom_domain` feature flag — plan-gated

অর্থাৎ **application layer মোটামুটি প্রস্তুত**। যেটা বাকি সেটা মূলত **platform/infrastructure layer** এবং কিছু **automation gap**।

---

## ১. Platform (Lovable) দিকের প্রয়োজনীয়তা

এটা সবচেয়ে গুরুত্বপূর্ণ — কোড দিয়ে সমাধান হবে না, Lovable Project Settings-এ সেটআপ লাগবে:

1. **Wildcard subdomain connect** — `*.orzen.top` কে Lovable Project Settings → Domains এ যুক্ত করা (Paid plan লাগবে)। এটা ছাড়া `<slug>.orzen.top` কাজ করবে না।
2. **Custom domain per store** — প্রতিটি store owner তার নিজের ডোমেইন (যেমন `shop.example.com` বা `mystore.com`) Lovable এ যুক্ত করার আগে সেটা প্ল্যাটফর্মকেও চিনতে হবে। দুইটা পথ:
   - **(a) Manual**: প্রতিটি custom domain owner নিজে Lovable Project Settings এ add করবে না — Platform owner (আপনি) কে যোগ করতে হবে, অথবা
   - **(b) API-based**: Lovable এর domain API (যদি available থাকে) দিয়ে server function থেকে auto-add। বর্তমানে Lovable এ public domain-management API নেই, তাই এই মুহূর্তে **manual approval workflow** ই বাস্তব সমাধান।
3. **SSL** — Lovable auto-provision করে Let's Encrypt দিয়ে, যখন DNS ঠিক থাকে।

## ২. DNS দিকের প্রয়োজনীয়তা (End user / store owner এর কাজ)

Store owner কে তার registrar এ যা করতে হবে:

- **Root domain (example.com)**: `A` record → `185.158.133.1`
- **Subdomain (shop.example.com)**: `CNAME` → `stores.orzen.top` (বা `A` → `185.158.133.1`)
- **Ownership verify**: `TXT` record → `_orzen-verify.<hostname>` → `verification_token`
- Cloudflare হলে proxy DNS-only mode (grey cloud) প্রথমে

এগুলো `/admin/domains` UI তে already দেখানো হয়। শুধু copy-paste করে বসাবে।

## ৩. Application code side এ যা যোগ/উন্নত করতে হবে

আপনার প্রশ্নের ভিত্তিতে বর্তমান কোডে যা **নেই বা দুর্বল**:

### (ক) Real DNS verification
এখন `checkDomainVerification` সম্ভবত শুধু status flip করে। প্রয়োজন:
- Server function থেকে সত্যিকারের DNS lookup (Node `dns` module — Workers এ available)
- TXT record মিলিয়ে verify → status = `verified`
- A/CNAME record মিলিয়ে check → SSL trigger

### (খ) Host-based routing entry point
`src/routes/store/$slug/*` ছাড়াও একটা middleware/root-level resolver লাগবে যেটা:
- Request এর `Host` header পড়বে
- যদি host `<slug>.orzen.top` হয় → slug extract → store render
- যদি host custom domain হয় → `resolve_domain(host)` দিয়ে store খুঁজে render
- অর্থাৎ URL এ `/store/<slug>` না থাকলেও ডোমেইন দিয়ে সরাসরি store খুলবে

এটা `__root.tsx` অথবা একটা catch-all route এ SSR context থেকে host পড়ে করতে হবে।

### (গ) Primary domain redirect
Primary domain সেট থাকলে অন্য hostname থেকে requests গুলো 301 redirect হবে primary তে।

### (ঘ) Owner approval queue
Store owner add করার পর platform owner (আপনি) কে notify করে একটা approval step — এরপর আপনি Lovable Settings এ সেই domain manually যোগ করবেন। Status: `pending_platform_approval` → `active`।

### (ঙ) Automated recheck cron
`pg_cron` বা `/api/public/cron/recheck-domains` — প্রতি ঘণ্টায় pending domains এর DNS retry করবে।

### (চ) Plan gating enforcement
`custom_domain` feature flag এখন UI তে দেখা যায়, কিন্তু server function এও enforce করতে হবে (`addCustomDomain` এ)।

---

## Deliverables (build mode এ যা তৈরি হবে)

1. `src/lib/dns.server.ts` — real DNS lookup (`dns.promises.resolveTxt`, `resolveCname`, `resolve4`)
2. `checkDomainVerification` upgrade — actual TXT/A/CNAME check, status transition
3. Host-based store resolver — `__root.tsx` এ `useServerFn` দিয়ে host → store lookup, mismatch হলে redirect
4. Primary domain redirect logic
5. `addCustomDomain` এ server-side plan gate + owner approval status
6. Owner `/owner/domains` এ pending approval queue + "Mark Lovable-connected" button
7. `/api/public/cron/recheck-domains` route + pg_cron schedule
8. Store owner UI তে clear DNS instruction (already ভালো, শুধু "waiting for platform approval" state যোগ)
9. Documentation card / help text: "Buy domain → point DNS → verify → notify platform owner → live"

## Technical details

- DNS lookup Cloudflare Worker runtime এ `node:dns` supported (nodejs_compat)
- Host detection: TanStack SSR এ `request.headers.get('host')` from server function context
- Redirect: `throw redirect({ to, statusCode: 301 })` in loader
- pg_cron trigger: `select cron.schedule(...)` migration যা internal secret দিয়ে `/api/public/cron/*` কে হিট করবে

## Out of scope (এই plan এ নেই)

- Lovable এ auto domain-add API (public API নেই)
- Domain reseller/purchase flow within your app (আলাদা বড় feature)
- Email (MX/SPF/DKIM) সেটআপ per store

## সংক্ষেপে উত্তর

**হ্যাঁ, সম্ভব।** আপনার কোড ~৭০% প্রস্তুত। বাকি ৩০% =
- (Infra) Lovable এ wildcard `*.orzen.top` connect + প্রতিটি custom domain manually connect
- (Code) real DNS check, host-based routing, approval queue, cron recheck, primary redirect, server-side plan gate

Approve করলে build mode এ উপরের ৯টা deliverable একে একে implement করা হবে।
