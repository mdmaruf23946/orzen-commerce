# Theme Colors: Apply Every Theme Color Everywhere in the Store Panel

## What is wrong today (verified)

1. **Mobile sidebar (drawer) ignores the theme.** The drawer renders inside a portal that sits outside the storefront wrapper which carries the theme CSS variables, so it silently falls back to the platform's default orange/slate palette. Its brand header, list rows and dividers are also written with fixed colors (`bg-white`, `bg-slate-50`, `text-slate-900`, `border-slate-100`).

2. **Desktop text-based category bar is hardcoded.** The category pill bar uses fixed `orange-50 / orange-100 / orange-600 / bg-white` classes instead of theme tokens, so it never changes with the theme.

3. **Most theme colors are never used.** A theme defines 17 colors (primary, secondary, accent, button, header, footer, background, surface, card, border, link, ink, text, muted, success, warning, error), but only about three actually reach the screen (button/accent, header background, footer background). Surface, card, border, link, primary, secondary, accent and status colors are largely unused, which is why a 5-color theme looks like a 2-color theme.

## What will be done

### A. Make the theme reach every part of the store
- Apply the theme variables to the portal layer as well, so drawers, dialogs, dropdowns and toasts inside the storefront use the active theme instead of the platform defaults.

### B. Mobile sidebar
- Brand header background from the theme surface color, drawer body from the card/background color, dividers from the border color.
- Titles use the Ink color, secondary lines use Muted, active row background uses a soft tint of the theme button/accent color, icons and the primary action button use the accent color.

### C. Desktop category bar
- Container background = soft tint of accent, container border = theme border.
- Inactive item text = Muted, hover text = accent, active pill = theme card color with accent text.
- Subcategory dropdown = card background + theme border + Ink/accent text.

### D. Give every color a purposeful role
A clear, consistent mapping so a theme with 4-5 colors visibly uses all of them:

| Color | Where it shows |
| --- | --- |
| Primary | Section headings, active tabs/underlines, key highlights |
| Secondary | Sub-header / title bar, secondary buttons, dark strips |
| Accent | Badges, sale/discount labels, hover highlights, chips |
| Button | Add to cart / Buy now / primary CTA + hover state |
| Header | Header background |
| Footer | Footer background |
| Background | Page background |
| Surface | Section blocks, drawer header, subtle panels |
| Card | Product cards, dropdowns, popovers |
| Border | All separators and outlines |
| Link | Text links and inline anchors |
| Ink | Headings and prices (strong text) |
| Text | Body copy |
| Muted | Helper text, counts, placeholders |
| Success / Warning / Error | Stock, low-stock, out-of-stock, order status, form validation |

Implementation: expose these as storefront tokens and replace hardcoded palette classes in the storefront shell, category bar, mobile drawer, product cards, footer, bottom nav, page layout, account screens and search bar.

### E. Verification
- Switch between light, dark and colorful themes in the Merchant Panel preview and check desktop, tablet and mobile.
- Confirm no fixed orange/slate/white remains in storefront-facing components (aside from intentional overlays and images), and that dark themes stay readable.

## Technical notes
- Theme variables come from `themeCssVars()` in `src/lib/theme/definition.ts` and are set on the storefront wrapper in `src/routes/store/$slug/route.tsx`; scoped CSS lives in `src/lib/theme/ThemeStyle.tsx`.
- Extra tokens (`--sf-primary`, `--sf-secondary`, `--sf-card`, `--sf-link`, `--sf-success/warning/error`, `--sf-header`, `--sf-footer`) will be added there and registered in `src/styles.css` so Tailwind classes like `bg-sf-card` work.
- The portal fix injects the same variables into the portal container, keeping the theme scoped to the storefront only (Merchant/Owner panels stay unchanged).
- No database, RLS or business-logic changes; presentation only.
