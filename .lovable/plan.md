# Official WhatsApp & Messenger Branding on 4 Admin Pages

Apply official channel branding (logo + brand color) to the WhatsApp Integration, WhatsApp Inbox, Messenger Integration and Messenger Inbox pages. Functionality, layout and data flow stay exactly as they are — this is presentation only.

## Brand definitions

- WhatsApp: official green `#25D366` (deep `#128C7E` for accents), official speech-bubble-with-handset glyph.
- Messenger: official Messenger blue-purple gradient (`#00B2FF` → `#006AFF` → `#A033FF`), official lightning-bolt bubble glyph.

Both are added as new channel tokens in `src/styles.css` (e.g. `--channel-whatsapp`, `--channel-whatsapp-soft`, `--channel-messenger-*` plus a gradient variable) so components never hardcode hex values, and both stay readable in light and dark mode.

## Shared brand assets

Two small inline SVG components (official marks, currentColor/gradient aware):
- `src/components/admin/brand/WhatsAppMark.tsx`
- `src/components/admin/brand/MessengerMark.tsx`

Each accepts a size and renders the authentic glyph inside the official colored/gradient rounded shape.

## Where the branding appears on each page

WhatsApp Integration (`admin/whatsapp.tsx`)
- Page header icon replaced with the official WhatsApp mark; a subtle green tinted header band behind title/description.
- "Connected" status badge, connection card accents, primary action buttons (Connect / Send test) and section icons use the WhatsApp green token instead of the generic emerald/primary.

WhatsApp Inbox (`admin/whatsapp-inbox.tsx`)
- Header mark + green tint band matching the integration page.
- Active filter chip, unread count badge, active conversation highlight and outbound message bubbles use WhatsApp green with proper foreground contrast.

Messenger Integration (`admin/messenger.tsx`)
- Header gets the official Messenger mark and a blue-purple gradient tint band.
- Connected/Verified badges, primary buttons and step accents use the Messenger blue token; the connected page avatar gets a Messenger-gradient ring.

Messenger Inbox (`admin/messenger-inbox.tsx`)
- Header mark + gradient tint band.
- Active filter chip, unread badge, selected thread highlight and outbound bubbles use the Messenger blue/gradient. Lead-status chips keep their existing meaning colors.

## Notes

- No changes to server functions, queries, routes, or any business logic.
- All new colors go through CSS tokens; no raw hex in components, no `text-white`/`bg-black` utilities.
- Existing shadcn variants and spacing/layout stay untouched, so the pages keep the same structure and responsiveness.
