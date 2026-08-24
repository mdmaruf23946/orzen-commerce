# Facebook Page — standalone Store Admin module

A new, fully separate Facebook Page module. The Messenger AI Agent, Messenger Inbox, its webhook and its `messenger_integrations` connection stay untouched — nothing in that workflow is edited.

## Navigation

New sidebar group **Facebook Page** with five entries:

```text
FACEBOOK PAGE
  Page Overview     /admin/facebook
  Posts             /admin/facebook/posts
  Comments          /admin/facebook/comments
  Create Post       /admin/facebook/compose
  Page Settings     /admin/facebook/settings
```

Gated by a new `facebook_page` plan feature (enabled for Basic, Business, Custom, Trial). On Free the pages show the standard soft-lock with the "আপডেট করুন" button to Billing & Plans.

## 1. Page Overview

Connected page card with official Facebook branding: page profile image, page name, page ID, connection status (Connected / Token expiring / Error / Not connected), last verified time, and a capability list showing which Meta permissions were actually granted (see section 7). Quick stats: recent post count, unanswered comments, AI mode. Buttons: Create Post, Reconnect, Open page on Facebook.

## 2. Posts

List of the page's published posts pulled live from the Graph API (`/{page-id}/feed`), paginated:

- Message text, attached image/video thumbnail, published date
- Comments count, reactions/shares count when the granted permission returns them
- Actions: View Comments, Open on Facebook, Edit (text-only posts, where Meta allows), Delete
- Draft posts saved in Orzen appear in a separate "Drafts" tab with Edit / Publish / Delete

## 3. Comments

Comments across page posts, newest first, with a filter for unanswered / AI-flagged / hidden. Each comment row shows commenter name and picture, comment text, time, and the related post (with a link back to it). Actions:

- Reply (posts a real comment reply through the API)
- Message on Messenger — private reply, only enabled when the comment is eligible (Meta allows one private reply per top-level comment within 7 days) and `pages_messaging` is granted
- Hide / Unhide
- Delete
- Block user — only shown when `pages_manage_engagement` + moderation access is granted; otherwise displayed as unavailable with the reason

Any action whose permission is missing renders as disabled with a short "requires <permission>" note — never a fake button.

## 4. AI comment management (optional)

Settings per store, default **suggest-only**:

- AI reads each new/imported comment, classifies it (question, order intent, praise, spam, abusive) and drafts a reply in the store's tone using existing store/product context
- Admin sees the suggestion inline and can Send, Edit & Send, or Dismiss
- Optional toggles: auto-reply for safe categories, auto-hide for spam/abuse, suggest Messenger handoff for order-intent comments
- Delete and block are never automatic; they stay manual admin actions with a confirm step
- Rules the admin controls: enable/disable AI, tone, reply language, keyword allow/deny lists, and which categories may be auto-handled

This uses its own settings row and its own prompt path; the Messenger agent config is not read or changed.

## 5. Create Post

Prominent **+ Create Post** button on Overview and Posts. Composer supports:

- Text with emoji
- Image upload (single) or video upload
- Link with automatic preview
- Live preview panel styled like a Facebook post
- Publish Now (posts via `/{page-id}/photos`, `/{page-id}/videos` or `/{page-id}/feed`) or Save as Draft (stored in Orzen, publishable later)

## 6. Facebook connection (Page Settings)

Its own connection independent of Messenger: Page ID, Page access token, App ID/App secret, with a one-click **"Use my Messenger page"** import that copies the already-verified page credentials into the Facebook Page module (read-only copy; the Messenger row is not modified). Shows connected page name, picture, status, token expiry, granted permissions, Reconnect and Disconnect. Tokens are encrypted at rest and never returned to the browser.

## Technical notes

- New migration: `facebook_page_integrations` (store_id unique, page_id, encrypted page token, app_id, encrypted app secret, permissions jsonb, status, token_expires_at, last_verified_at, last_error), `facebook_posts` (drafts + published mirror: message, media url, link, type, status, fb_post_id, scheduled/published_at), `facebook_comments` (cached comment id, post id, author, message, created_time, hidden, replied, ai_category, ai_suggestion, ai_status), `facebook_ai_settings` (mode, tone, language, auto-reply/auto-hide toggles, keyword lists). All owner-scoped RLS (`is_store_owner(store_id)`) plus GRANTs to `authenticated` and `service_role`; no anon access.
- Server logic in `src/lib/facebook-page.functions.ts` (thin `createServerFn` wrappers, `requireSupabaseAuth`) + `src/lib/facebook-page.server.ts` (Graph API v19.0 calls, token decrypt via existing `src/lib/crypto/credentials.server.ts`, permission probing through `/{page-id}?fields=...` and `debug_token`).
- Capability detection: on connect and on each Reconnect the server calls `debug_token` and stores the granted scopes; the UI derives which actions are available from that stored list, so unsupported actions are visibly disabled rather than failing at click time.
- AI classification/drafting through the existing Lovable AI gateway helper (`src/lib/ai-gateway.server.ts`) in a new dedicated module — the Messenger agent files are not touched.
- Routes: `src/routes/_authenticated/admin/facebook.route.tsx` (tab shell + head metadata) with `facebook.index.tsx`, `facebook.posts.tsx`, `facebook.comments.tsx`, `facebook.compose.tsx`, `facebook.settings.tsx`; shared UI in `src/components/admin/facebook/`.
- `src/lib/features.ts` gains `facebook_page`; plan `features` JSON updated for Basic/Business/Custom/Trial.
- Mobile-first cards, official Facebook blue used only inside this section, consistent with existing admin pages.
