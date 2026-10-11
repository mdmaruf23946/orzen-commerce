# Roadmap

- [x] Add secure short-lived chat checkout session storage and access policies
- [x] Add public checkout page and secure submit endpoint
- [x] Reuse existing order creation and configured payment checkout/webhooks
- [x] Change Messenger and WhatsApp Buy Now actions to secure checkout URLs
- [x] Send policy-compliant order/payment confirmations
- [x] Verify build, live checkout rendering, and production deployment

## Phase 10 load test (2026-09-28)
- [x] 125 simultaneous WhatsApp jobs, 30 customers; duplicates ignored; per-customer merge; fast path p95 ~4.3s; stock race 20 orders/3 stock -> exactly 3.
- [x] Fixes: "ok thank you" fast path; AI call budget 25s + 45s job cap (no more workers killed mid-run).
- [ ] BLOCKED (owner): AI keys exhausted under load — Gemini Key 2 hits 429/503, OpenRouter "5.1" key's model returns 404. Needs a working AI key/model.
- [ ] Messenger not load-tested (jobs need Meta-signed payloads).

## Sales Agent Phase 5 — E2E verification (2026-09-28) — done
- Live-DB tests 19/19 after fix: fast-path (5), photo search 3/3 + unrelated rejected, size guard, price/policy guard, order + duplicate + no-oversell, cleanup, AI fallback 6/6.
- Fixed: empty AI answer from a busy key now skips to the next key; Messenger test-mode (loadtest_) never sends to Meta.
- Deployed version 79a36b42; parity passed; site/stores 200; webhooks reject wrong token (403).
- Open: real Meta delivery needs the owner to send a live message; return policy unset in merchant panel.

## Chat understanding fix (2026-09-28)
- [x] Never save questions/greetings as name/address (Messenger parser, AI tool, WhatsApp, stored slots)
- [x] Typo-tolerant fast path ("ডেলিভারি সার্চ কত")
- [x] AI "understand" step + confirm question when unsure
- [x] Delivery charge answered after address
- [x] Collapse "? ?" in replies
- [x] Order Details total shows delivery twice
- [x] Keep failed-attempt errors to diagnose slow replies
- [x] Test (5/5 live test-mode), deploy e6d5aec7, parity passed

## Main website Meta Pixel + CAPI (2026-09-28)
- [x] Tables, admin page, pixel, CAPI, consent, payment hooks
- [x] Verify, deploy
- [ ] Live Meta check (needs Pixel ID + CAPI token from user)

## Marketing platform workspaces (2026-10-06)
- [x] Consolidate Facebook, Google and TikTok technical controls into Integration only
- [x] Add honest store performance Overview with period comparison
- [x] Keep landing-page tracking platform-isolated and remove duplicated Main Store setup
- [x] Reduce connected platform menus to Overview and Integration
- [x] Verify preview build and authenticated navigation; full content preview is blocked by the test account's expired plan

## Merchant Auto Connect visibility (2026-09-30)
- [x] Hide Auto Connect from Merchant Panel Messenger and WhatsApp pages
- [x] Verify both pages still show Manual Connect and deploy to orzen.top
- [x] SEO: sitemap/robots host-aware base (orzen-commerce.lovable.app vs orzen.top) — fixed 2026-10-02, needs Lovable publish to go live

- [ ] Reconnect Google Search Console in new workspace (2026-10-03)
- [x] Replace Merchant AI Call Center's legacy Device/Manual provider setup with the store-scoped ePBX connection (2026-10-03)
- [x] Deploy the ePBX-only provider UI and customer-call path to orzen.top
- [x] Complete ePBX callbacks, automatic order calls, and recordings
- [x] ePBX: provider overview, numbers, extensions, dial pad, CDR call log + recordings, automated order calls, IVR/WebRTC marked not available

## TikTok logo (2026-10-06)
- [x] Replace TikTok icon with the merchant-uploaded logo
- [x] Verify logo and deploy to orzen.top

## Marketing Overview and refreshed TikTok logo release (2026-10-06)
- [x] Use the latest uploaded logo with tight framing and verify its displayed size
- [x] Apply attributed marketing schema to production without changing existing data
- [x] Deploy platform-specific Overview and logo to orzen.top and verify

## Profile and sidebar footer release (2026-10-07)
- [x] Apply existing account-avatar upload policies to production
- [x] Deploy Profile page and account sidebar footer to orzen.top
- [x] Verify live page responses and signed-out protection; authenticated preview shows Profile and footer links (live authenticated session unavailable)

## Package feature grouping release (2026-10-10)
- [x] Merchant Panel plan cards show the grouped feature list (max 16), nothing hidden
- [x] Winner Admin /owner/packages uses the same grouped toggles; create/edit/delete stays dynamic
- [x] Guarded wrangler deployment to orzen.top; identity + parity checks passed; public routes 200

## AI credit-saver release (2026-10-11)
- [x] Test Chat hard-caps the answer (300 tokens) and keeps only the last few turns
- [x] Chat replies get a default output cap (1024) and temperature capped at 1.0
- [x] Guarded wrangler deployment (version c0e5c998) to orzen.top; identity + parity checks passed; home/login 200, health ok

## AI language-mirroring + short-reply release (2026-10-11)
- [x] One reply-style detector drives every AI channel: Bangla script -> Bangla, Banglish -> Banglish, English -> English
- [x] Long/English answers fixed on Winner Admin Messenger and merchant Messenger/WhatsApp/Webchat; replies capped at 1-3 short sentences
- [x] Guarded wrangler deployment (version bb4c0c9e) to orzen.top; identity + parity checks passed; home/login 200, health ok
- [x] Live chat verified in all three styles (Banglish, Bangla script, English)
