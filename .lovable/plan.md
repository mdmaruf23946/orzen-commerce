# Facebook comments: auto-reply, auto-moderation, Messenger hand-off

## What is actually wrong (verified)

1. **Comment events never reach the Facebook Page code.** Facebook sends every event for the Page — messages *and* comments — to one single callback address, which is the Messenger callback. That handler only understands message events: it forwards message events to the merchant Messenger handler and silently answers "ok" to everything else. Comment events are dropped there and never reach `/api/public/facebook/webhook`, so nothing is stored, nothing is answered.
2. **Even when comments are pulled in manually, nothing answers them.** The comment webhook only saves the comment row. There is no AI analysis, no reply, no hand-off.
3. **The automation switches do nothing.** "Auto reply to safe comments", "Auto hide spam" and "Suggest Messenger hand-off" are saved in settings but no code ever reads them (verified by search — only the settings screen touches them).
4. **Negative-comment deletion is approval-only today.** The AI queues a proposal in Moderation; nothing deletes automatically.
5. **Permission reality:** deleting/hiding/replying to comments needs the Page token to allow comment management. The currently connected token reported only messaging permissions. The code will now report this clearly instead of failing silently, but if the token truly lacks it, the token must be regenerated once with the comment permissions and reconnected from Messenger.

## What will be built

### A. Comment events get delivered
- The Messenger callback becomes a proper dispatcher: message events keep their current path; comment/feed events are forwarded, with the original signed body intact, to the Facebook Page handler.
- The Facebook Page handler accepts forwarded events, re-verifies the signature against that Page's own app secret, and stays strictly scoped to the one store that owns the Page ID.
- Connecting from Messenger also makes sure the Page is subscribed to comment events, and the connection screen reports it if Facebook refuses because of a missing permission.

### B. A comment gets an answer automatically
When a new customer comment arrives (the Page's own replies are ignored):
1. It is saved as today.
2. The AI classifies it (question / order intent / praise / spam / abusive / other) and drafts a reply in the store's language and tone.
3. Depending on the store's settings:
   - **Auto mode on:** a safe reply is posted publicly under the comment right away and the comment is marked answered.
   - **Auto mode off:** the draft goes to Moderation for approval, exactly as today.
4. If "Suggest Messenger hand-off" is on, the commenter also gets a private Messenger message from the Page, which brings that person into the Messenger inbox as a conversation the merchant can continue. (Facebook allows one private reply per comment.)

### C. Negative comments get removed automatically
- Abusive/offensive comments: deleted automatically when auto-moderation is on; otherwise queued for approval.
- Spam comments: hidden automatically when "Auto hide spam" is on.
- Repeat offenders are proposed for blocking — blocking always stays a human decision.
- Every automatic action is written to the Moderation list with its reason, so the merchant can see what the AI did.

### D. Settings screen
The existing Facebook AI settings card gets clear, working switches: auto-reply, auto-delete abusive, auto-hide spam, Messenger hand-off, plus the deny-keyword list (a comment containing a deny keyword is treated as spam without asking the AI). Nothing else on the page changes.

## Technical notes

- `src/routes/api/public/ai-admin/messenger-webhook.ts`: dispatch on `entry[].changes` (field `feed`) to `/api/public/facebook/webhook` preserving `x-hub-signature-256` and the raw body; existing `messaging` routing untouched.
- `src/routes/api/public/facebook/webhook.ts`: after upserting a new `add` comment, enqueue/perform moderation via a new server-only `handleIncomingComment(supabase, storeId, row, token)` in `src/lib/facebook-ai.server.ts`, reusing `analyzeComments` logic for a single comment; acknowledge Facebook first, do the AI work after the row is stored (keep the handler fast, guard with a per-comment lock on `comment_id` so retries don't double-reply).
- New auto-execution path shares the Graph calls already used by `decideFacebookModeration` (reply / hide / delete / private reply) and writes the resulting state into `facebook_comments` and `facebook_moderation_queue` with `status: 'approved'` + `decided_by: 'ai'`.
- Private reply uses the existing `POST /{page_id}/messages` with `recipient: {comment_id}` so the commenter appears in the Messenger inbox.
- Capability failures are translated with `explainGraphError` and stored on the queue row instead of throwing.
- `facebook_ai_settings` gains `auto_delete_abusive boolean default false` (migration); existing columns are finally read.
- Strict tenant scoping: store is always resolved from the signed Page ID, every write filtered by `store_id`.

## Verification

- Post a comment on a live Page post and confirm: the row appears, a public reply is posted, and the commenter shows up in the Messenger inbox.
- Post an abusive test comment and confirm it is deleted (or queued when auto-moderation is off) with the reason logged.
- Confirm Messenger message replies still work unchanged.
- Confirm a comment from another store's Page cannot touch this store's data.
