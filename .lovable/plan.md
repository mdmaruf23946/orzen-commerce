# Phase 9: Telemetry & Observability

## Goal
Every WhatsApp and Messenger message records where its time went — Queue, DB, AI, Send — and the Winner Admin panel shows it on one page, so a slow reply's cause is visible immediately.

## What the owner will see (new page: Owner → Message Performance)
- Cards (last 24h / 7d): total messages, average and p95 reply time, % replied under 10s, failed count.
- Stacked bar per message type: Queue / DB / AI / Send breakdown (average).
- "Slowest messages" table: time, store, channel, route (fast / ai / photo), total ms, each stage ms, AI model used, error if any. Click a row to see the full stage timeline.
- Filters: channel, store, route, date range. Auto-refresh every 30s.
- A red hint on each slow row naming the biggest stage (e.g. "AI took 82% of the time").

## Stages measured
```text
webhook received -> job created -> worker claimed   = Queue ms (incl. debounce wait)
context/memory/product lookups                       = DB ms
AI model call(s) incl. fallback + tool steps          = AI ms  (+ model id, steps, tokens)
reply guard + sanitize                                = Guard ms
Meta send API                                         = Send ms
total = received -> sent
```

## Technical details
- Migration (prod + dev): add `timings jsonb`, `received_at timestamptz`, `trace_id uuid` to `whatsapp_jobs` and `messenger_jobs` (existing `processing_ms` kept). Index on `(created_at desc)` and `(store_id, created_at desc)`. No new tables; RLS unchanged (owner reads via server function with admin client after role check).
- New `src/lib/telemetry.server.ts`: tiny `createTrace()` with `mark(stage)` / `time(stage, fn)` / `toJSON()`; zero dependencies, never throws (telemetry failure never blocks a reply).
- Wire into `whatsapp-webhook.server.ts` (processWhatsAppJob, fast path, photo path), `whatsapp/process.ts`, `messenger/process.ts` + messenger reply path; `generateAgentReply` returns ai ms, model id, step count, tokens. Written into `timings` in the same update that sets `status`.
- New server fn `ownerMessagePerformance` in `src/lib/owner.functions.ts` (owner role check): aggregates last N days from both job tables (avg/p95 per stage, slowest 50).
- New route `src/routes/_authenticated/owner/message-performance.tsx` + sidebar link; same style as AI Usage page.
- Record rule in `AGENTS.md`. Deploy with `scripts/deploy-production.sh` + parity check.

## Verification
- Send test jobs on WhatsApp (text, thanks fast path, photo) and confirm each row has all stages and totals match `processing_ms`.
- Open the new page signed in as owner and confirm numbers appear.

## Not included
- No external monitoring service or alerts (can be added in Phase 10).
- Website chat not traced in this phase.
