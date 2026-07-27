
# Notification Center — Plan

Build a platform-scale communication system in Winner Admin that sends messages to Store Admins over Email + In-App, with per-recipient delivery/read tracking, queueing, retries, scheduling, drafts, templates, and analytics.

Existing pieces to reuse (verified):
- `admin_notifications` table (per-store in-app notifications) + `admin_read_cursors` — badge system already wired to `admin_notifications` in `src/lib/badge-counts.functions.ts`.
- `announcements` table + `owner/notifications.tsx` — will remain as a lightweight draft page; new Notification Center becomes the primary experience (announcements page repurposed as legacy shortcut, not removed).
- Platform branding (`platform_branding`) for email header/footer.
- Lovable Email infrastructure (auth + transactional) will be scaffolded to provide the queue, cron worker, `email_send_log`, suppression list, and templates.

## 1. Prerequisites (email infra)

Before code changes:
1. Verify email domain via `email_domain--check_email_domain_status`. If none, show the email setup dialog and pause until the user configures a sender domain.
2. Run `email_domain--setup_email_infra` (creates pgmq queues, cron, `email_send_log`, suppression, unsubscribe tokens).
3. Run `email_domain--scaffold_transactional_email` to install `/lovable/email/transactional/send`, preview route, and templates directory.

If the user does not want to configure a domain, we still ship the in-app half and mark email channel as “not configured” with a clear inline setup CTA — no fake sends.

## 2. Database (single migration)

New tables in `public`, each with GRANTs + RLS.

- `notification_campaigns`
  - `id`, `title`, `body_html`, `type` (announcement|important_update|maintenance|system_alert|feature_update|billing_notice|security_alert|general), `priority` (normal|important|urgent), `channels` `text[]` (email, in_app), `action_label`, `action_type` (internal|external|none), `action_target`, `audience_kind` (all|stores|users|plan|status), `audience_ids` `uuid[]`, `audience_filter` `jsonb`, `status` (draft|scheduled|queued|sending|completed|failed|cancelled), `scheduled_at`, `scheduled_tz`, `created_by`, `sent_at`, `completed_at`, `totals` `jsonb` (recipients/email_sent/email_failed/inapp_created/inapp_read), `idempotency_key` UNIQUE.
  - RLS: owners (users with `owner` role via `has_role`) full access; no anon/authenticated read.

- `notification_recipients` (one row per store-admin recipient per campaign)
  - `id`, `campaign_id` → campaigns, `store_id`, `user_id`, `email`, `email_status` (pending|sent|failed|suppressed), `email_message_id`, `email_last_error`, `email_attempts`, `inapp_notification_id` → `admin_notifications.id`, `inapp_status` (pending|created|read), `read_at`, `created_at`, `updated_at`. Unique `(campaign_id, user_id)` for idempotency.
  - RLS: owners full access; the recipient user can `SELECT` their own row (`user_id = auth.uid()`).

- `notification_templates`
  - `id`, `name`, `type`, `priority`, `title`, `body_html`, `action_label`, `action_type`, `action_target`, `created_by`, timestamps. Owner-only RLS.

- Extend `admin_notifications`:
  - Add `campaign_id uuid null` FK, `priority text`, `type text`, `action_label`, `action_type`, `action_target`. Backfill nulls; keep existing rows untouched.
  - Existing RLS/badge logic continues to work; new columns are additive.

All tables include `service_role` GRANT since the queue worker uses `supabaseAdmin`.

## 3. Server functions (Winner Admin)

`src/lib/notifications.functions.ts` (owner-only, `requireSupabaseAuth` + `has_role('owner')`):

- `listCampaigns({ status?, q?, limit, cursor })`
- `getCampaign(id)` — includes recipient roll-up counts and 50 most recent recipients.
- `saveCampaign(input)` — create/update draft.
- `deleteCampaign(id)` — draft only.
- `resolveAudience(input)` — returns count + preview of first N store-admin users (name, store, email) for the confirm dialog.
- `sendCampaign({ id, idempotency_key })` — transitions draft→queued, materializes `notification_recipients`, creates `admin_notifications` rows immediately (in-app is instant), enqueues one `enqueue_email` call per email recipient into the `transactional_emails` pgmq queue using template `platform-notification` with per-recipient `templateData` and `idempotencyKey = campaign_id + user_id`.
- `scheduleCampaign({ id, at, tz })` — sets `scheduled_at`; a pg_cron job (created in migration) calls a small `/api/public/cron/notifications-tick` route every minute that flips due campaigns to `queued` and invokes `sendCampaign` server-side with a service-role fetch.
- `sendTestEmail({ id | draftPayload, email })` — one-off enqueue that does NOT create recipients or in-app rows.
- `listTemplates`, `saveTemplate`, `deleteTemplate`.

`src/lib/notifications-inbox.functions.ts` (store admin, `requireSupabaseAuth`):
- `listMyNotifications({ status, limit, cursor })` — joins `admin_notifications` for stores the user owns, includes campaign metadata; recipient rows for the user’s own `user_id` are the source of truth for read state.
- `markNotificationRead(id)` / `markAllRead()` — updates `notification_recipients.read_at` and `admin_notifications.read_at` in one transaction; badge counter picks it up via existing cursor system.

