# Product Details Page Redesign

Rework the storefront product page (physical/service/subscription types) so the buy area, reviews, related products, and page bottom match the requested layout.

## 1. Buy box styling

- Current price becomes large, bold, in the store's accent color; old price muted strikethrough with discount chip.
- "Add to Cart": outlined secondary style.
- "Buy Now": solid accent (store theme color, orange by default) with white text.
- Same treatment applied to the sticky mobile bottom bar so it matches.

## 2. Order via WhatsApp

- New full-width WhatsApp button directly under Add to Cart / Buy Now, in official WhatsApp green with the WhatsApp icon.
- Opens `wa.me` with the merchant's saved store WhatsApp number and a pre-filled message containing product name, current price, and the page URL.
- Button is hidden when the store has no WhatsApp number saved.

## 3. Customer reviews with submission form

- Keep the rating summary, add a "Write a Review" form: 1-5 star picker, name, email, phone, comment.
- Submissions are stored per product and shown publicly only after they are approved, so spam/abuse can't appear on the storefront.
- Approved reviews list under the summary (reviewer name, stars, date, comment); average rating and count computed from approved reviews.
- Basic validation (required name + rating + comment, valid email, length caps) on both the form and the server.

## 4. Related products

- Remove the "Recently Viewed" and "You May Also Like" rails from this page.
- Keep one "Related Products" section: maximum 4 products, strictly from the same category as the current product (no fallback fill from other categories). Section hides entirely when the category has no other products.

## 5. Clean bottom

- Remove the bottom store card, share bar, and trust badges from the product page.
- Keep only a single "Back to Store" pill button: dark slate background, white text, rounded-full, hover to accent color, soft shadow.

## Technical notes

- Files: `src/routes/store/$slug/product.$productId.tsx` (composition, remove rails/share/store card/trust badges), `src/components/storefront/pdp/BuyBox.tsx` (price + button styling + WhatsApp CTA), `src/components/storefront/pdp/StickyMobileBar.tsx` (color match), `src/components/storefront/pdp/ReviewsBlock.tsx` (summary + list + form).
- New `product_reviews` table (store_id, product_id, rating, name, email, phone, comment, status) with grants and RLS: anonymous/authenticated insert of pending rows, public read of approved rows only, store owner/staff manage. Contact details (email/phone) are not exposed to public reads.
- New server functions in `src/lib/storefront.functions.ts`: `listProductReviews` (approved only, public-safe columns) and `submitProductReview` (zod-validated insert).
- `listRelatedProducts` gains a strict mode (or the page passes a flag) so no cross-category fallback is used; limit 4.
- Digital product page keeps its own layout; only shared components it reuses (ReviewsBlock, StickyMobileBar) inherit the styling changes.
