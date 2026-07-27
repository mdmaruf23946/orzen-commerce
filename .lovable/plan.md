## Goal

Add a professional **Communication** section to the Winner Admin Panel that lets the Platform Owner connect their personal Gmail (via Google OAuth), send emails through that Gmail to Store Admins, and deliver in-app notifications — extending the existing Notification Center (no duplicate tables, no parallel module).

## Approach at a glance

- **Gmail** = Lovable's built-in `google_mail` App connector. Lovable handles OAuth, tokens, refresh, and encryption. Owner clicks "Connect with Google" → picks account → done. No manual Google Cloud setup, no Client ID/Secret handling, no token storage in our DB.
- **Sending** = Gmail API (`users/me/messages/send`) through the Lovable connector gateway, one request per recipient (privacy: no shared To field). Runs in the existing pgmq queue infrastructure.
- **UI** = new routes under `/_authenticated/owner/communication/*`, reusing existing shadcn primitives, dark mode, sidebar branding.
- **DB** = extend existing `notification_campaigns` / `notification_recipients` (already has per-recipient status, retries, plan/status targeting). Add small `message_templates` table + a per-owner `gmail_connection_state` row (metadata only — no tokens).

## Menu (Winner Admin sidebar)

New group **Communication**:
- Email & Notifications (dashboard)
- Compose Message
- Email History
- Notification History
- Message Templates
- Gmail Connection

## Screens

