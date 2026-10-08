# Profile page redesign (UI only)

## Goal
Make the Merchant Panel Profile page feel like a professional account center. Keep all existing data and functionality; add no new features. Sidebar stays unchanged.

## Layout
```text
[ Header card: large avatar | name, email | badges: Store Owner, Email Verified, Active ]
[ Profile Settings card (wide)        ] [ Basic account information card (narrow) ]
[ Sign out of ORZEN — subtle bordered row, outline-destructive button ]
```
On mobile the cards stack: header, settings, account info, sign-out.

## 1. Profile header
- Soft tinted banner strip at the top of the card, avatar overlapping it with a ring.
- Name (large, semibold), email underneath with a mail icon.
- Badges: account type/role, email verification (check icon), and "Active" (green dot) for signed-in accounts.

## 2. Profile Settings
- Card with icon heading and short description, divider, then fields.
- Photo row: avatar preview plus upload button and a "PNG, JPG or WEBP, up to 2MB" hint.
- Name input; Email input with a lock icon and a "Read-only" label so it is clearly not editable.
- Footer bar with the Save profile button aligned right (full width on mobile).

## 3. Basic account information
- Card with icon heading; rows with a small icon, muted label and value on the right, separated by thin dividers.
- Account ID shown in monospace with a copy button.

## 4. Future-ready structure
- Each section is its own reusable card block, so security and other settings can be added as new cards later. No placeholder cards.

## 5. Logout
- Separate lower section titled "Sign out of ORZEN" with a short explanation.
- Destructive outline button (not solid red), so it is visible but does not dominate the page.

## Technical details
- Only `src/routes/_authenticated/admin/profile.tsx` changes; the server functions and saving logic stay as they are.
- Use existing design tokens and shadcn components (Card, Badge, Button, Input, Separator) with lucide icons; no hardcoded colours.
- After approval: typecheck, check the page in the preview on desktop and mobile, then keep it in preview until you ask to put it live on orzen.top.