## 4. Email template

New React Email template `src/lib/email-templates/platform-notification.tsx`:
- Props: `title`, `bodyHtml` (sanitized server-side with DOMPurify), `type`, `priority`, `actionLabel?`, `actionUrl?`, brand assets fetched via `platform_branding`.
- Registered in `src/lib/email-templates/registry.ts`.

Body HTML sanitization happens in `sendCampaign` before enqueueing so raw HTML never reaches `dangerouslySetInnerHTML` in a template.

## 5. Queue + retry + idempotency

- Reuse the Lovable transactional queue (`transactional_emails` pgmq + `process-email-queue` cron). It already handles Retry-After, 5xx retries, DLQ after 5 attempts, and suppression checks.
- Idempotency key format: `notif-<campaign_id>-<user_id>` — guarantees no duplicate sends if `sendCampaign` is invoked twice.
- `notification_recipients` unique `(campaign_id, user_id)` blocks duplicate row creation at the DB level.

## 6. Winner Admin UI

New route `src/routes/_authenticated/owner/notification-center.route.tsx` with children:

- `notification-center.index.tsx` — Campaigns list: title, recipients, channels, status, sent date, actions (view, duplicate, cancel-if-scheduled, delete-if-draft). Filter by status/type.
- `notification-center.compose.tsx` — Composer (also handles `?draft=<id>`):
  - Title, Type, Priority.
  - Rich text editor (reuses `src/components/admin/product-form/RichTextEditor.tsx`).
  - Recipient selector (tabs: All / Stores / Users / Groups) with search + multi-select; live count via `resolveAudience`.
  - Channels checkboxes (defaults Email+In-App), disabled Email if domain not configured with inline CTA.
  - Optional action button config.
  - Schedule: Send now / Schedule (date/time/tz).
  - Preview drawer (Email + In-App renders).
  - Test send input.
  - Footer: Save draft / Confirm & Send (opens confirmation modal showing counts).
- `notification-center.templates.tsx` — CRUD templates; “Use template” loads composer.
- `notification-center.$id.tsx` — Campaign detail: totals, per-recipient table (email status, in-app status, read_at) with search + CSV export.

Sidebar link added to `owner/route.tsx` under Communications section. The existing “Announcements” page stays as-is (legacy), no removal.

## 7. Store Admin UI

- New route `src/routes/_authenticated/admin/notifications.inbox.tsx` — inbox with unread/all tabs, filters by type, mark-read, mark-all-read. Uses `listMyNotifications`.
- Header bell in `admin/route.tsx` already renders `admin_notifications` badge; extend the popover (or link the bell) to open the new inbox route. Visiting the inbox marks the `notifications` cursor seen (existing plumbing).
- Notification detail modal renders sanitized body, type/priority chip, action button (internal → `useNavigate`; external → validated https URL opened in new tab with `rel="noopener"`).

## 8. Multi-tenant security

- All owner functions gate on `has_role(auth.uid(), 'owner')`.
- `notification_recipients` RLS: recipient can only see own row; owner sees all.
- `admin_notifications` continues to use existing store-owner RLS.
- Bulk email uses per-recipient `enqueue_email` — no CC/BCC, no address leakage.
- Body HTML sanitized (DOMPurify) server-side; action URLs validated (`https:` for external, allowlist for internal).

## 9. Analytics + status semantics

Campaign detail rollup pulls counts from `notification_recipients` (email_status, inapp_status, read_at). We surface real counts only:
- Email: pending / sent / failed / suppressed (from `email_send_log` correlated via `email_message_id`).
- In-App: created / read.
- No fabricated delivered/opened metrics unless the provider actually reports them.

## 10. Cron

- Existing `pg_cron` schedules `process-email-queue`.
- Add a new 1-minute cron: `SELECT net.http_post(... /api/public/cron/notifications-tick ...)` with `apikey` = anon key. Route dispatches due `scheduled` campaigns.

## Technical Details

Files created:
- Migration (tables + RLS + grants + cron + `admin_notifications` extension).
- `src/lib/notifications.functions.ts`, `src/lib/notifications-inbox.functions.ts`, `src/lib/notifications.server.ts` (audience resolver, enqueue helper).
- `src/lib/email-templates/platform-notification.tsx` + registry update.
- `src/routes/_authenticated/owner/notification-center.route.tsx` + `.index`, `.compose`, `.templates`, `.$id`.
- `src/routes/_authenticated/admin/notifications.inbox.tsx`.
- `src/routes/api/public/cron/notifications-tick.ts`.
- Small UI atoms: `NotificationTypeBadge`, `PriorityBadge`, `RecipientPicker`.

Files edited (additive):
- `src/routes/_authenticated/owner/route.tsx` (sidebar entry).
- `src/routes/_authenticated/admin/route.tsx` (bell → inbox link).
- `src/lib/badge-counts.functions.ts` (no change needed; `admin_notifications` already counted).
- `src/lib/email-templates/registry.ts`.

Non-goals / preserved:
- Existing `announcements` and `owner/notifications.tsx` page remain intact.
- Existing badge counting logic unchanged.
- No new email provider added; delivery uses Lovable Emails infrastructure.
