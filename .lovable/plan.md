## Welcome Card refinement — desktop + dedicated mobile layout

Scope: only `src/components/admin/dashboard/WelcomeCard.tsx`. No changes to `src/routes/_authenticated/admin/index.tsx` (props stay identical), no changes to any other widget, hook, API, route, or DB. `src/styles.css` animations already added last turn stay as-is (no additions).

### Files touched

1. `src/components/admin/dashboard/WelcomeCard.tsx` — rewrite internals only. Same exported component name, same props signature, same import site.

No other file changes. No new dependency.

### Desktop / tablet layout (≥ md)

Single card, `max-h-[200px]`, `rounded-2xl`, soft shadow, light gradient (`from-primary/5 via-background to-accent/40`), `p-5 lg:p-6`. Grid:

```text
[  LEFT (greeting + chips)  ][  CENTER (4 stats + 2 status chips)  ][ RIGHT (robot + View Store) ]
   grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]
```

- **Left**: 👋 `Welcome back, {name}!` (text-xl/2xl semibold) + wrap row of chips: Active Store (green dot), Business/package, `/store/{slug}` + copy button (reuses existing `shareStore`), `Updated {relTime}`.
- **Center**: 4 compact stat tiles in one row (`grid-cols-4 gap-3`), each = small icon + label (Orders / Messages / AI Replies / Today's Sales) + big number. Values come from existing props (`data.today.orders`, `inbox.newConversationsToday`, `inbox.aiRepliedToday`, `fmtBDT(data.today.sales)`). Below: two status pills (AI Online, Messenger Connected) using existing signals; hidden if signal missing.
- **Right**: inline SVG robot + mini analytics glyph (`hidden md:block`, tablet `scale-75`), and the gradient **View Store** button on top (same `storeUrl` + target/rel as today).

### Mobile layout (< md) — dedicated, not a shrunk desktop

Rendered via a separate JSX branch gated by Tailwind `md:hidden` / `hidden md:grid`. Same component, two layouts.

Card: `max-h-[250px]`, `rounded-[20px]`, `p-4`, gradient background.

```text
Row 1:  🤖  👋 Welcome back, {name}
Row 2:  chips row (wrap): 🟢 Active Store · Business · /store/{slug} + copy · Updated {rel}
Row 3:  2×2 grid of compact stat tiles (Orders / Messages / AI Replies / Sales) — gap-2, text-sm number, text-[11px] label
Row 4:  status chip strip (wrap, no horizontal scroll): AI Online · Messenger Connected · Webhook Verified
Row 5:  full-width View Store button (gradient, rounded-full, py-2.5)
```

- Large robot illustration is not rendered; only a small 20–24px 🤖 glyph next to the greeting.
- No horizontal scroll — chips use `flex flex-wrap gap-2`.
- Missing signals silently omit their chip.

### Behavior preserved

- Same props, same `storeUrl`, same copy handler (`shareStore`), same `View Store` target/rel.
- No new fetch, no new state, no logic change. `useQuery`/data flow in `admin/index.tsx` untouched.
- No new keyframes; drops the mount fade-in to keep rendering lightweight per the "no heavy animations" rule (existing `animate-welcome-fade-in` utility stays in `styles.css`, just unused here).

### Verification

- `/admin` desktop: card ≤ 200px tall, 3-column layout, 4 stats visible in one row, robot on the right.
- Tablet (md): same layout, illustration visually ~50% smaller.
- Mobile 375px: dedicated stack, 2×2 stat grid, wrap chips, full-width CTA, ≤ 250px, no horizontal scroll.
- Every widget below the hero (KPI cards, Order Status, Analytics, Store Health, Recent Orders, Messenger, Quick Actions) renders unchanged.
- `bun run build` succeeds.
