# ORZEN Landing Page — Full Redesign Plan

Rebuild `src/routes/index.tsx` from scratch as a premium, white-background, mobile-first SaaS landing page for ORZEN, matching Shopify/Framer/Stripe/Vercel polish. All 15 sections, brand tokens, animations, and responsive rules included. No placeholder lorem ipsum — realistic copy for a Bangladesh-friendly eCommerce SaaS.

## Design tokens (added to `src/styles.css`)

Extend `:root` and `@theme inline` with ORZEN brand tokens (kept alongside existing shadcn tokens, not replacing them):

- `--orzen-navy: #111827` (primary)
- `--orzen-blue: #2563EB` (accent)
- `--orzen-success: #16A34A`
- `--orzen-warning: #F59E0B`
- `--orzen-danger: #DC2626`
- `--orzen-border: #E5E7EB`
- `--orzen-bg: #FFFFFF`
- Soft shadow token: `--shadow-soft: 0 10px 30px -12px rgb(17 24 39 / 0.08)`
- Utility keyframes: `float`, `fade-up`, `count-in` (added via `@utility` / keyframes block)

Typography: Inter (already common) loaded via `<link>` in `src/routes/__root.tsx` head — display weights 600/700/800 for headlines, 400/500 for body.

## Page structure (single route, componentized inline)

File: `src/routes/index.tsx` — replaces current landing.
Head metadata updated: title "ORZEN — Create Your Online Store in Minutes", real description, og tags, twitter card.

Sections in order:

1. **Sticky Header** — logo wordmark, nav (Features, Pricing, Templates, AI, FAQ, Contact) with smooth-scroll to section anchors, `Sign In` link → `/auth`, `Create Store` primary button → `/auth`. Backdrop blur + border-bottom on scroll. Mobile: hamburger sheet.
2. **Hero** — Two-column on desktop, stacked on mobile. Left: H1 "Create Your Online Store in Minutes.", subheadline listing capabilities, `Create Free Store` + `Watch Demo` buttons, tiny trust row ("No credit card • Free forever plan"). Right: layered dashboard mockup built in pure HTML/CSS/SVG (no external images) — main dashboard card with KPIs (Revenue, Orders, Visitors), a mini bar chart, floating cards for "New Order", "AI reply sent", "Courier picked up", with subtle floating animation.
3. **Trust bar** — 4 stat tiles with counter-in animation (1000+ Stores, 50,000+ Orders, 99.9% Uptime, 24/7 Monitoring).
4. **Features grid** — 12 cards (Store Builder, AI Sales Agent, Messenger AI, Facebook Pixel, Courier Integration, Inventory, Coupons, Analytics, Invoices, SEO, Theme Customizer, Multi-Device). Lucide icon in a rounded tinted square, title, one-line description, hover lift + border color shift.
5. **AI Sales Agent showcase** — Split layout. Left: bullet list of what the AI does + `Try AI Demo` button. Right: realistic chat widget mockup (customer bubbles + AI bubbles, typing indicator, product card in-chat).
6. **Platform Workflow** — 7-step vertical timeline on mobile, alternating zig-zag on desktop, with numbered circles, connector line, icon per step (Create Account → Analytics & Growth).
7. **Dashboard Showcase** — Tabbed mockup switcher (Store Admin / Customer Store / Owner Panel / AI / Analytics). Rendered as browser-chrome frame on desktop and phone frame beside it. All mockups built with divs/SVG.
8. **Pricing** — Billing cycle toggle (Monthly / 3M / 6M / Yearly) with auto-applied discount badges (10/20/30%). Four cards (Free, Basic, Business [Most Popular ring + badge], Custom). Each card: price, per-cycle savings note, feature checklist (5–7 items), CTA. Mobile: horizontal snap-scroll.
9. **Compare Plans table** — Full feature matrix (Products, Orders, Storage, AI Agent, Messenger, Courier, Pixel, Analytics, Invoices, Coupons, SEO, Themes, Support, Staff, API, Custom Domain) × 4 plans. Uses ✓ / — / "Unlimited" chips. Desktop: real table. Mobile: per-plan stacked cards.
10. **Theme Marketplace** — 7 template cards (Fashion, Electronics, Furniture, Cosmetics, Books, Food, Digital). Each card: stylized preview (gradient + mock product tiles built in CSS, category-appropriate palette), category label, `Use Template` button. Horizontal scroll on mobile.
11. **Why ORZEN** — 8 reason cards in a 4×2 grid (No Coding, Fast Setup, AI Powered, Bangladesh Friendly, Courier Ready, Facebook Ready, Mobile First, Affordable). Icon + short blurb.
12. **Testimonials** — Auto-advancing slider (3 visible desktop, 1 mobile) using a lightweight interval + transform, pause on hover. Each card: avatar (initials in colored circle), name, store name, 5-star rating, review. 6 testimonials with Bangladeshi store names.
13. **FAQ** — Accordion built on shadcn `Accordion` (already installed). 15 Q&A across Pricing, AI, Payments, Courier, Messenger, Free Trial, Support, Themes.
14. **Final CTA** — Full-width dark navy panel with rounded top, headline "Ready to Launch Your Store?", subcopy, `Create Store Free` (blue) + `View Pricing` (outline light) buttons, subtle grid/gradient backdrop.
15. **Footer** — 4-column on desktop (Brand + description, Product links, Company links, Legal), social icons row (Facebook, LinkedIn, YouTube, Email), bottom bar with © ORZEN and small print.

