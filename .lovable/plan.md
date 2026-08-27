# Hero Banner Layout Fix

## Goal
Make the storefront hero banner section match the reference screenshot exactly: a large slider banner on the left that is flush in height with two stacked smaller banners on the right, with no overlap and no extra whitespace.

## Current State
- File: `src/components/storefront/HeroBanners.tsx`
- Current layout uses `lg:grid-cols-[27fr_10fr]` and `lg:aspect-[47/20]` on the main banner.
- Side banners live inside a `grid grid-cols-2 lg:grid-cols-1 lg:grid-rows-2` container, which causes uneven/overflowing heights on desktop.

## Plan
1. **Switch to a clean 3-column CSS Grid**
   - Wrapper: `grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch`.
   - Main slider banner: `lg:col-span-2`.
   - Right-side column: `lg:col-span-1`.

2. **Rebuild the right-side column**
   - Container: `flex flex-col gap-4 h-full`.
   - Each side banner wrapper: `h-1/2` (so two banners together equal 100% of the main banner height).
   - Inner image: `h-full w-full object-cover`.

3. **Remove overlap-causing styles**
   - Drop `lg:aspect-[47/20]` from the main banner; let grid stretch drive the height.
   - Remove `aspect-[16/9]` and `lg:aspect-auto lg:h-full` overrides from side banners where they conflict with `h-1/2`.
   - Ensure no absolute positioning or fixed pixel heights remain on the side banners.

4. **Preserve existing behavior**
   - Keep auto-rotation, pause-on-hover, swipe gestures, and dot indicators on the main banner.
   - Keep the `SideRotator` auto-slide behavior for supporting banners.
   - Keep responsive fallbacks for mobile (single column).

5. **Verify visually**
   - Check desktop preview at 1280px+ to confirm left/right edges align flush.
   - Check mobile preview to confirm the single-column stack still works.
