# Mobile-Responsive Billing & Plans

Refactor `src/routes/_authenticated/admin/billing.index.tsx` for a clean, compact mobile experience (320–480px) while keeping desktop unchanged.

## Changes (single file)

### 1. Trial banner
- Tighter padding (`p-2.5`) and smaller icon/text on mobile.
- Single-line layout, truncate long text, ensure Upgrade button never overflows.

### 2. Current plan card
- Reduce padding to `p-3`, gap to `gap-1`.
- Stack "Renews / expires" inline under the plan name on mobile instead of a second column, saving vertical space.
- Smaller badge (`h-4 text-[10px]`).

### 3. Billing cycle selector
- Keep `grid-cols-2` on mobile but make each option ~48px tall pill with label + save% inline.
- Move the `-N%` corner badge into inline text on mobile (prevents overflow at 320px).
- Remove the "Choose your billing cycle" heading on mobile (label the group with sr-only) to save a row.

### 4. Plan cards
- On mobile switch to a single-column, more compact card: `p-3`, `gap-2`.
- Collapse the long feature checklist into a collapsible `<details>` ("Show all features") so each card fits ~one screen; keep limits + top 3 feature summary always visible.
- Tighter typography: title `text-sm`, price `text-lg`, list `text-[11px]`.
- Button height `h-9` on mobile.
- "Most Popular" / "Current" ribbons shrunk to `text-[9px]` and repositioned to avoid clipping.

### 5. Compare plans
- Hide the entire "Compare plans" section on mobile (`hidden sm:block`) since each plan card already exposes the same info via the collapsible features list — eliminates the largest source of vertical scroll.

### 6. Payment history
- Wrap in `overflow-x-auto` (already there) but on mobile replace the table with a compact list of cards: invoice #, amount, status badge, date, and a "Invoice" link. Prevents horizontal scroll.
- Desktop table unchanged.

### 7. Global page container
- Reduce `space-y-4` → `space-y-3` on mobile, `pb-6` on mobile.
- Ensure every flex row uses `min-w-0` on text children and `shrink-0` on icons/badges to prevent overflow.
- Keep `max-w-full overflow-x-hidden` at root.

## Out of scope
- No changes to server functions, data model, or checkout flow.
- Desktop (≥`sm`) layout preserved.

## Verification
- Set preview viewport to mobile and screenshot at 375px to confirm no horizontal scroll, compact cards, and readable typography.
