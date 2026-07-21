# Fix Messenger Test Tool

## Problem
- Current test tool has one field only; the same value is used as PSID.
- Custom message text can't be sent.
- No way to reuse PSIDs of users who previously messaged the Page.

## Changes

### 1. Server function (`src/lib/ai.functions.ts`)
- Update `sendMessengerTestMessage` inputValidator to accept both fields:
  - `recipient_id`: trimmed string, 3–64 chars, regex `^\d+$` (Messenger PSIDs are numeric).
  - `message`: trimmed string, 1–1000 chars.
- Send to Graph API: `recipient.id = recipient_id`, `message.text = message`.
- Add new server function `listMessengerRecentPsids` (auth + owner-scoped):
  - Query `ai_conversations` where `store_id = owner store` and `channel = 'messenger'`, order by `updated_at` (or `created_at`) desc, limit 20.
  - Return `[{ psid: external_id, last_message_at }]`.
  - PSIDs are already captured automatically by the existing webhook (`src/routes/api/public/messenger/webhook.ts` inserts an `ai_conversations` row keyed by `external_id = sender.id`), so no webhook change is needed.

### 2. Admin UI (`src/routes/_authenticated/admin/messenger.tsx`)
- Replace the single input with:
  - **Recipient PSID** input (required), placeholder `Enter recipient PSID`, numeric-only validation.
  - **Test Message** textarea, placeholder `Type a message`, required.
  - **Recent conversations** dropdown/select populated from `listMessengerRecentPsids`; selecting fills the PSID field.
- On Send:
  - If PSID empty or non-numeric → toast: `Please enter a valid recipient PSID.`
  - If message empty → toast: `Please enter a message to send.`
  - Otherwise call `sendMessengerTestMessage({ data: { recipient_id, message } })`.
- Refresh the recent-PSID list on page load and after a successful send.

## Out of scope
- No webhook changes (already saves sender PSIDs).
- No schema changes.
