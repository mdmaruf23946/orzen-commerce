# Fix Messenger replies that arrive minutes late or never arrive

## What is confirmed

- The connected Merchant Page is set to **Fastest** with **0 seconds** delay; the delay control is not causing this problem.
- Live requests are timing out with **524** while the webhook waits for the complete AI response. Facebook then retries later, which explains replies arriving after one to three minutes.
- Some attempts are acknowledged even after processing fails, so Facebook does not retry and the customer receives no reply.
- Duplicate detection currently marks the incoming message before a reply is safely completed. If the first attempt stops midway, later retries skip that message permanently.
- The tested Facebook profile is stored as a Merchant identity but is still **Pending / unverified**. For security it is therefore handled as a customer, so statements like “I am the owner” cannot unlock business data and do not become Merchant instructions.

## Implementation

### 1. Acknowledge Facebook immediately

- Keep signature and Page ownership checks first.
- Store each incoming event atomically, then return success to Facebook immediately instead of keeping its request open during database, AI, and Facebook-send work.
- Stop the shared Winner Admin callback from waiting for the Merchant AI pipeline to finish.

### 2. Add a durable Messenger job queue

- Add a tenant-scoped queue keyed by the Facebook message ID, with `pending`, `processing`, `sent`, `retry`, and `failed` states.
- Process messages independently after acknowledgement, preserving their order per conversation.
- Use atomic claiming so duplicate Facebook deliveries cannot create duplicate AI replies.
- Retry temporary AI, database, and Facebook delivery failures with bounded backoff; never silently discard them.
- Recover jobs left in `processing` after an interrupted run.
- Keep the incoming message, generated answer, attempt count, timing, and final delivery result visible for diagnostics without storing credentials.

### 3. Make the fast path genuinely fast

- For **Fastest**, send the typing indicator immediately and use the shortest useful history/context.
- Add a deterministic instant response for greetings and simple acknowledgements, avoiding an AI call when no store lookup is needed.
- For requests needing AI or business data, process immediately with no artificial wait and cap unnecessary agent/tool loops.
- Keep `Balanced` and `Thorough` behavior, but move all configured waiting outside Facebook’s webhook request.
- Do not add artificial timeouts to AI generation; streaming/background processing will prevent request timeout and duplicate billing.

### 4. Guarantee a visible outcome

- If generation fails permanently, send a language-matched Bengali/English fallback instead of silence.
- If Facebook delivery fails temporarily, retry it; if it becomes terminal, record the exact reason in Messenger diagnostics.
- Record one final outbound result per inbound message so every message is either answered or clearly marked failed.

### 5. Preserve Merchant memory securely

- Keep merchant commands available only to a server-verified identity; never trust “I am the owner” in message text.
- When a configured but unverified Merchant profile messages the Page, respond with a clear verification instruction instead of silently treating owner requests as customer requests.
- Once verified, route that profile to the Merchant Master Agent and retain its ordered conversation history so follow-up instructions are not forgotten.
- Keep ordinary customers on the public Customer Agent with strict tenant isolation.

### 6. Merchant Panel controls and diagnostics

- Keep the existing speed and delay controls.
- Add queue health, last received time, processing duration, retry count, and delivery result to the existing Messenger diagnostics area.
- Show the Merchant identity’s Pending/Verified state and a direct action to complete verification.

## Verification

- Publish the fix, then send real messages to **A9N Ai** from the affected profile.
- Confirm Facebook receives its webhook acknowledgement in under one second.
- Confirm greetings receive an immediate response and normal AI replies begin as quickly as the provider allows; no 524 timeout occurs.
- Confirm a deliberately interrupted job resumes and sends exactly one reply.
- Confirm duplicate Facebook deliveries do not duplicate answers.
- Confirm temporary AI/Facebook failures retry and permanent failures send/record a fallback.
- Verify the profile before testing private order/revenue questions, then confirm follow-up context is retained and no other Merchant’s data is accessible.

## Important expectation

A fixed one-second AI answer cannot be guaranteed because model and Facebook delivery time are external. The system will guarantee immediate webhook acceptance, remove the current one-to-three-minute retry delay, answer simple messages instantly, and ensure every accepted message reaches a durable final state instead of being forgotten.
