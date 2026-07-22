
# Welcome Card Redesign — Store Admin Dashboard

Scope: only the top hero section of `src/routes/_authenticated/admin/index.tsx` (lines 86–132). Every other widget (KPI cards, Order Status strip, Sales Analytics, Store Health, Recent Orders, Messenger, Notifications, Quick Actions, sidebar, header) stays byte-identical. No route, server function, RLS, schema, or query change.

## Files touched

1. `src/routes/_authenticated/admin/index.tsx` — replace the `{/* 1. Welcome Hero */}` section only.
2. `src/components/admin/dashboard/WelcomeCard.tsx` — new presentational component (props-only, no data fetching).
3. `src/styles.css` — add 2 keyframes (`welcome-fade-in`, `status-pulse`) + `@utility` wrappers. No token removals.

No other files change. No new npm dependency.

## Card shell

- Full width, `min-h-[150px] md:min-h-[170px]`, `rounded-[22px]`, `border border-[#ECECEC] dark:border-white/10`, white glass background (`bg-white/70 dark:bg-card/70 backdrop-blur-xl`), soft shadow (`shadow-[0_8px_30px_-12px_rgba(80,70,229,0.15)]`).
- Layered decoration (all `pointer-events-none absolute`): purple→blue gradient overlay (`bg-gradient-to-br from-primary/8 via-transparent to-blue-500/8`), two soft blurred blobs (purple top-left, blue bottom-right).
- Content grid: `grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_260px]` — Left / Center / Right. Tablet: `md:grid-cols-2` with Right stacking under. Mobile: single column stack in order Left → Center → Right illustration hidden or reduced to a compact top-right glyph.
- Wraps `welcome-fade-in` (0.5s ease-out) on mount; hover raises card `-translate-y-0.5 transition`.

## Left column

- `👋 Welcome back, {data.owner.name}!` — `text-xl md:text-2xl font-semibold tracking-tight`.
- One horizontal wrap row of chips (Apple/Linear pill style, `rounded-full border bg-background/70 px-2.5 py-1 text-xs`):
  - 🟢 Active Store (uses existing `store.status`; green dot + `animate-pulse`).
  - Business / package chip (existing `store.package_name`).
  - Store URL chip: `/store/{slug}` + inline copy button (reuses existing `shareStore()` — no logic change, just re-parented). External-link chip opens `storeUrl`.
  - `Updated {relTime(store?.updated_at)}` — muted.
- All chips flow on one line at ≥md, wrap gracefully below.

## Center column — AI Business Summary

- Title row: 🤖 `AI Business Summary` — `text-sm font-semibold`.
- Dynamic bullet list built purely from data already returned by `myDashboardOverview` + `getInboxStats` (already fetched on this page — wire via a `useQuery` reuse of the same `["messenger", "inbox-stats"]` key that the Messenger widget uses lower on the page, or pass in as a prop from the parent, whichever avoids a second network call). Bullets rendered only when the underlying number is defined & > 0; otherwise silently omitted:
  - `{today.orders}` new orders
  - `{inbox.newConversationsToday}` new Messenger conversations
  - AI replied to `{inbox.aiRepliedToday}` customers
  - `{inbox.handoffToday}` customers requested human support
  - Total sales today `{fmtBDT(today.sales)}`
  - Revenue `{today.salesPct >= 0 ? "increased" : "decreased"} by {abs}% vs yesterday`
- Numbers use a lightweight count-up (reuse existing `useCountUp` from `src/hooks/use-reveal.ts`) triggered on mount.
- **AI Insight** callout beneath: soft indigo panel (`rounded-xl bg-primary/5 border border-primary/10 p-3 text-xs`) with 💡 label. Text is derived client-side from data already in the page (no new API):
  - If any `lowStock` item present → "`{topProduct.name}` is trending — stock low, consider restocking."
  - Else if `today.ordersPct > 20` → "Order volume is up `{ordersPct}%` today — great momentum."
  - Else if `inbox.unread > 0` → "You have `{unread}` unread Messenger threads waiting for a reply."
  - Fallback: "All quiet — a good time to publish a new product or coupon."

## Right column — Illustration + primary CTA

- Top-right absolutely-positioned **View Store** button (existing behavior/handler preserved): purple gradient (`bg-gradient-to-r from-primary to-indigo-500`), `rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/30 hover:-translate-y-0.5 transition`, external-link icon. On mobile it sits below the header row full-width.
- Decorative AI illustration built with inline SVG (no asset, no new dep): stylized robot head, two floating chat bubbles, a mini analytics bar chart, floating circles, radial purple glow behind. `hidden md:block` on tablet-and-up; hidden entirely under `sm` to keep the card compact. `orzen-float` animation reused (already in styles.css).

## Bottom status bar

- Horizontal scroll-safe row of small badge chips inside the card, separated from content by a subtle divider (`border-t border-black/5 pt-3 mt-3`), `flex flex-wrap gap-2 md:gap-2.5 overflow-x-auto`.
- Chip style: `inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 px-2.5 py-1 text-[11px] font-medium`, with leading dot using `status-pulse` animation.
- Chips derived from existing dashboard signals only — do not add new fetches. Show `🟢`/`🟡`/`🔴` variant per real state:
  - AI Online (from `data.ai?.enabled` if present, else default green when store active)
  - Messenger Connected (from existing messenger status already surfaced in the Messenger widget below — pass the same value in as prop)
  - Webhook Verified (same source as messenger widget)
  - Knowledge Synced / Product Index Ready (derived from products count > 0)
  - OpenAI Connected (from `data.ai?.gatewayOk` if present, else omit)
  - Inventory Synced (products count > 0)
- Any chip whose underlying signal is missing is silently omitted — never faked.

## Animations

- `welcome-fade-in`: opacity/translate on mount, 0.5s.
- `status-pulse`: 1.6s soft opacity pulse on the leading dot of each status chip.
- Card hover: `hover:-translate-y-0.5 transition-transform`.
- AI illustration: reuse existing `orzen-float`.
- Numbers: existing `useCountUp` for the summary bullets. No layout thrash.

## Responsiveness

- ≥ `lg` (1024px+): 3-column grid as described.
- `md` (768–1024): 2-column; illustration column stacks below, CTA moves inline top-right.
- `< md`: single column stack — greeting + chips → AI summary → AI insight → status chips (horizontal scroll). Illustration hidden. CTA becomes full-width pill under the greeting.

## Guarantees

- No change to `myDashboardOverview`, `getInboxStats`, or any hook.
- No change to KPI grid, Order Status, Analytics, Store Health, Recent Orders, Messenger widget, Notifications, Quick Actions, sidebar, header, `AdSlot`, or `StickyMobileAdBar`.
- No new server call, no new secret, no new dependency.
- `View Store` uses the identical `storeUrl` + target/rel behavior.

## Verification

- `/admin` renders with the new hero; every existing widget below it looks and behaves exactly as before.
- Copy button copies store URL (existing `shareStore`).
- Insight text updates when data changes; empty states render nothing rather than placeholder zeros.
- Mobile 375px: hero stacks cleanly, status chips scroll horizontally, no overflow.
- `bun run build` succeeds; no new deps.
