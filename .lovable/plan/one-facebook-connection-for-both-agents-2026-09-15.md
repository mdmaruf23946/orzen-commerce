# One Facebook connection for both agents

Today the Merchant Panel asks for the same Facebook Page twice: once on the Messenger page (chat agent) and again on Facebook Page > Settings (posts and comments agent). After this change there is only one place to connect — Messenger. Connecting there automatically activates the Facebook Page agent with the same Page, token and app credentials.

Both systems stay exactly as they are; only the connection step is unified.

## What the merchant sees

**Messenger page (the only connect point)**
- Same form as today (Page ID, Page Access Token, App ID, App Secret, policy URLs).
- After a successful connect, a new line in the connection card: "Facebook Page agent: connected automatically" with the Page name, plus a short note listing which post/comment actions the token allows and which are missing.
- Reconnect re-syncs both. Disconnect disconnects both.

**Facebook Page > Settings**
- The manual connect form and the "Import from Messenger" button are removed.
- Replaced by a status card: connected Page, connected-at time, and a "Connect in Messenger" link when nothing is connected.
- The Permissions section (Verified / Missing / Not checked) and the Recheck permissions button stay, since the token may allow chatting but not posting.
- Webhook, AI moderation and every other setting stay untouched.

All other Facebook Page tabs (Posts, Comments, Create Post, Moderation) are unchanged.

## Permission note

One Page token drives both agents. If that token was generated only with messaging permissions, posting and comment moderation still will not work — Facebook, not the app, refuses those. The Messenger page will say so right after connecting, listing the permissions to add (pages_show_list, pages_read_engagement, pages_manage_posts, pages_manage_engagement, pages_manage_metadata, pages_messaging) so the merchant can regenerate the token once and reconnect once.

## Technical design

### Mirroring on connect
`connectMessenger` in `src/lib/ai.functions.ts`, after the `messenger_integrations` upsert succeeds:
1. Best-effort call to a new helper `syncFacebookPageFromMessenger(supabase, storeId, { page_id, token, app_id, app_secret })` in `src/lib/facebook-page.server.ts`.
2. The helper checks the store's plan for the `facebook_page` feature; if not entitled, it returns `{ skipped: true }` and Messenger connect still succeeds.
3. Otherwise it upserts `facebook_page_integrations` on `store_id` with the same Page ID/name, encrypted token, app id/secret, `status: 'connected'`, preserving the existing `verify_token` (generating one if absent), then calls `subscribePageToApp` and `probeCapabilities`, writing `permissions`, `permissions_verified`, `permissions_checked_at`.
4. Failures are captured into the returned payload and `facebook_page_integrations.last_error` — never thrown, so a Facebook problem can never block the Messenger connection.

`connectMessenger` returns the extra fields `facebook: { connected, page_name, verified, error }`; the Messenger route renders them.

### Disconnect
`disconnectMessenger` also deletes the `facebook_page_integrations` row for the store (same tenant scope, owner-guarded as today). Posts, comments and moderation history rows are left in place.

### Repair path
`verifyMessengerWebhook` (the existing Verify/Repair action) calls the same sync helper so an already-connected store gets its Facebook Page agent linked without reconnecting.

### Removals
- `importMessengerPageCredentials` and `connectFacebookPage` server functions in `src/lib/facebook-page.functions.ts` are removed along with their UI in `src/routes/_authenticated/admin/facebook.settings.tsx`.
- `getFacebookPage` keeps returning status/capabilities; the `messenger_page` hint field is dropped.
- `recheckFacebookPermissions`, `disconnectFacebookPage` usage in settings: Recheck stays, the standalone Disconnect button is removed (disconnect happens from Messenger).

### Isolation
The sync helper is the single crossing point between the two modules and is always store-scoped from the authenticated `storeId`; no other Facebook code reads Messenger rows.