### 1. Gmail Connection (`/owner/communication/gmail`)
- Reads status from `standard_connectors--list_connections` (server fn).
- **Disconnected**: "Gmail Not Connected" + `Connect with Google` button → triggers `standard_connectors--connect` flow via a lightweight server-side redirect helper (the connector card handles the OAuth popup).
- **Connected**: shows Gmail address + profile name (fetched once via `gmail/v1/users/me/profile` and cached), connected date, last test time, buttons: `Send Test Email`, `Reconnect`, `Disconnect`.
- **Test**: server fn sends a small email to the connected address via gateway; records `last_tested_at` and result.
- Setup help drawer explains what Lovable is doing under the hood in plain language (no client secret exposure — there isn't one for the owner to manage).

### 2. Compose Message (`/owner/communication/compose`)
Reuses existing `notification-center.compose.tsx` layout, adds:
- Recipient modes: **All / Selected / Single / By Plan / By Status** (plans loaded from `subscription_packages`, not hardcoded).
- Searchable recipient picker (store name, admin name, email, plan, status, checkbox; Select All / Clear All; live count).
- Composer: `From` (read-only, connected Gmail), `Subject`, rich-text body (reuses existing `RichTextEditor`).
- Delivery Options: `☑ Send Email  ☑ Send In-App Notification` (independent — either or both).
- Notification Title + optional separate Notification Message ("Use same as email" toggle).
- Variables: `{{store_name}} {{admin_name}} {{admin_email}} {{plan_name}} {{subscription_end_date}} {{dashboard_url}}` resolved per recipient at send time.
- Load-from-Template dropdown.
- Confirmation dialog with recipient count + preview before send.
- If Email is checked but Gmail is disconnected → modal "Gmail Connection Required" with Connect / Cancel. In-app still sends.

### 3. Email History (`/owner/communication/history/email`)
- Table (desktop) / cards (mobile): Date, Subject, Sender, Recipients, Sent/Failed/Pending, Status.
- Drill-in shows per-recipient status with `Retry Failed` (re-enqueues only `failed` rows).

### 4. Notification History (`/owner/communication/history/notifications`)
- Title, Recipients, Read count, Unread count, Delivery status.

### 5. Message Templates (`/owner/communication/templates`)
- CRUD list; fields: name, subject, body, notification_title, notification_body.
- Seed a few examples (Platform Announcement, Maintenance Notice, Welcome, Payment Reminder).

### 6. Dashboard (`/owner/communication`)
- Summary cards: Gmail Status, Emails Sent (today/month), Notifications (today/month), Failed Emails, Unread Notifications.
- Recent Communication feed.

## Store-Admin side (in-app inbox)

Already exists at `/admin/inbox` + bell with unread badge via `useBadgeCounts` — reuse as-is; new campaigns automatically flow through `notification_recipients`. No changes needed except confirming realtime update on `admin_notifications` is subscribed (it already is).

## Backend

### Database migration
```
-- Gmail metadata (no tokens — Lovable connector holds those)
CREATE TABLE public.owner_gmail_state (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_email text,
  google_account_name text,
  connected_at timestamptz,
  last_tested_at timestamptz,
  last_test_ok boolean,
  updated_at timestamptz DEFAULT now()
);
-- GRANT + owner-only RLS via has_role('owner').

-- Templates
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  notification_title text,
  notification_body text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- GRANT + owner-only RLS.

-- Extend notification_campaigns with retry counters (only if missing).
-- notification_recipients already tracks per-user email_status, in_app_status, error.
```

### Server functions (`src/lib/communication.functions.ts`)
- `getGmailStatus()` → reads `owner_gmail_state` + queries connector list, returns `{ connected, email, name, connectedAt, lastTestedAt }`.
- `sendGmailTest()` → gateway POST to `/gmail/v1/users/me/messages/send` with a minimal RFC 2822 body encoded base64url; updates state.
- `disconnectGmail()` → calls `standard_connectors--disconnect` equivalent via server-side helper + clears `owner_gmail_state`.
- `listStoreAdminRecipients({ mode, ids, plan, status })` → aggregates over `stores` + `subscription_packages` + `auth.users` (via existing admin client), returns `{ user_id, email, name, store, plan, status }[]`.
- `saveTemplate / listTemplates / deleteTemplate`.
- Extends existing `sendCampaign` to (a) resolve variables per recipient, (b) for each recipient with `send_email`, enqueue a Gmail-gateway job into `transactional_emails` pgmq queue with a new `transport: 'gmail_owner'` payload flag.

### Queue processor
Extend existing `src/routes/lovable/email/queue/process.ts` (or the Gmail path) to branch on `transport`:
- `transport: 'gmail_owner'` → build MIME, base64url encode, POST to gateway `https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send` with `Authorization: Bearer ${LOVABLE_API_KEY}` + `X-Connection-Api-Key: ${GOOGLE_MAIL_API_KEY}`.
- On 403 insufficient-scope → mark failed with actionable error; UI shows Reconnect.
- On 429 → respect `Retry-After` via existing throttle (`email_send_state`).
- On 5xx → let pgmq visibility timeout retry (existing DLQ after 5 failures).

### Individual sends, privacy
One gateway POST per recipient. Never a shared To. Failures logged per row; UI shows per-recipient error text (redacted — no raw provider JSON).

## Security

- Gmail tokens never touch our DB, our frontend, localStorage, URLs, or logs. Lovable connector gateway holds them.
- `LOVABLE_API_KEY` and `GOOGLE_MAIL_API_KEY` are server-only (already are).
- All new server fns use `requireSupabaseAuth` + `has_role(auth.uid(), 'owner')` check; store-admin users cannot reach any of it.
- RLS on `owner_gmail_state` and `message_templates`: owner-only via `has_role`.
- Store-admin in-app inbox: existing `notification_recipients` RLS (user can only read/update own rows) unchanged.

## Connector setup step (one-time, first turn of build)

Call `standard_connectors--connect` with `connector_id: "google_mail"`. Owner completes the popup, secret `GOOGLE_MAIL_API_KEY` is injected into project env, gateway is ready.

## Failure UX

Friendly messages for: OAuth cancelled, revoked, expired refresh, insufficient scope, rate limit, invalid email, network error. Each maps to a copy string; no raw gateway body shown.

## Mobile & dark mode

All new routes use existing tokens/shadcn primitives, table→card breakpoint at `md`, tested to 320px. Dark-mode contrast verified on badges and status pills.

## Out of scope (kept for later)

- Scheduled sends UI already exists in current Notification Center — leave as-is.
- Marketing / bulk newsletters — not permitted by platform email policy; templates enforce "notice-style" content only.
- Attachments — Gmail API supports them but not requested; can add later behind a flag.

## File map

- `supabase/migrations/*` — 1 migration (owner_gmail_state, message_templates, grants, RLS).
- `src/lib/communication.functions.ts` — new (Gmail status, test, disconnect, recipients, templates).
- `src/lib/communication-send.server.ts` — new (Gmail gateway send, MIME builder, variable resolver).
- Extend `src/routes/lovable/email/queue/process.ts` — branch on transport.
- Extend `src/lib/notifications.functions.ts` — hook variable resolver + gmail transport into `sendCampaign`.
- `src/routes/_authenticated/owner/communication/` — 6 new route files (index, gmail, compose, history.email, history.notifications, templates).
- `src/routes/_authenticated/owner/route.tsx` sidebar — add Communication group.
- Store-admin bell/inbox — no code changes (already wired).

## Verification

After build: connect Gmail via the connector card, run Send Test Email (confirm arrival in owner inbox), create a campaign to a single store admin with email + in-app, verify per-recipient row in Email History, verify in-app badge increments in that admin's panel, mark read → badge decrements, disconnect Gmail → Compose modal appears when Email checked, in-app still works. Test at 320px width and in dark mode.
