# Store Notification Settings — Professional Multi-Channel System

Rebuild the Store Admin "Notification Settings" page into a three-channel management system (WhatsApp, Email, SMS), each with its own configuration, event selection, status indicator, Save and Test actions. Everything is scoped to the signed-in admin's own store.

## Page layout

Same clean settings style, one page, three stacked channel cards:

```text
Notification Settings
┌────────────────────────────────────────┐
│ WhatsApp            [Connected] [ on ] │
│ Number, provider (WhatsApp Cloud API), │
│ Phone Number ID, Access Token          │
│ Events: [x] New order  [ ] Payment ... │
│                 [Send test] [Save]     │
└────────────────────────────────────────┘
┌ Email  ... ┐   ┌ SMS  ... ┐
```

Status badge per channel: **Connected** (enabled + credentials valid on last test), **Not configured** (enabled but missing fields), **Disabled**, **Error** (last test/send failed, with the error message shown).

## Channels

**WhatsApp** — enable toggle, admin WhatsApp number, Meta WhatsApp Cloud API config (Phone Number ID, Access Token, optional template name), test button, event checkboxes.

**Email** — enable toggle, admin notification email, provider choice: *Platform email* (default, uses the existing platform queue, no setup) or *Resend* (API key + verified from-address), test button, event checkboxes.

**SMS** — enable toggle, provider BulkSMSBD (API key, Sender ID), admin mobile number, test button, event checkboxes.

## Notification events

Only events the site already produces:

- New order
- Order confirmation
- Order status update
- Cancellation
- Return / Exchange update
- Payment update
- Courier / shipping update

Each event row has two checkboxes: **Notify admin** and **Notify customer**. Customer messages use the order's phone (WhatsApp/SMS) and email; admin messages go to the channel's configured admin number/email.

## Technical notes

- **Storage**: keep the existing `stores.notifications` jsonb column, upgraded to a versioned shape `{ version: 2, whatsapp: {...}, email: {...}, sms: {...} }` where each channel holds `{ enabled, provider, config, events: { new_order: {admin, customer}, ... }, status: { state, last_error, last_tested_at } }`. Legacy `{ whatsapp, email_enabled }` values are migrated on first read. No schema migration needed.
- **Secrets**: access tokens and API keys are encrypted with the existing `src/lib/crypto/credentials.server.ts` helpers before storing, and never returned to the browser — the UI shows a masked "configured" state and only sends a new value when the field is edited.
- **Server functions** in a new `src/lib/notify-settings.functions.ts`: `getNotificationSettings` (redacted), `saveNotificationChannel({ channel, ... })` — per-channel save, and `testNotificationChannel({ channel })` — sends one real test message and records `status`.
- **Dispatcher** `src/lib/notify-dispatch.server.ts`: `dispatchNotification({ storeId, event, order/return/payment context })` loads the store settings, filters by enabled channel + event + audience, renders the message, and sends. Providers live in `src/lib/notify/whatsapp.server.ts`, `email.server.ts` (platform queue via `enqueue_email`, or Resend HTTP), `sms.server.ts` (BulkSMSBD HTTP).
- **Event wiring**: call the dispatcher from the existing sources — order create (`orders-confirm.server.ts`, `quick-order.server.ts`), order status change / courier updates (`messenger-notify.server.ts` outbox drain), returns (`returns-notify.server.ts`), and payment updates (store payment webhook handler). Existing Messenger behaviour is left untouched; the dispatcher runs alongside it, best-effort, and never blocks or rolls back the originating action.
- **UI**: `src/routes/_authenticated/admin/notifications.tsx` rewritten off the generic `SettingsPage` wrapper into three `ChannelCard` components under `src/components/admin/notifications/` (`WhatsappCard.tsx`, `EmailCard.tsx`, `SmsCard.tsx`, `EventMatrix.tsx`, `StatusBadge.tsx`), mobile-responsive, each with its own dirty state, Save and Test.
- All reads/writes go through `requireSupabaseAuth` and resolve the caller's own store, so one admin can never touch another store's notification config.