## Animations

- `animate-fade-in` and a new `animate-fade-up` on section entry (CSS keyframes, `will-change: transform, opacity`, triggered by an `IntersectionObserver` hook `useReveal` added to `src/hooks/use-reveal.ts`).
- Counter animation for stats using `requestAnimationFrame` (in-view only).
- Floating dashboard cards use `@keyframes float` (translateY 0 → -6px, 4s ease-in-out infinite, staggered delays).
- Hover lift: `transition-transform hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]`.
- Smooth scrolling via `html { scroll-behavior: smooth }` and `scroll-margin-top` on section anchors so sticky header doesn't cover them.

## Responsive rules

- Mobile-first Tailwind: base styles = 320px; `sm/md/lg/xl` upgrades.
- No horizontal page scroll: `overflow-x-hidden` on `body` wrapper; horizontally scrolling regions are opt-in (pricing, templates) via `overflow-x-auto snap-x`.
- Buttons full width under `sm`.
- Grids collapse to 1 col on mobile, 2 on `sm`, 3–4 on `lg`.
- All mockups use `max-w-full` + intrinsic aspect ratios.

## Performance & SEO

- No external images — mockups, template previews, and avatars are pure CSS/SVG, so nothing to lazy-load beyond fonts.
- Single route file, tree-shaken lucide icons, no new dependencies.
- Semantic HTML: single `<h1>`, `<section>` per block with `aria-labelledby`, nav landmarks, accessible accordion (shadcn), sufficient contrast against white using navy/blue tokens.
- Route head: real title (<60 chars), description (<160 chars), og:title/description/type, twitter:card. No og:image (none available; hosting fallback will handle).

## Files touched

- `src/routes/index.tsx` — full rewrite (single file, section components colocated at bottom for clarity, ~700–900 lines).
- `src/styles.css` — add ORZEN tokens, `@keyframes float / fade-up`, `@utility` helpers.
- `src/routes/__root.tsx` — add Inter `<link>` in head (only if not already loaded).
- `src/hooks/use-reveal.ts` — new tiny IntersectionObserver hook for reveal-on-scroll and counters.

## Out of scope (unless you say otherwise)

- Wiring nav CTAs to anything beyond `/auth` and in-page anchors.
- Building real `/pricing`, `/features`, `/templates`, `/ai`, `/faq`, `/contact` routes (nav uses `#` anchors on the landing page; separate routes can be a follow-up).
- Real testimonial photos (using styled initials avatars instead — no stock photo dependency).

Confirm and I'll build it end-to-end in one pass.
