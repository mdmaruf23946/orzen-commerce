# Testimonials Redesign + Owner-Managed Reviews

## What you get

A new testimonials section on the landing page with two rows of review cards that scroll
continuously in opposite directions (top row right-to-left, bottom row left-to-right),
pausing when hovered or touched. Cards get a polished look: avatar (uploaded image or
coloured initials fallback), merchant name, store name, star rating, and review text, with
soft borders, subtle shadow, and fade gradients on both container edges.

All reviews become manageable from the Owner Panel: add, edit, show/hide, reorder, delete.

## Owner Panel — "Reviews & Testimonials"

New page at `/owner/reviews`, linked in the owner sidebar under Footer Settings.

- Table/list of all reviews with avatar, name, store, rating, visible toggle.
- Add/Edit dialog: avatar upload, merchant name, store name, rating 1–5, review text,
  sort order, visible switch.
- Delete with confirmation.
- Landing page reads only visible reviews, ordered by sort order.

## Technical notes

**Database** — new `public.platform_reviews` table: `name`, `store_name`, `avatar_url`,
`rating` (1–5), `review`, `tone` (accent colour for initials fallback), `is_visible`,
`sort_order`, timestamps. `GRANT SELECT` to `anon`/`authenticated` (public landing read),
full grants to `service_role`; RLS: anyone can read visible rows, owner-role users manage
all rows. Seeded with the six current hardcoded reviews so nothing disappears.

**Avatar upload** — reuses the existing owner-panel pattern: upload to the private
`store-assets` bucket under `platform-reviews/`, store the `/api/img/...` proxy URL so
anonymous visitors can load it. Images compressed client-side before upload.

**Server functions** — `src/lib/reviews.functions.ts`: `getPublicReviews` (anon, publishable
client, visible rows only) and owner-guarded `upsertReview` / `deleteReview` with Zod
validation, matching how `footer.functions.ts` works.

**Marquee** — new `src/components/landing/TestimonialsMarquee.tsx`. Each row renders the
list twice and translates by -50% via a CSS keyframe animation, giving a seamless loop with
no JS timers. `group-hover:[animation-play-state:paused]` plus a touch handler for mobile
pause. Rows split the review list in half; if fewer than 4 reviews exist, the list repeats
so both rows stay full. Keyframes added to `src/styles.css`; `prefers-reduced-motion`
disables the animation.

**Landing page** — `Testimonials()` in `src/routes/index.tsx` replaced with the new
component fed by fetched data, falling back to the current built-in list if the fetch fails.
