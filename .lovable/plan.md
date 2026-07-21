## Messenger Inbox for AI Sales Agent

Build a full inbox on top of the existing `messenger_integrations` + `ai_conversations` + `ai_messages` tables and the existing webhook at `src/routes/api/public/messenger/webhook.ts`. Delivered in phases so each ships working.

### Phase 1 — Database extensions (one migration)

Extend existing tables (no rename), add supporting tables:

- `ai_conversations`: add `psid_profile jsonb` (name, profile_pic, locale, timezone, last_seen), `unread_count int default 0`, `last_message_at timestamptz`, `last_message_preview text`, `handoff_mode text default 'ai'` (ai|human), `tags text[] default '{}'`, `lead_status text` (interested|pending|ready|ordered|cancelled|null), `total_orders int default 0`, `total_spent numeric default 0`, `first_contact_at timestamptz default now()`.
- `ai_messages`: add `direction text` (in|out), `message_type text default 'text'` (text|image|video|audio|file|sticker|template|quick_reply|postback), `attachments jsonb default '[]'`, `mid text` (Facebook message id, unique per conv), `delivery_status text default 'sent'` (sent|delivered|read|failed), `error text`, `sent_by_user_id uuid`.
- New `customer_notes_messenger` (or reuse `customer_notes` scoped by conversation) — one table keyed by conversation.
- New `saved_replies` (store_id, title, body, sort).
- Enable Realtime: `alter publication supabase_realtime add table ai_conversations, ai_messages;`
- Add RLS write policies for owners on `ai_conversations` (update unread/handoff/tags/notes) and `ai_messages` (insert outgoing manual replies via server fn only). Keep existing SELECT policies.
- Add `GRANT`s per project rules.

### Phase 2 — Webhook expansion (`src/routes/api/public/messenger/webhook.ts`)

Handle all required events; keep signature/verify flow intact:

- `messages`: text, attachments (image/video/audio/file), stickers, quick_reply payloads. Store with `direction='in'`, correct `message_type`, `attachments`, `mid`. Update conv `last_message_*`, increment `unread_count`. Fetch sender profile via Graph `/{psid}?fields=first_name,last_name,profile_pic` (cached in `psid_profile`).
- `message_deliveries`, `message_reads`: update `delivery_status` on matching outgoing rows by `mid` / watermark.
- `messaging_postbacks`: store as message row (`message_type='postback'`).
- `messaging_optins`, `messaging_referrals`: log as system rows.
- `standby`: log only, no auto-reply.
- AI auto-reply gate: run only when `handoff_mode='ai'` AND `messenger_integrations.ai_auto_reply=true` AND event type is `messages` (not standby).
- On send failure: bump `delivery_failures`, write `ai_messages` row with `delivery_status='failed'`, `error=...` for retry UI.

### Phase 3 — Server functions (`src/lib/messenger-inbox.functions.ts`)

Owner-scoped via `requireSupabaseAuth`:

- `listConversations({ filter, search, cursor })` — filter: all|unread|ai|human|orders.
- `getConversation(id)` — conv + integration + profile + counts.
- `listMessages(conversationId, cursor)` — paginated newest-last.
- `markRead(conversationId)` — zero unread + optional Graph `sender_action=mark_seen`.
- `setHandoffMode(conversationId, mode)`.
- `setTags(conversationId, tags)` / `setLeadStatus(conversationId, status)`.
- `saveNote(conversationId, body)` / `listNotes`.
- `sendManualMessage({ conversationId, text?, attachmentUrl?, attachmentType?, quickReplies?, productId?, orderId? })` — resolves PSID + page token, calls Graph `me/messages` with `recipient.id=PSID`, persists row, updates delivery status.
- `retryFailedMessage(messageId)`.
- `listSavedReplies` / `upsertSavedReply` / `deleteSavedReply`.
- `getInboxStats()` — totals, unread, today, ai_replied, human_replied, failed.
- `listCustomerOrders(conversationId)` — orders matched by PSID/phone/email if linked.

Media uploads for manual reply reuse existing `store-assets` bucket; then send by URL to Graph.

### Phase 4 — UI

New sidebar entry "Messenger Inbox" in `src/routes/_authenticated/admin/route.tsx` (icon: Inbox), placed above "Notifications".

Route `src/routes/_authenticated/admin/messenger-inbox.tsx` — 3-pane responsive layout:

- **Left**: search + filter chips (Unread / All / AI / Human / Orders); conversation list cards (avatar, name, PSID, last preview, time, unread badge, AI/Human pill). Subscribe to Realtime on `ai_conversations` for the store; play notification sound + increment unread on new inbound.
- **Center**: chat pane. Header with avatar/name/PSID/first-contact + AI ↔ HUMAN switch. Message bubbles rendering text, image, video, audio (`<audio controls>`), file link, sticker, quick_reply. Composer: text, emoji picker (existing lib or `emoji-mart`), attach image/file, quick reply buttons builder, "Send product card" (product picker → templated card), "Send order status" (order picker), saved-replies dropdown. Failed messages show retry button + error.
- **Right (desktop) / drawer (mobile)**: customer profile — avatar, name, PSID, first contact, last active, totals (messages, orders, spending), tags editor, lead status selector, notes list + add note, order history list.

Mobile: single-pane with back button navigation; list ↔ chat ↔ profile.

### Phase 5 — Dashboard tile

Extend admin dashboard `src/routes/_authenticated/admin/index.tsx` with an "Inbox" card: totals, unread, today, AI replied, human replied, failed (from `getInboxStats`).

### Live updates

Use Supabase Realtime channels (`postgres_changes` on `ai_conversations` and `ai_messages` filtered by store_id / conversation_id) inside `useEffect` with proper `removeChannel` cleanup. Small audio file in `src/assets/notify.mp3` for inbound sound.

### Out of scope for this plan

- Instagram DM (Messenger only).
- Full CRM merging PSID ↔ store_customer (we surface totals when a phone/email match exists, but don't auto-create customer accounts).
- Rich templated buttons beyond product/order card and quick_replies.

### Suggested build order

1. Migration + webhook expansion (Phases 1–2).
2. Server functions + list/chat UI text-only (Phases 3–4 core).
3. Attachments, product/order cards, quick replies, saved replies.
4. Profile pane, notes, tags, lead status.
5. Dashboard tile + failed-message retry polish.
