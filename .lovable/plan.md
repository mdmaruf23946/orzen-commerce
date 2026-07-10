## Landing Page Cleanup — Scope

Edit `src/routes/index.tsx` only. No content rewrites, no token changes.

### 1. Remove sections
- Delete the entire **Pricing** section (billing-cycle toggle + 4 plan cards).
- Delete the entire **Compare Plans** table section.
- Remove their nav links / anchor targets from the sticky header + footer so smooth-scroll never lands on a missing anchor.
- Recheck vertical rhythm: keep the standard `py-20 md:py-28` between remaining sections so no visible gap remains.

### 2. Platform Features — new card layout
Convert each of the 12 cards to a horizontal flex row:

```text
┌─────────────────────────────────────┐
│  [Icon]   Feature Title             │
│           Feature description text  │
└─────────────────────────────────────┘
```

- `flex items-start gap-4`, icon in a fixed `h-11 w-11` tinted rounded square on the left.
- Right column: title on top (`font-semibold`), description below (`text-sm text-muted-foreground mt-1`).
- Grid stays `sm:grid-cols-2 lg:grid-cols-3`, all cards `h-full` for equal height, uniform `p-6`.
- Keep hover lift + border transition already in use.

### 3. Why ORZEN — same layout as Features
- Apply the identical horizontal `[Icon] Title / Description-below` card to all 8 benefit cards.
- Same grid, same padding, same equal-height rule. Visually consistent with Section 1.

### 4. How It Works — redesigned timeline
Rebuild the current zig-zag/alternating timeline into a single-column premium timeline that works identically on mobile and desktop:

```text
│
● 01   ┌──────────────────────────────────────┐
│      │ [Icon]  Step Title                   │
│      │         Step description             │
│      └──────────────────────────────────────┘
│
● 02   ┌──────────────────────────────────────┐
```

- Outer wrapper: `relative max-w-3xl mx-auto`, vertical connector line as an absolute `w-px bg-border` positioned at a fixed left offset (e.g. `left-5`).
- Each step is a flex row: numbered circle (`h-10 w-10 rounded-full bg-primary text-primary-foreground`) sitting on the line, then a card taking `flex-1` to the right with `ml-6`.
- Card interior uses the same `[Icon] Title / Description-below` pattern as Features / Why ORZEN.
- No alternating sides, no overlap, no clipped text; description gets full card width.
- Mobile: same structure, timeline stays on the left; card fills remaining width, no horizontal scroll.

### 5. Housekeeping
- Fix the SSR hydration mismatch in the trust-bar `CountUp` component: render the plain numeric string on the server and start the animation only after mount (client-only effect), so SSR and first client render match (`০` vs `0` locale mismatch goes away).
- No changes to `src/styles.css`, tokens, fonts, hero, AI showcase, dashboards, marketplace, testimonials, FAQ, final CTA, or footer content — only nav-link cleanup for the removed anchors.

### Files touched
- `src/routes/index.tsx` (only)
