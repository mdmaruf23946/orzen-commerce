# Facebook Page module — make every action actually work

## What I checked live on your connected page (A9N Ai)

I used the page connection stored in your Merchant Panel and called Facebook directly:

| Action | Real result from Facebook |
| --- | --- |
| Read page info (name, followers) | Works |
| Read posts / feed | Works |
| Read comments on a post | Works |
| Read/needs blocked-users list | Rejected — needs `pages_read_engagement` |
| Event subscription check | Rejected — needs `pages_manage_metadata` |
| Publish post | Blocked by our own UI before it ever reaches Facebook |

The stored permission list for this page is only `pages_messaging`, `pages_utility_messaging`, `public_profile` — it came from the Messenger token import. Two separate problems follow from that:

1. **Our UI over-blocks.** Posts and comments actually read fine, yet the module marks read as unsupported and hard-disables Publish ("requires pages_manage_posts") without ever asking Facebook. The stored scope list is unreliable, so it must not be the only gate.
2. **The token genuinely lacks the posting/moderation permissions.** Publishing, hiding, deleting, replying and blocking need `pages_manage_posts`, `pages_manage_engagement`, `pages_read_engagement` and `pages_manage_metadata`. No code change can create those — the page token has to be re-issued with them granted.

## Fix plan

### 1. Trust Facebook, not the cached scope list
- Replace the hard pre-block with a live capability check: on connect, on Reconnect, and on a new **Recheck permissions** button, run safe read-only probes (page fields, `/feed`, a post's `/comments`, `/blocked`, `/subscribed_apps`) and merge the results with the reported scopes into a verified capability set.
- Capabilities that probe successfully are enabled even when the scope list does not mention them (this alone restores Posts and Comments on your page today).
- Write actions (publish, reply, hide, delete, block, private reply) are never silently disabled: the button stays active, the call goes to Facebook, and a failure is shown as a plain-language reason.

### 2. Clear, actionable errors instead of dead buttons
- Route every Facebook failure through the existing error translator, extended with codes `#200`, `#283`, `#10`, `#190` and mapped to: which permission is missing, and the exact step to fix it — in Bengali and English.
- The Publish screen shows a warning strip instead of a disabled button when a permission looks missing, so you can still try.

### 3. Page Settings: guided permission repair
- A **Permissions** card listing every capability with Verified / Missing / Unknown, plus the exact scope name.
- A copyable list of the four required scopes and short steps to re-issue the page token with them, then **Reconnect** and **Recheck permissions** in place.
- Event delivery (webhook subscription) shows its true state, and the subscribe call no longer reports success when Facebook rejected it.

### 4. Comments + AI verification
- Comment sync currently only pulls comments for posts it already knows; it will also pull from the newest posts so fresh comments appear without a manual post visit.
- AI reading and drafting replies is wired correctly (classification: question, order intent, praise, spam, abusive) — I will verify it end to end on a real comment after permissions are fixed.
- Delete and block stay approval-only through the Moderation queue (AI proposes, you approve). AI never deletes or blocks on its own — that behaviour is kept.
- Block currently calls the page's blocked-users endpoint; I will add the fallback Facebook expects for comment authors and report honestly when the page role does not allow blocking.

### 5. Ownership and safety
- Every action re-checks the store owns the page row before touching Facebook (tenant isolation unchanged).
- Tokens stay encrypted and are never returned to the browser.

## What you will need to do once

The four permissions above must be granted to the page token. After the Permissions card is in place, it will show exactly which are missing with copy-paste steps; after reconnecting, posting, replying, hiding, deleting and blocking all become available.

## Technical notes

- `src/lib/facebook-page.server.ts`: add `probeCapabilities(pageId, token)`; `capabilities()` merges scopes + probe results + tasks; `requireCapability` becomes advisory (throws only on proven-missing), verified caps persisted to `facebook_page_integrations.permissions_verified` (new jsonb column, migration with owner-scoped RLS untouched otherwise).
- `src/lib/facebook-page.functions.ts`: new `recheckFacebookPermissions` server fn; list/publish/comment/moderation fns stop returning early on `missing:` and instead attempt + translate errors.
- `src/lib/facebook-errors.server.ts`: extend the code map with BN/EN text per capability.
- UI: `facebook.settings.tsx` permissions card, `facebook.compose.tsx` warning strip instead of disabled publish, `facebook.posts.tsx` / `facebook.comments.tsx` use verified caps; shared bits in `src/components/admin/facebook/ui.tsx`.
- `syncFacebookComments`: also fetch `/{page-id}/posts?fields=comments{...}` for the newest posts.
