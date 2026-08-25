# Landing Page: Remove Marketplace, Rebuild Product Showcase

## 1. Remove the Marketplace section

- Delete the "Marketplace / Premium themes for every niche" section and all seven theme cards from the landing page.
- Remove the "Templates" link from the header navigation and the footer link list so nothing points to a section that no longer exists.

## 2. Rebuild the "Every surface, built with the same care" showcase

### Realistic previews
Replace the current low-detail placeholders with five hand-built, high-fidelity UI mockups that mirror the real product:

- **Merchant Panel** — left sidebar with icons + labels, top bar with search and avatar, KPI row (Revenue, Orders, AOV, Conversion) with trend deltas, a revenue line/area chart, and an orders table with columns (order no., customer, status pill, amount, date).
- **Customer Store** — store header with logo and cart badge, hero banner with CTA, category chips, product grid with price, discount tag, ratings, and a bottom nav on the mobile variant.
- **Owner Panel** — platform KPIs (Stores, MRR, Active users, Churn), a growth chart, top-stores leaderboard with growth badges, and a recent signups list.
- **AI Dashboard** — agent status cards, a live chat transcript bubble stack (customer / AI), usage meters for requests and tokens.
- **Analytics** — funnel visual (Sessions → Product views → Add to cart → Orders), traffic-source breakdown bars, and a sparkline KPI row.

Each mockup is pure markup styled with the existing ORZEN CSS tokens (no images), so it stays crisp at any zoom and matches the brand.

### Desktop frame
Keep the macOS browser chrome but widen the inner canvas, add a subtle window shadow and page background so it reads as a real SaaS screen, with proper typographic hierarchy (labels, numbers, table rows) instead of uniform tiny text.

### Mobile frame
Rebuild the phone as a realistic device: correct ~9:19.5 aspect ratio, larger body width, rounded bezel, dynamic-island style notch, a status bar (time, signal, battery), a scrollable content area, and a bottom tab bar. Each of the five tabs gets a dedicated mobile-optimized layout (not a shrunken copy of the desktop one) with readable text sizes.

### Tab interaction
Pills stay a single controlled state. On switch, the previews cross-fade and lift slightly (opacity + small translate, ~250ms) using a keyed wrapper so the swap feels smooth; the active pill keeps the navy fill, inactive pills get a hover/focus ring. Pills become a horizontally scrollable, snap-aligned row on small screens so all five stay reachable at 320px.

### Responsive behaviour
Below `lg`, desktop frame stacks above the phone and both center; phone is hidden on the narrowest widths only if it would overflow — otherwise it scales down proportionally with the frame intact.

## Technical notes

- All work is confined to `src/routes/index.tsx` (landing route): remove `TEMPLATES` + `Templates()`, drop the `#templates` nav/footer entries, and rewrite `DashboardShowcase`, `BrowserFrame`, `PhoneFrame`, and `DashboardMock`.
- Mockups split into `DesktopMock` and `MobileMock` renderers keyed by tab so mobile is not a `compact` clone.
- Colors continue to use `var(--orzen-*)` tokens; no hardcoded palette additions beyond existing tokens.
- No backend, routing, or data changes.
