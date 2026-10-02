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

## Merchant Auto Connect visibility (2026-09-30)
- [x] Hide Auto Connect from Merchant Panel Messenger and WhatsApp pages
- [x] Verify both pages still show Manual Connect and deploy to orzen.top
- [x] SEO: sitemap/robots host-aware base (orzen-commerce.lovable.app vs orzen.top) — fixed 2026-10-02, needs Lovable publish to go live
