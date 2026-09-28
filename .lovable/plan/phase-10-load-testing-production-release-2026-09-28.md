# Phase 10: Load Testing & Production Release

## Goal
Prove the WhatsApp and Messenger reply system stays correct and fast with 100+ messages arriving at the same moment, fix whatever breaks, then release the final version to orzen.top.

## Safety rules for the test
- No real customer gets a message: test jobs carry a `dry_run` flag, so the send step is simulated. It takes the same time as a real send and still goes into the timing log, but nothing reaches Meta.
- Uses a separate test conversation per fake customer (for example, 30 fake customers sending 1–5 messages each), all under the owner's own store.
- AI cost is kept small: most messages go through the fast path (thanks/greeting/order status). About 20 messages use the real AI, to measure real AI time and how the Gemini key limits hold up.
- No test orders are created. All test data is deleted at the end.

## Test scenarios
```text
A  Burst:        120 messages from 30 customers within 2 seconds
B  Same person:  5 quick messages from one customer -> expect 1 merged reply
C  Duplicates:   same Meta message id sent 3x -> expect 1 job, 1 reply
D  Ordering:     customer's messages answered in order, never in parallel
E  Recovery:     kill some workers mid-run -> recovery sweep finishes them
F  AI pressure:  20 AI messages at once -> fallback/circuit breaker, no lost replies
G  Stock race:   20 parallel orders for a product with stock 3 -> exactly 3 orders
```

## Pass criteria
- 100% of jobs end as sent / merged / skipped. None stuck, none duplicated.
- Fast-path replies: p95 under 3s after the merge wait. AI replies: p95 under 20s.
- No cross-store data in any reply. Stock never oversold.
- The Message Performance page shows the run correctly.

## Then
- Fix any bottleneck found (for example, worker limits, database indexes, or the per-customer lock). Re-run the failing scenario.
- Final production release with the existing deploy script and live checks, plus a smoke test: real site loads, WhatsApp test reply, Message Performance page opens.
- Deliver a short report in Bengali: results for each scenario, the numbers, what was fixed, and what is still limited (for example, the Meta test number's slow sends).

## Technical details
- Add a `dry_run` flag to the job payload. `sendAndLog` (WhatsApp) and `fbSend` (Messenger) sleep about 300ms and record a fake message id instead of calling Graph. They honour it only when the flag is set AND `message_id` starts with `loadtest_` (can never trigger from real webhooks).
- Load script (`scripts/load-test.ts`, run from the sandbox): inserts jobs straight into `whatsapp_jobs` and Messenger test jobs through the service role, lets the real wake trigger and workers run on orzen.top, then reads back from the database and runs the checks.
- Scenario G calls `create_chat_order` in parallel on a temporary draft product.
- Cleanup: delete `loadtest_%` jobs, test conversations, test orders and the product. Record results in `roadmap.md`.
