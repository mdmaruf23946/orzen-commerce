# Sticky Header & Composer for Messenger Inbox

Scope: `src/routes/_authenticated/admin/messenger-inbox.tsx` — `ConversationView` component (around lines 420–626). No business-logic changes, presentation only.

## Current issue
The conversation panel uses `flex flex-1 flex-col overflow-hidden` with header, scroll area, and composer as flex siblings. On mobile the outer page/list container ends up scrolling the whole panel, so the header and input scroll away with the messages.

## Changes

1. **Lock the conversation panel to viewport height** so its inner flex layout is authoritative:
   - Root wrapper of `ConversationView` becomes `flex h-[100dvh] flex-1 flex-col overflow-hidden` (dynamic viewport height handles mobile URL bar). Keep `md:h-full` fallback where nested in the desktop 3-pane layout.

2. **Sticky header** (the block at line 423):
   - Add `sticky top-0 z-20 shrink-0 bg-background/95 backdrop-blur`.
   - Keep existing content and add:
     - Customer online/offline dot next to the avatar (green if `profile.is_online`, muted gray otherwise; hidden if field unavailable — no new data fetch).
     - AI/Human badge stays as the toggle button on the right.
   - Ensure `border-b` remains for visual separation.

3. **Scrollable message area** (line 450):
   - Keep `ref={scrollRef}` div as the sole vertical scroller: `flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-smooth space-y-2 p-3`.
   - Add `pb-4` so the last bubble isn't flush against the composer.
   - Parent grid at line 448 gets `min-h-0` so flex children can actually shrink and scroll.

4. **Sticky composer** (line 512 block):
   - Wrap in `sticky bottom-0 z-10 shrink-0 bg-background border-t`.
   - Add safe-area padding: `pb-[env(safe-area-inset-bottom)]` for iOS.
   - Keep all existing controls (attachments, emoji, quick replies, product picker, textarea, send).

5. **Right rail** (line 629) stays as its own independent scroller on `lg+`; unaffected.

## Result
```
┌───────────────────────────────┐
│ Sticky header (back, avatar,  │
│ name, PSID, online, AI/Human) │
├───────────────────────────────┤
│                               │
│  Scrollable messages          │
│  (only this area scrolls)     │
│                               │
├───────────────────────────────┤
│ Sticky composer + attachments │
└───────────────────────────────┘
```

## Verification
- Resize preview to 360px width, scroll messages: header + composer stay in place.
- Desktop lg breakpoint: 3-pane layout unchanged, right rail still scrolls independently.
- Send a message: auto-scroll behavior (`scrollRef`) still lands at bottom.
