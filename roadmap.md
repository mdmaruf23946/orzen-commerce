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
