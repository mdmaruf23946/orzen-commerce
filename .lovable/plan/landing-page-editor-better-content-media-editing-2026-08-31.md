# Landing Page Editor — better content & media editing

Update only the existing section editors inside the Landing Page Creator. Tabs (Content, Order Form, Design, Domains, Settings), the 8 fixed sections, the section-list → section-editor → save flow, the published design and the order/domain/publish systems all stay exactly as they are.

## What changes per section

**Header** — add logo control: shows the current logo, with Change logo (upload), Use store logo, and Remove logo. Default stays the Store Settings logo, so nothing needs re-uploading. Store name and button text stay as they are. No size/position/colour controls.

**Hero** — add a Hero image picker: shows the current image and lets the merchant pick any image from the selected product's existing gallery (or upload one). Headline, short description, offer text, button text unchanged. Price, discount and rating still come from the product.

**Product** — add image selection (checkboxes over the product's existing images, so the merchant chooses which ones show) and a Show specifications toggle next to the existing Show features toggle. Title and short description unchanged.

**Description** — each key point gets an icon chosen from the platform's existing icon set, alongside its title and text, with Add / Delete as today.

**FAQ** — same nested list → item editor, with clearer item rows (question preview) and Add / Delete kept as-is. No design or extra settings.

**Reviews** — add an optional customer photo per review (Change / Choose existing / Remove), plus the existing name, location, review text and star rating.

**Order Form** — unchanged: form title, subtitle, button text only. All configuration stays in the Order Form tab.

**Footer** — the existing Footer editor gains the footer content it should already carry: logo (change / use store logo / remove), store name, short description, phone, email, address, business hours, social links (Facebook, Instagram, YouTube, TikTok, WhatsApp — only platforms the store system supports), copyright, and the policy links the system already supports. Every contact/social field is pre-filled from Store Settings and left blank means "use Store Settings", so no duplicate store data is stored.

## Media rule

All media uses the existing store upload/product image system with the simple pattern: current media → Change → Remove. Size, ratio, crop, radius, shadow and responsiveness stay system-controlled.

## Published page

The published landing page renders the newly editable content in the existing fixed template: header logo, chosen hero image, selected product images, key-point icons, review photos, and the full footer (logo, contact, business hours, social icons, policy links, copyright). Section order, spacing and styling are unchanged.

## Technical notes

- `src/lib/landing-builder.ts`: additive optional fields only — `header.logo`, `hero.image` picker source, `product.selectedImages` + `showSpecs`, `description.points[].icon`, `reviews.items[].photo`, and footer contact/social/hours/links overrides. `normalizeContent()` gains defaults for each so all existing pages keep working with no migration (content stays JSONB).
- `getLandingPage` (`src/lib/landing-builder.functions.ts`) additionally selects the product's `gallery` and the store's branding/contact/social columns (`logo_url`, `name_logo_url`, `phone`, `whatsapp`, `email`, `address`, `facebook`, `instagram`, `youtube`, `tiktok`) so the editors can show real defaults and image choices.
- `getPublicLanding` (`src/lib/landing-public.functions.ts`) returns the same store branding/contact fields so the published footer/header can fall back to Store Settings.
- Editors stay in `src/components/admin/landing/section-editors.tsx`; media uses the existing `ImageUploader`, icons use the existing `FEATURE_ICONS` list. Save still calls `updateLandingPage` — no new backend logic, no new tables, no duplicate product/review/store systems.
